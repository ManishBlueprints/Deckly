-- Keep link-level analytics isolated to the deck that owns each link.
CREATE OR REPLACE FUNCTION public.record_deck_visit(
    p_deck_id UUID,
    p_page_number INTEGER,
    p_time_spent NUMERIC,
    p_visitor_id TEXT,
    p_viewer_email TEXT DEFAULT NULL,
    p_data_room_id UUID DEFAULT NULL,
    p_country TEXT DEFAULT 'Unknown',
    p_city TEXT DEFAULT 'Unknown City',
    p_country_code TEXT DEFAULT NULL,
    p_deck_link_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_deck_owner_id UUID;
    v_recent_view_id UUID;
    v_is_unique BOOLEAN;
    v_email_count INTEGER;
BEGIN
    IF p_time_spent < 0 THEN p_time_spent := 0; END IF;
    p_time_spent := LEAST(p_time_spent, 3600);

    IF LENGTH(p_visitor_id) > 100 THEN
        p_visitor_id := LEFT(p_visitor_id, 100);
    END IF;

    IF p_viewer_email IS NOT NULL THEN
        SELECT COUNT(DISTINCT viewer_email) INTO v_email_count
        FROM public.deck_page_views
        WHERE visitor_id = p_visitor_id AND deck_id = p_deck_id AND viewer_email IS NOT NULL;

        IF v_email_count >= 5 THEN
            p_viewer_email := NULL;
        END IF;
    END IF;

    IF p_data_room_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.data_room_documents
            WHERE data_room_id = p_data_room_id AND deck_id = p_deck_id
        ) THEN
            p_data_room_id := NULL;
        END IF;
    END IF;

    IF p_deck_link_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.deck_links
            WHERE id = p_deck_link_id AND deck_id = p_deck_id
        ) THEN
            p_deck_link_id := NULL;
        END IF;
    END IF;

    SELECT user_id INTO v_deck_owner_id FROM public.decks WHERE id = p_deck_id;
    IF NOT FOUND THEN RETURN; END IF;

    SELECT dpv.id INTO v_recent_view_id
    FROM public.deck_page_views dpv
    WHERE dpv.deck_id = p_deck_id
      AND dpv.page_number = p_page_number
      AND dpv.visitor_id = p_visitor_id
      AND dpv.data_room_id IS NOT DISTINCT FROM p_data_room_id
      AND dpv.deck_link_id IS NOT DISTINCT FROM p_deck_link_id
      AND dpv.viewed_at > (NOW() - INTERVAL '24 hours')
    LIMIT 1;

    v_is_unique := (v_recent_view_id IS NULL);

    IF v_is_unique THEN
        INSERT INTO public.deck_page_views (
            deck_id, page_number, visitor_id, time_spent,
            viewer_email, data_room_id, country, city, country_code,
            deck_link_id
        )
        VALUES (
            p_deck_id, p_page_number, p_visitor_id, p_time_spent,
            p_viewer_email, p_data_room_id, p_country, p_city, p_country_code,
            p_deck_link_id
        );
    ELSE
        UPDATE public.deck_page_views
        SET time_spent = LEAST(time_spent + p_time_spent, 86400),
            viewed_at = NOW(),
            viewer_email = COALESCE(viewer_email, p_viewer_email),
            country = CASE WHEN country = 'Unknown' THEN p_country ELSE country END,
            city = CASE WHEN city = 'Unknown City' THEN p_city ELSE city END,
            country_code = COALESCE(country_code, p_country_code),
            deck_link_id = p_deck_link_id
        WHERE id = v_recent_view_id;
    END IF;

    INSERT INTO public.deck_stats (deck_id, page_number, user_id, data_room_id, total_views, total_time_seconds)
    VALUES (
        p_deck_id, p_page_number, v_deck_owner_id, p_data_room_id,
        CASE WHEN v_is_unique THEN 1 ELSE 0 END,
        ROUND(p_time_spent::numeric)::INTEGER
    )
    ON CONFLICT (deck_id, page_number, (COALESCE(data_room_id, '00000000-0000-0000-0000-000000000000'::uuid)))
    DO UPDATE SET
        total_views = deck_stats.total_views + (CASE WHEN v_is_unique THEN 1 ELSE 0 END),
        total_time_seconds = deck_stats.total_time_seconds + ROUND(p_time_spent::numeric)::INTEGER,
        updated_at = NOW(),
        user_id = COALESCE(deck_stats.user_id, EXCLUDED.user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_deck_visit(UUID, INTEGER, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_deck_visit(UUID, INTEGER, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_deck_link_stats(p_deck_id UUID)
RETURNS TABLE (
    link_id UUID,
    link_name TEXT,
    link_alias TEXT,
    is_primary BOOLEAN,
    is_enabled BOOLEAN,
    total_views INTEGER,
    unique_visitors INTEGER,
    total_time_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.decks d
        WHERE d.id = p_deck_id
          AND d.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    SELECT
        dl.id AS link_id,
        dl.link_name,
        dl.link_alias,
        dl.is_primary,
        dl.is_enabled,
        COALESCE(COUNT(DISTINCT dpv.visitor_id || '_' || dpv.viewed_at::DATE)::INTEGER, 0) AS total_views,
        COALESCE(COUNT(DISTINCT dpv.visitor_id)::INTEGER, 0) AS unique_visitors,
        COALESCE(SUM(dpv.time_spent)::INTEGER, 0) AS total_time_seconds
    FROM public.deck_links dl
    LEFT JOIN public.deck_page_views dpv
      ON dpv.deck_link_id = dl.id
      AND dpv.deck_id = dl.deck_id
    WHERE dl.deck_id = p_deck_id
    GROUP BY dl.id, dl.link_name, dl.link_alias, dl.is_primary, dl.is_enabled, dl.created_at
    ORDER BY total_views DESC, dl.created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_deck_link_stats(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_deck_link_stats(UUID) TO authenticated;
