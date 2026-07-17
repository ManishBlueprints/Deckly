BEGIN;

ALTER TABLE public.decks
  ADD COLUMN IF NOT EXISTS allow_download BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.enforce_deck_download_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
BEGIN
  IF NEW.allow_download IS NOT TRUE
     OR (TG_OP = 'UPDATE' AND NEW.allow_download IS NOT DISTINCT FROM OLD.allow_download) THEN
    RETURN NEW;
  END IF;

  SELECT tier INTO v_tier FROM public.profiles WHERE id = NEW.user_id;
  IF COALESCE(v_tier, 'FREE') NOT IN ('PRO', 'PRO_PLUS', 'RAISE') THEN
    RAISE EXCEPTION 'Download controls require a paid plan.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_deck_download_entitlement ON public.decks;
CREATE TRIGGER tr_enforce_deck_download_entitlement
  BEFORE INSERT OR UPDATE OF allow_download ON public.decks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_deck_download_entitlement();

CREATE OR REPLACE FUNCTION public.disable_downloads_on_free_downgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.tier = 'FREE' AND OLD.tier IS DISTINCT FROM 'FREE' THEN
    UPDATE public.decks
    SET allow_download = FALSE, updated_at = NOW()
    WHERE user_id = NEW.id AND allow_download = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_disable_deck_downloads_on_free_downgrade ON public.profiles;
CREATE TRIGGER tr_disable_deck_downloads_on_free_downgrade
  AFTER UPDATE OF tier ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.disable_downloads_on_free_downgrade();

DROP FUNCTION IF EXISTS public.create_deck_with_primary_link(
  uuid, text, text, text, text, jsonb, text, text, bigint, text, boolean, boolean, text, timestamptz
);

CREATE FUNCTION public.create_deck_with_primary_link(
  p_user_id uuid,
  p_title text,
  p_slug text,
  p_description text,
  p_file_url text,
  p_pages jsonb DEFAULT '[]'::jsonb,
  p_status text DEFAULT 'PENDING',
  p_display_mode text DEFAULT 'raw',
  p_file_size bigint DEFAULT NULL,
  p_file_type text DEFAULT 'pdf',
  p_require_email boolean DEFAULT false,
  p_require_password boolean DEFAULT false,
  p_view_password text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_allow_download boolean DEFAULT false
)
RETURNS public.decks
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE v_deck public.decks;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF auth.uid() <> p_user_id THEN RAISE EXCEPTION 'Permission denied'; END IF;

  INSERT INTO public.decks (
    user_id, title, slug, description, file_url, pages, status, display_mode,
    file_size, file_type, require_email, require_password, view_password,
    expires_at, allow_download
  ) VALUES (
    p_user_id, p_title, p_slug, p_description, p_file_url, p_pages, p_status,
    p_display_mode, p_file_size, p_file_type, p_require_email,
    p_require_password, p_view_password, p_expires_at, p_allow_download
  ) RETURNING * INTO v_deck;

  INSERT INTO public.deck_links (deck_id, link_name, link_alias, is_enabled, is_primary)
  VALUES (v_deck.id, 'Default Link', p_slug, TRUE, TRUE);
  RETURN v_deck;
END;
$$;

REVOKE ALL ON FUNCTION public.create_deck_with_primary_link(
  uuid, text, text, text, text, jsonb, text, text, bigint, text, boolean, boolean, text, timestamptz, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_deck_with_primary_link(
  uuid, text, text, text, text, jsonb, text, text, bigint, text, boolean, boolean, text, timestamptz, boolean
) TO authenticated;

DROP FUNCTION IF EXISTS public.get_decks_public();
DROP FUNCTION IF EXISTS public.get_decks_public(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_decks_public(
  p_handle TEXT DEFAULT NULL,
  p_slug_or_alias TEXT DEFAULT NULL
)
RETURNS TABLE (
  id uuid, user_id uuid, title text, slug text, description text, status text,
  file_size bigint, display_order integer, require_email boolean,
  require_password boolean, expires_at timestamptz, created_at timestamptz,
  updated_at timestamptz, file_type text, display_mode text, user_handle text,
  allow_download boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
SELECT d.id, d.user_id, d.title, d.slug, d.description, d.status,
  d.file_size, d.display_order, d.require_email, d.require_password,
  d.expires_at, d.created_at, d.updated_at, d.file_type, d.display_mode,
  resolved.user_handle,
  (d.allow_download AND COALESCE(owner_profile.tier, 'FREE') IN ('PRO', 'PRO_PLUS', 'RAISE')) AS allow_download
FROM public.resolve_public_deck_link(p_handle, p_slug_or_alias) resolved
JOIN public.decks d ON d.id = resolved.deck_id
JOIN public.profiles owner_profile ON owner_profile.id = d.user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_decks_public()
RETURNS TABLE (
  id uuid, user_id uuid, title text, slug text, description text, status text,
  file_size bigint, display_order integer, require_email boolean,
  require_password boolean, expires_at timestamptz, created_at timestamptz,
  updated_at timestamptz, file_type text, display_mode text, user_handle text,
  allow_download boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.get_decks_public(NULL, NULL); $$;

CREATE OR REPLACE FUNCTION public.get_deck_payload(
  p_handle TEXT,
  p_slug_or_alias TEXT,
  p_password TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_deck RECORD; v_storage_path TEXT; v_allow_download BOOLEAN;
BEGIN
  SELECT d.* INTO v_deck
  FROM public.resolve_public_deck_link(p_handle, p_slug_or_alias) resolved
  JOIN public.decks d ON d.id = resolved.deck_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized';
  ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_deck.user_id
    AND v_deck.require_password
    AND NOT public.check_deck_password(p_handle, p_slug_or_alias, p_password) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT v_deck.allow_download AND COALESCE(p.tier, 'FREE') IN ('PRO', 'PRO_PLUS', 'RAISE')
    INTO v_allow_download FROM public.profiles p WHERE p.id = v_deck.user_id;
  v_storage_path := regexp_replace(v_deck.file_url, '^.*/storage/v1/object/(public|sign|authenticated)/decks/', '');
  RETURN jsonb_build_object(
    'storage_path', v_storage_path, 'file_url', v_deck.file_url,
    'pages', v_deck.pages, 'title', v_deck.title, 'file_type', v_deck.file_type,
    'allow_download', COALESCE(v_allow_download, FALSE)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_data_room_payload(
  p_handle TEXT, p_slug TEXT, p_password TEXT
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_room RECORD; v_documents jsonb;
BEGIN
  SELECT dr.* INTO v_room FROM public.data_rooms dr
  JOIN public.profiles p ON p.id = dr.user_id
  WHERE p.handle = p_handle AND dr.slug = p_slug
    AND (dr.expires_at IS NULL OR dr.expires_at > NOW());
  IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id
    AND NOT v_room.is_public THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id
    AND v_room.require_password
    AND NOT public.check_data_room_password(p_handle, p_slug, p_password) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id, 'title', d.title, 'slug', d.slug, 'description', d.description,
    'status', d.status, 'file_type', d.file_type, 'display_mode', d.display_mode,
    'file_url', d.file_url, 'folder_id', drd.folder_id, 'folder_name', drf.name,
    'storage_path', regexp_replace(d.file_url, '^.*/storage/v1/object/(public|sign|authenticated)/decks/', ''),
    'pages', d.pages,
    'allow_download', (d.allow_download AND COALESCE(owner_profile.tier, 'FREE') IN ('PRO', 'PRO_PLUS', 'RAISE'))
  ) ORDER BY drd.display_order ASC), '[]'::jsonb) INTO v_documents
  FROM public.data_room_documents drd
  JOIN public.decks d ON d.id = drd.deck_id
  JOIN public.profiles owner_profile ON owner_profile.id = d.user_id
  LEFT JOIN public.data_room_folders drf ON drf.id = drd.folder_id
  WHERE drd.data_room_id = v_room.id;
  RETURN v_documents;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_decks_public(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_deck_payload(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_room_payload(TEXT, TEXT, TEXT) TO anon, authenticated;

COMMIT;
