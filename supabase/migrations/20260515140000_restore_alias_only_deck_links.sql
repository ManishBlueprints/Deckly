BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_deck_link_alias_workspace_collision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    IF NEW.link_alias IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT d.user_id INTO v_owner_id
    FROM public.decks d
    WHERE d.id = NEW.deck_id;

    IF EXISTS (
        SELECT 1
        FROM public.decks d
        WHERE d.user_id = v_owner_id
          AND d.slug = NEW.link_alias
          AND d.id <> NEW.deck_id
    ) THEN
        RAISE EXCEPTION 'Link alias conflicts with another deck slug in this workspace.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.deck_links dl
        JOIN public.decks d ON d.id = dl.deck_id
        WHERE d.user_id = v_owner_id
          AND dl.link_alias = NEW.link_alias
          AND dl.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
        RAISE EXCEPTION 'Link alias conflicts with another link alias in this workspace.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_deck_slug_workspace_collision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.deck_links dl
        JOIN public.decks d ON d.id = dl.deck_id
        WHERE d.user_id = NEW.user_id
          AND dl.link_alias = NEW.slug
          AND d.id <> NEW.id
    ) THEN
        RAISE EXCEPTION 'Deck slug conflicts with an existing link alias in this workspace.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_deck_link_alias_workspace_collision ON public.deck_links;
CREATE TRIGGER tr_enforce_deck_link_alias_workspace_collision
    BEFORE INSERT OR UPDATE OF link_alias ON public.deck_links
    FOR EACH ROW EXECUTE FUNCTION public.enforce_deck_link_alias_workspace_collision();

DROP TRIGGER IF EXISTS tr_enforce_deck_slug_workspace_collision ON public.decks;
CREATE TRIGGER tr_enforce_deck_slug_workspace_collision
    BEFORE INSERT OR UPDATE OF slug ON public.decks
    FOR EACH ROW EXECUTE FUNCTION public.enforce_deck_slug_workspace_collision();

CREATE OR REPLACE FUNCTION public.resolve_public_deck_link(
    p_handle TEXT DEFAULT NULL,
    p_slug_or_alias TEXT DEFAULT NULL
)
RETURNS TABLE (
    deck_id uuid,
    canonical_slug text,
    user_handle text,
    link_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
    d.id AS deck_id,
    d.slug AS canonical_slug,
    p.handle AS user_handle,
    dl.id AS link_id
FROM public.decks d
JOIN public.profiles p ON p.id = d.user_id
LEFT JOIN public.deck_links dl ON dl.deck_id = d.id AND dl.is_enabled = TRUE
WHERE d.status <> 'DELETED'
  AND (d.expires_at IS NULL OR d.expires_at > NOW())
  AND (
    (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) = d.user_id
      AND p_handle IS NOT NULL
      AND p.handle = p_handle
      AND (
        (p_slug_or_alias = d.slug AND dl.is_primary = TRUE)
        OR dl.link_alias = p_slug_or_alias
      )
    )
    OR
    (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) = d.user_id
      AND p_handle IS NULL
      AND p_slug_or_alias = d.slug
      AND dl.is_primary = TRUE
    )
    OR
    (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) = d.user_id
      AND p_handle IS NULL
      AND dl.link_alias = p_slug_or_alias
    )
    OR
    (
      p_handle IS NULL
      AND p_slug_or_alias = d.slug
      AND dl.is_primary = TRUE
    )
    OR
    (
      p_handle IS NOT NULL
      AND p.handle = p_handle
      AND (
        (p_slug_or_alias = d.slug AND dl.is_primary = TRUE)
        OR dl.link_alias = p_slug_or_alias
      )
    )
  );
$$;

DROP FUNCTION IF EXISTS public.get_decks_public(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_decks_public(TEXT);

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
    resolved.user_handle
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
    user_handle text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT *
FROM public.get_decks_public(NULL, NULL);
$$;

DROP FUNCTION IF EXISTS public.check_deck_password(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.check_deck_password(
    p_handle TEXT,
    p_slug_or_alias TEXT,
    p_password TEXT
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
    SELECT d.view_password
    INTO v_hashed_pw
    FROM public.resolve_public_deck_link(p_handle, p_slug_or_alias) resolved
    JOIN public.decks d ON d.id = resolved.deck_id;

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

    IF NOT public.check_rate_limit(v_ip, p_slug_or_alias) THEN
        RAISE EXCEPTION 'Too many failed attempts. Please try again later.';
    END IF;

    IF v_hashed_pw = crypt(p_password, v_hashed_pw) THEN
        PERFORM public.clear_rate_limit(v_ip, p_slug_or_alias);
        RETURN TRUE;
    END IF;

    PERFORM public.record_failed_attempt(v_ip, p_slug_or_alias);
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_deck_password(p_slug TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
SELECT public.check_deck_password(NULL, p_slug, p_password);
$$;

DROP FUNCTION IF EXISTS public.get_deck_payload(TEXT, TEXT, TEXT);

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
    SELECT d.*
    INTO v_deck
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
SELECT public.get_deck_payload(NULL, p_slug, p_password);
$$;

GRANT EXECUTE ON FUNCTION public.resolve_public_deck_link(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_decks_public(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_deck_password(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_deck_payload(TEXT, TEXT, TEXT) TO anon, authenticated;

COMMIT;
