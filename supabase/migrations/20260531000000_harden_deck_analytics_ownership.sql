CREATE OR REPLACE FUNCTION public.count_unique_visitors(p_deck_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_count INTEGER;
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

    SELECT COUNT(DISTINCT visitor_id)::INTEGER
    INTO v_count
    FROM public.deck_page_views
    WHERE deck_id = p_deck_id;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_deck_locations(p_deck_id UUID)
RETURNS JSONB
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

    RETURN jsonb_build_object(
        'countries', COALESCE((
            SELECT jsonb_agg(t) FROM (
                SELECT
                    COALESCE(country, 'Unknown') AS name,
                    country_code AS code,
                    COUNT(*)::INTEGER AS count
                FROM public.deck_page_views
                WHERE deck_id = p_deck_id
                GROUP BY country, country_code
                ORDER BY count DESC
            ) t
        ), '[]'::jsonb),
        'cities', COALESCE((
            SELECT jsonb_agg(t) FROM (
                SELECT
                    COALESCE(city, 'Unknown City') AS name,
                    COALESCE(country, 'Unknown') AS country,
                    COUNT(*)::INTEGER AS count
                FROM public.deck_page_views
                WHERE deck_id = p_deck_id
                GROUP BY city, country
                ORDER BY count DESC
            ) t
        ), '[]'::jsonb)
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.count_unique_visitors(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_deck_locations(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_unique_visitors(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_deck_locations(UUID) TO authenticated;
