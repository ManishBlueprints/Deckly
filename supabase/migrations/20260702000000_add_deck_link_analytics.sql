-- 1. Add deck_link_id to deck_page_views
ALTER TABLE public.deck_page_views ADD COLUMN IF NOT EXISTS deck_link_id UUID REFERENCES public.deck_links(id) ON DELETE SET NULL;

-- 2. Update record_deck_visit function to support deck_link_id (drop old 9-parameter version first)
DROP FUNCTION IF EXISTS public.record_deck_visit(UUID, INTEGER, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT, TEXT);

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
    -- Input Validations
    IF p_time_spent < 0 THEN p_time_spent := 0; END IF;
    p_time_spent := LEAST(p_time_spent, 3600); -- updated cap: 1 hr
    
    -- Ensure visitor_id doesn't exceed 100 chars instead of silently dropping
    IF LENGTH(p_visitor_id) > 100 THEN 
        p_visitor_id := LEFT(p_visitor_id, 100); 
    END IF;

    -- Enforce email uniqueness spam limit per visitor
    IF p_viewer_email IS NOT NULL THEN
        SELECT COUNT(DISTINCT viewer_email) INTO v_email_count
        FROM public.deck_page_views
        WHERE visitor_id = p_visitor_id AND deck_id = p_deck_id AND viewer_email IS NOT NULL;

        IF v_email_count >= 5 THEN
           -- Ignore the injected email
           p_viewer_email := NULL;
         END IF;
    END IF;

    -- 1. Validate p_data_room_id: ensure it's linked to p_deck_id to prevent spoofing
    IF p_data_room_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.data_room_documents
            WHERE data_room_id = p_data_room_id AND deck_id = p_deck_id
        ) THEN
            -- Room is not linked to this deck; silently discard the association
            p_data_room_id := NULL;
        END IF;
    END IF;

    -- 2. Get the deck owner
    SELECT user_id INTO v_deck_owner_id FROM public.decks WHERE id = p_deck_id;
    IF NOT FOUND THEN RETURN; END IF;

    -- 3. Check for unique view in last 24 hours (now context-aware)
    SELECT id INTO v_recent_view_id
    FROM public.deck_page_views
    WHERE deck_id = p_deck_id
      AND page_number = p_page_number
      AND visitor_id = p_visitor_id
      AND (
          (p_data_room_id IS NULL AND data_room_id IS NULL) OR 
          (p_data_room_id IS NOT NULL AND data_room_id = p_data_room_id)
      )
      AND viewed_at > (NOW() - INTERVAL '24 hours')
    LIMIT 1;

    v_is_unique := (v_recent_view_id IS NULL);

    -- 4. Sync deck_page_views
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
        -- Also refresh viewed_at so the 24-hour window advances correctly,
        -- and keep viewer_email/location up-to-date ONLY if they were previously null or unknown.
        UPDATE public.deck_page_views
        SET time_spent   = LEAST(time_spent + p_time_spent, 86400), -- Daily cap of 24 hrs
            viewed_at    = NOW(),
            viewer_email = COALESCE(viewer_email, p_viewer_email),
            country      = CASE WHEN country = 'Unknown' THEN p_country ELSE country END,
            city         = CASE WHEN city = 'Unknown City' THEN p_city ELSE city END,
            country_code = COALESCE(country_code, p_country_code),
            deck_link_id = COALESCE(deck_link_id, p_deck_link_id)
        WHERE id = v_recent_view_id;
    END IF;

    -- 5. Sync deck_stats (Aggregate - now context-aware)
    INSERT INTO public.deck_stats (deck_id, page_number, user_id, data_room_id, total_views, total_time_seconds)
    VALUES (
        p_deck_id, p_page_number, v_deck_owner_id, p_data_room_id,
        CASE WHEN v_is_unique THEN 1 ELSE 0 END, 
        ROUND(p_time_spent::numeric)::INTEGER
    )
    ON CONFLICT (deck_id, page_number, (COALESCE(data_room_id, '00000000-0000-0000-0000-000000000000'::uuid)))
    DO UPDATE SET
        total_views        = deck_stats.total_views + (CASE WHEN v_is_unique THEN 1 ELSE 0 END),
        total_time_seconds = deck_stats.total_time_seconds + ROUND(p_time_spent::numeric)::INTEGER,
        updated_at         = NOW(),
        user_id            = COALESCE(deck_stats.user_id, EXCLUDED.user_id);
END;
$$;

-- Grant execute permissions for the updated function
REVOKE EXECUTE ON FUNCTION public.record_deck_visit(UUID, INTEGER, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_deck_visit(UUID, INTEGER, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

-- 3. Update get_decks_public to return deck_link_id (drop old overloads first)
DROP FUNCTION IF EXISTS public.get_decks_public();
DROP FUNCTION IF EXISTS public.get_decks_public(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_decks_public(
    p_handle TEXT DEFAULT NULL,
    p_slug_or_alias TEXT DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    title text,
    slug text,
    description text,
    status text,
    file_size bigint,
    display_order integer,
    require_email boolean,
    require_password boolean,
    expires_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    file_type text,
    display_mode text,
    user_handle text,
    deck_link_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
    d.id,
    d.user_id,
    d.title,
    d.slug,
    d.description,
    d.status,
    d.file_size,
    d.display_order,
    d.require_email,
    d.require_password,
    d.expires_at,
    d.created_at,
    d.updated_at,
    d.file_type,
    d.display_mode,
    resolved.user_handle,
    resolved.link_id AS deck_link_id
FROM public.resolve_public_deck_link(p_handle, p_slug_or_alias) resolved
JOIN public.decks d ON d.id = resolved.deck_id;
$$;

CREATE OR REPLACE FUNCTION public.get_decks_public()
RETURNS TABLE (
    id uuid,
    user_id uuid,
    title text,
    slug text,
    description text,
    status text,
    file_size bigint,
    display_order integer,
    require_email boolean,
    require_password boolean,
    expires_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    file_type text,
    display_mode text,
    user_handle text,
    deck_link_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
    id,
    user_id,
    title,
    slug,
    description,
    status,
    file_size,
    display_order,
    require_email,
    require_password,
    expires_at,
    created_at,
    updated_at,
    file_type,
    display_mode,
    user_handle,
    deck_link_id
FROM public.get_decks_public(NULL, NULL);
$$;

GRANT EXECUTE ON FUNCTION public.get_decks_public(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_decks_public() TO anon, authenticated;

-- 4. Update get_deck_payload to return deck_link_id
CREATE OR REPLACE FUNCTION public.get_deck_payload(
    p_handle TEXT,
    p_slug_or_alias TEXT,
    p_password TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_deck RECORD;
    v_storage_path TEXT;
BEGIN
    SELECT d.*, resolved.link_id INTO v_deck
    FROM public.resolve_public_deck_link(p_handle, p_slug_or_alias) resolved
    JOIN public.decks d ON d.id = resolved.deck_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_deck.user_id
          AND v_deck.require_password
          AND NOT public.check_deck_password(p_handle, p_slug_or_alias, p_password) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    v_storage_path := regexp_replace(
        v_deck.file_url,
        '^.*/storage/v1/object/(public|sign|authenticated)/decks/',
        ''
    );

    RETURN jsonb_build_object(
        'storage_path', v_storage_path,
        'file_url', v_deck.file_url,
        'pages', v_deck.pages,
        'deck_link_id', v_deck.link_id
    )::jsonb;
END;
$$;

-- 5. Create get_deck_link_stats RPC function to aggregate metrics per link
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
    LEFT JOIN public.deck_page_views dpv ON dpv.deck_link_id = dl.id
    WHERE dl.deck_id = p_deck_id
    GROUP BY dl.id, dl.link_name, dl.link_alias, dl.is_primary, dl.is_enabled, dl.created_at
    ORDER BY total_views DESC, dl.created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_deck_link_stats(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_deck_link_stats(UUID) TO authenticated;
