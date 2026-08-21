BEGIN;

ALTER TABLE public.decks
  ADD COLUMN IF NOT EXISTS watermark_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS watermark_text TEXT,
  ADD COLUMN IF NOT EXISTS watermark_revision UUID,
  ADD COLUMN IF NOT EXISTS watermark_status TEXT NOT NULL DEFAULT 'disabled',
  ADD COLUMN IF NOT EXISTS watermarked_file_path TEXT,
  ADD COLUMN IF NOT EXISTS watermark_error TEXT,
  ADD COLUMN IF NOT EXISTS watermark_updated_at TIMESTAMPTZ;

UPDATE public.decks
SET watermark_revision = gen_random_uuid()
WHERE watermark_revision IS NULL;

ALTER TABLE public.decks
  ALTER COLUMN watermark_revision SET DEFAULT gen_random_uuid();

ALTER TABLE public.decks
  DROP CONSTRAINT IF EXISTS decks_watermark_status_check,
  DROP CONSTRAINT IF EXISTS decks_watermark_text_check;

ALTER TABLE public.decks
  ADD CONSTRAINT decks_watermark_revision_not_null
    CHECK (watermark_revision IS NOT NULL) NOT VALID,
  ADD CONSTRAINT decks_watermark_status_check
    CHECK (watermark_status IN ('disabled', 'pending', 'processing', 'ready', 'failed')) NOT VALID,
  ADD CONSTRAINT decks_watermark_text_check
    CHECK (
      NOT watermark_enabled
      OR (watermark_text IS NOT NULL AND char_length(btrim(watermark_text)) BETWEEN 1 AND 80)
    ) NOT VALID;

INSERT INTO public.billing_feature_catalog (key, label, description, availability, required_tier, display_order)
VALUES ('deck_watermarking', 'Deck watermarking', 'Apply a text watermark to shared PDF decks and downloads.', 'live', 'RAISE', 65)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  availability = EXCLUDED.availability,
  required_tier = EXCLUDED.required_tier,
  display_order = EXCLUDED.display_order;

INSERT INTO public.billing_tier_features (tier, feature_key, included)
SELECT tier.tier, 'deck_watermarking', tier.tier_rank >= required.tier_rank
FROM public.tier_limits tier
JOIN public.tier_limits required ON required.tier = 'RAISE'
WHERE tier.tier IN ('FREE', 'PRO', 'PRO_PLUS', 'RAISE')
ON CONFLICT (tier, feature_key) DO UPDATE SET included = EXCLUDED.included;

UPDATE public.billing_feature_catalog
SET description = 'NDA gates, access groups and audit trail.'
WHERE key = 'diligence_controls';

CREATE OR REPLACE FUNCTION public.enforce_deck_feature_entitlements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_access_allowed BOOLEAN := public.has_live_feature_for_user(NEW.user_id, 'access_controls');
  v_download_allowed BOOLEAN := public.has_live_feature_for_user(NEW.user_id, 'deck_downloads');
  v_watermark_allowed BOOLEAN := public.has_live_feature_for_user(NEW.user_id, 'deck_watermarking');
BEGIN
  IF NOT v_access_allowed AND (
    (TG_OP = 'INSERT' AND (NEW.require_email OR NEW.require_password OR NEW.expires_at IS NOT NULL))
    OR (TG_OP = 'UPDATE' AND (
      (NEW.require_email AND NOT OLD.require_email)
      OR (NEW.require_password AND NOT OLD.require_password)
      OR (NEW.expires_at IS NOT NULL AND NEW.expires_at IS DISTINCT FROM OLD.expires_at)
      OR (NEW.require_password AND NEW.view_password IS DISTINCT FROM OLD.view_password)
    ))
  ) THEN
    RAISE EXCEPTION 'Email capture, password protection and expiry require Share or higher';
  END IF;

  IF NOT v_download_allowed AND (
    (TG_OP = 'INSERT' AND NEW.allow_download)
    OR (TG_OP = 'UPDATE' AND NEW.allow_download AND NOT OLD.allow_download)
  ) THEN
    RAISE EXCEPTION 'Download controls require Share or higher';
  END IF;

  IF NOT v_watermark_allowed AND (
    (TG_OP = 'INSERT' AND NEW.watermark_enabled)
    OR (TG_OP = 'UPDATE' AND (
      (NEW.watermark_enabled AND NOT OLD.watermark_enabled)
      OR (NEW.watermark_enabled AND NEW.watermark_text IS DISTINCT FROM OLD.watermark_text)
    ))
  ) THEN
    RAISE EXCEPTION 'Deck watermarking requires the Raise plan';
  END IF;

  IF NEW.watermark_enabled AND COALESCE(NEW.file_type, 'pdf') <> 'pdf' THEN
    RAISE EXCEPTION 'Deck watermarking is currently available for PDF decks only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_deck_feature_entitlements ON public.decks;
CREATE TRIGGER tr_enforce_deck_feature_entitlements
  BEFORE INSERT OR UPDATE OF require_email, require_password, view_password, expires_at, allow_download, watermark_enabled, watermark_text ON public.decks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_deck_feature_entitlements();

CREATE OR REPLACE FUNCTION public.prepare_deck_watermark_artifact()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT NEW.watermark_enabled THEN
    NEW.watermark_status := 'disabled';
    NEW.watermarked_file_path := NULL;
    NEW.watermark_error := NULL;

    IF TG_OP = 'INSERT'
       OR NEW.watermark_enabled IS DISTINCT FROM OLD.watermark_enabled
       OR NEW.watermark_text IS DISTINCT FROM OLD.watermark_text
       OR NEW.watermark_status IS DISTINCT FROM OLD.watermark_status
       OR NEW.watermarked_file_path IS DISTINCT FROM OLD.watermarked_file_path
       OR NEW.watermark_error IS DISTINCT FROM OLD.watermark_error THEN
      NEW.watermark_updated_at := NOW();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.watermark_enabled IS DISTINCT FROM OLD.watermark_enabled
     OR NEW.watermark_text IS DISTINCT FROM OLD.watermark_text
     OR NEW.file_url IS DISTINCT FROM OLD.file_url
     OR NEW.file_type IS DISTINCT FROM OLD.file_type THEN
    NEW.watermark_text := btrim(NEW.watermark_text);
    NEW.watermark_revision := gen_random_uuid();
    NEW.watermark_status := 'pending';
    NEW.watermark_error := NULL;
    NEW.watermark_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_prepare_deck_watermark_artifact ON public.decks;
CREATE TRIGGER tr_prepare_deck_watermark_artifact
  BEFORE INSERT OR UPDATE OF watermark_enabled, watermark_text, file_url, file_type ON public.decks
  FOR EACH ROW EXECUTE FUNCTION public.prepare_deck_watermark_artifact();

DROP FUNCTION IF EXISTS public.create_deck_with_primary_link(
  uuid, text, text, text, text, jsonb, text, text, bigint, text, boolean, boolean, text, timestamptz, boolean
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
  p_page_count integer DEFAULT NULL,
  p_file_type text DEFAULT 'pdf',
  p_require_email boolean DEFAULT false,
  p_require_password boolean DEFAULT false,
  p_view_password text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_allow_download boolean DEFAULT false,
  p_watermark_enabled boolean DEFAULT false,
  p_watermark_text text DEFAULT NULL
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
    file_size, page_count, file_type, require_email, require_password, view_password,
    expires_at, allow_download, watermark_enabled, watermark_text
  ) VALUES (
    p_user_id, p_title, p_slug, p_description, p_file_url, p_pages, p_status,
    p_display_mode, p_file_size, p_page_count, p_file_type, p_require_email,
    p_require_password, p_view_password, p_expires_at, p_allow_download,
    p_watermark_enabled, p_watermark_text
  ) RETURNING * INTO v_deck;

  INSERT INTO public.deck_links (deck_id, link_name, link_alias, is_enabled, is_primary)
  VALUES (v_deck.id, 'Default Link', p_slug, TRUE, TRUE);
  RETURN v_deck;
END;
$$;

REVOKE ALL ON FUNCTION public.create_deck_with_primary_link(
  uuid, text, text, text, text, jsonb, text, text, bigint, integer, text, boolean, boolean, text, timestamptz, boolean, boolean, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_deck_with_primary_link(
  uuid, text, text, text, text, jsonb, text, text, bigint, integer, text, boolean, boolean, text, timestamptz, boolean, boolean, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_deck_payload(
  p_handle TEXT,
  p_slug_or_alias TEXT,
  p_password TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_deck RECORD; v_storage_path TEXT; v_allow_download BOOLEAN; v_watermark_enabled BOOLEAN;
BEGIN
  SELECT d.*, resolved.link_id, dl.link_name, dl.link_alias, dl.is_primary INTO v_deck
  FROM public.resolve_public_deck_link(p_handle, p_slug_or_alias) resolved
  JOIN public.decks d ON d.id = resolved.deck_id
  JOIN public.deck_links dl ON dl.id = resolved.link_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized';
  ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_deck.user_id
    AND v_deck.require_password
    AND NOT public.check_deck_password(p_handle, p_slug_or_alias, p_password) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT v_deck.allow_download AND COALESCE(p.tier, 'FREE') IN ('PRO', 'PRO_PLUS', 'RAISE'),
         v_deck.watermark_enabled AND public.has_live_feature_for_user(v_deck.user_id, 'deck_watermarking')
    INTO v_allow_download, v_watermark_enabled
  FROM public.profiles p WHERE p.id = v_deck.user_id;
  v_storage_path := regexp_replace(v_deck.file_url, '^.*/storage/v1/object/(public|sign|authenticated)/decks/', '');
  RETURN jsonb_build_object(
    'id', v_deck.id, 'storage_path', v_storage_path, 'file_url', v_deck.file_url,
    'pages', v_deck.pages, 'title', v_deck.title, 'file_type', v_deck.file_type,
    'allow_download', COALESCE(v_allow_download, FALSE),
    'watermark_enabled', COALESCE(v_watermark_enabled, FALSE),
    'watermark_text', CASE WHEN v_watermark_enabled THEN v_deck.watermark_text ELSE NULL END,
    'watermark_status', CASE WHEN v_watermark_enabled THEN v_deck.watermark_status ELSE 'disabled' END,
    'deck_link_id', v_deck.link_id, 'deck_link_name', v_deck.link_name,
    'deck_link_alias', v_deck.link_alias, 'deck_link_is_primary', v_deck.is_primary
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
  SELECT dr.* INTO v_room FROM public.data_rooms dr JOIN public.profiles p ON p.id = dr.user_id
  WHERE p.handle = p_handle AND dr.slug = p_slug AND (dr.expires_at IS NULL OR dr.expires_at > NOW());
  IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id AND NOT v_room.is_public THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id
    AND v_room.require_password AND NOT public.check_data_room_password(p_handle, p_slug, p_password) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id, 'data_room_id', v_room.id, 'title', d.title, 'slug', d.slug, 'description', d.description,
    'status', d.status, 'file_type', d.file_type, 'display_mode', d.display_mode, 'file_url', d.file_url,
    'folder_id', drd.folder_id, 'folder_name', drf.name,
    'storage_path', regexp_replace(d.file_url, '^.*/storage/v1/object/(public|sign|authenticated)/decks/', ''),
    'pages', d.pages,
    'allow_download', (d.allow_download AND COALESCE(owner_profile.tier, 'FREE') IN ('PRO', 'PRO_PLUS', 'RAISE')),
    'watermark_enabled', (d.watermark_enabled AND public.has_live_feature_for_user(d.user_id, 'deck_watermarking')),
    'watermark_text', CASE WHEN d.watermark_enabled AND public.has_live_feature_for_user(d.user_id, 'deck_watermarking') THEN d.watermark_text ELSE NULL END,
    'watermark_status', CASE WHEN d.watermark_enabled AND public.has_live_feature_for_user(d.user_id, 'deck_watermarking') THEN d.watermark_status ELSE 'disabled' END
  ) ORDER BY drd.display_order ASC), '[]'::jsonb) INTO v_documents
  FROM public.data_room_documents drd
  JOIN public.decks d ON d.id = drd.deck_id
  JOIN public.profiles owner_profile ON owner_profile.id = d.user_id
  LEFT JOIN public.data_room_folders drf ON drf.id = drd.folder_id
  WHERE drd.data_room_id = v_room.id
    AND d.status <> 'DELETED';
  RETURN v_documents;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_deck_payload(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_room_payload(TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
