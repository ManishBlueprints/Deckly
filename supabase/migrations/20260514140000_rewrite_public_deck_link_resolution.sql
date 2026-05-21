BEGIN;

DROP FUNCTION IF EXISTS public.get_decks_public();
DROP FUNCTION IF EXISTS public.get_decks_public(TEXT);

CREATE OR REPLACE FUNCTION public.get_decks_public(p_link_token TEXT DEFAULT NULL)
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
    user_handle text
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
    p.handle AS user_handle
FROM public.decks d
JOIN public.profiles p ON d.user_id = p.id
WHERE d.status <> 'DELETED'
  AND (d.expires_at IS NULL OR d.expires_at > NOW())
  AND (
    (
      p_link_token IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.deck_links dl
        WHERE dl.deck_id = d.id
          AND dl.is_primary = TRUE
          AND dl.is_enabled = TRUE
      )
    )
    OR
    (
      p_link_token IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.deck_links dl
        WHERE dl.deck_id = d.id
          AND dl.public_token = p_link_token
          AND dl.is_enabled = TRUE
      )
    )
  );
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
    user_handle text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT *
FROM public.get_decks_public(NULL);
$$;

CREATE OR REPLACE FUNCTION public.check_deck_password(
    p_slug TEXT,
    p_password TEXT,
    p_link_token TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_hashed_pw TEXT;
    v_ip TEXT := current_setting('request.headers', true)::json->>'x-forwarded-for';
BEGIN
    SELECT d.view_password INTO v_hashed_pw
    FROM public.decks d
    WHERE d.slug = p_slug
      AND (d.expires_at IS NULL OR d.expires_at > NOW())
      AND (
        (
          p_link_token IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.deck_links dl
            WHERE dl.deck_id = d.id
              AND dl.is_primary = TRUE
              AND dl.is_enabled = TRUE
          )
        )
        OR
        (
          p_link_token IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.deck_links dl
            WHERE dl.deck_id = d.id
              AND dl.public_token = p_link_token
              AND dl.is_enabled = TRUE
          )
        )
      );

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_hashed_pw IS NULL THEN
        RETURN TRUE;
    END IF;

    IF v_ip IS NOT NULL AND trim(v_ip) != '' THEN
        v_ip := trim(split_part(v_ip, ',', 1));
    END IF;

    IF v_ip IS NULL OR trim(v_ip) = '' THEN
        v_ip := COALESCE(inet_client_addr()::text, 'local');
    END IF;

    IF NOT public.check_rate_limit(v_ip, p_slug) THEN
        RAISE EXCEPTION 'Too many failed attempts. Please try again later.';
    END IF;

    IF v_hashed_pw = crypt(p_password, v_hashed_pw) THEN
        PERFORM public.clear_rate_limit(v_ip, p_slug);
        RETURN TRUE;
    END IF;

    PERFORM public.record_failed_attempt(v_ip, p_slug);
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_deck_password(p_slug TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
SELECT public.check_deck_password(p_slug, p_password, NULL);
$$;

CREATE OR REPLACE FUNCTION public.get_deck_payload(
    p_slug TEXT,
    p_password TEXT,
    p_link_token TEXT DEFAULT NULL
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
    SELECT * INTO v_deck
    FROM public.decks
    WHERE slug = p_slug
      AND (expires_at IS NULL OR expires_at > NOW());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_deck.user_id
          AND p_link_token IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.deck_links dl
            WHERE dl.deck_id = v_deck.id
              AND dl.is_primary = TRUE
              AND dl.is_enabled = TRUE
          ) THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_deck.user_id
          AND p_link_token IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.deck_links dl
            WHERE dl.deck_id = v_deck.id
              AND dl.public_token = p_link_token
              AND dl.is_enabled = TRUE
          ) THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_deck.user_id
          AND v_deck.require_password
          AND NOT public.check_deck_password(p_slug, p_password, p_link_token) THEN
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
        'pages', v_deck.pages
    )::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_deck_payload(p_slug TEXT, p_password TEXT)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
SELECT public.get_deck_payload(p_slug, p_password, NULL);
$$;

GRANT EXECUTE ON FUNCTION public.get_decks_public(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_deck_password(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_deck_payload(TEXT, TEXT, TEXT) TO anon, authenticated;

COMMIT;
