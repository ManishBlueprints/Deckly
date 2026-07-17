BEGIN;

CREATE TABLE IF NOT EXISTS public.deck_download_events (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  request_id UUID NOT NULL UNIQUE,
  deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  viewer_email TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('deck_link', 'data_room')),
  -- This deliberately has no FK: the immutable id and snapshots keep deleted-link history useful.
  deck_link_id UUID,
  deck_link_name_snapshot TEXT,
  deck_link_alias_snapshot TEXT,
  deck_link_is_primary_snapshot BOOLEAN,
  data_room_id UUID REFERENCES public.data_rooms(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deck_download_events_source_check CHECK (
    (source_type = 'deck_link' AND deck_link_id IS NOT NULL AND data_room_id IS NULL)
    OR
    (source_type = 'data_room' AND data_room_id IS NOT NULL AND deck_link_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_deck_download_events_deck_time
  ON public.deck_download_events(deck_id, downloaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_deck_download_events_link
  ON public.deck_download_events(deck_id, deck_link_id) WHERE deck_link_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deck_download_events_room
  ON public.deck_download_events(data_room_id, deck_id, downloaded_at DESC) WHERE data_room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deck_download_events_room_visitor
  ON public.deck_download_events(data_room_id, visitor_id) WHERE data_room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deck_download_events_visitor
  ON public.deck_download_events(deck_id, visitor_id);

ALTER TABLE public.deck_download_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view deck download events" ON public.deck_download_events;
CREATE POLICY "Owners can view deck download events" ON public.deck_download_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.decks d
      WHERE d.id = deck_download_events.deck_id AND d.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.data_rooms dr
      WHERE dr.id = deck_download_events.data_room_id AND dr.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.record_deck_download(
  p_request_id UUID,
  p_deck_id UUID,
  p_visitor_id TEXT,
  p_viewer_email TEXT DEFAULT NULL,
  p_deck_link_id UUID DEFAULT NULL,
  p_data_room_id UUID DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_user_id UUID;
  v_link RECORD;
  v_email TEXT;
BEGIN
  IF p_request_id IS NULL OR p_deck_id IS NULL OR trim(COALESCE(p_visitor_id, '')) = '' THEN
    RAISE EXCEPTION 'Invalid download analytics payload';
  END IF;

  SELECT user_id INTO v_owner_user_id FROM public.decks WHERE id = p_deck_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deck not found'; END IF;
  IF p_actor_user_id IS NOT NULL AND p_actor_user_id = v_owner_user_id THEN
    RETURN;
  END IF;

  v_email := NULLIF(lower(trim(COALESCE(p_viewer_email, ''))), '');
  IF v_email IS NOT NULL AND length(v_email) > 320 THEN
    v_email := left(v_email, 320);
  END IF;

  IF p_deck_link_id IS NOT NULL AND p_data_room_id IS NULL THEN
    SELECT id, link_name, link_alias, is_primary INTO v_link
    FROM public.deck_links
    WHERE id = p_deck_link_id AND deck_id = p_deck_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid deck link'; END IF;

    INSERT INTO public.deck_download_events (
      request_id, deck_id, owner_user_id, visitor_id, viewer_email, source_type,
      deck_link_id, deck_link_name_snapshot, deck_link_alias_snapshot,
      deck_link_is_primary_snapshot
    ) VALUES (
      p_request_id, p_deck_id, v_owner_user_id, left(p_visitor_id, 200), v_email,
      'deck_link', v_link.id, v_link.link_name, v_link.link_alias, v_link.is_primary
    ) ON CONFLICT (request_id) DO NOTHING;
  ELSIF p_data_room_id IS NOT NULL AND p_deck_link_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.data_room_documents
      WHERE data_room_id = p_data_room_id AND deck_id = p_deck_id
    ) THEN RAISE EXCEPTION 'Deck is not in data room'; END IF;

    INSERT INTO public.deck_download_events (
      request_id, deck_id, owner_user_id, visitor_id, viewer_email, source_type, data_room_id
    ) VALUES (
      p_request_id, p_deck_id, v_owner_user_id, left(p_visitor_id, 200), v_email,
      'data_room', p_data_room_id
    ) ON CONFLICT (request_id) DO NOTHING;
  ELSE
    RAISE EXCEPTION 'Download source must be a deck link or data room';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_deck_download(UUID, UUID, TEXT, TEXT, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_deck_download(UUID, UUID, TEXT, TEXT, UUID, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_deck_download_analytics(p_deck_id UUID, p_limit INTEGER DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB; v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 250);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.decks WHERE id = p_deck_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  WITH events AS (
    SELECT * FROM public.deck_download_events WHERE deck_id = p_deck_id
  ), summary AS (
    SELECT count(*)::int AS total_downloads,
      count(DISTINCT visitor_id)::int AS unique_downloaders,
      count(*) FILTER (WHERE source_type = 'deck_link')::int AS direct_link_downloads,
      count(*) FILTER (WHERE source_type = 'data_room')::int AS data_room_downloads
    FROM events
  ), links AS (
    SELECT e.deck_link_id AS link_id,
      COALESCE(dl.link_name, e.deck_link_name_snapshot, 'Deleted link') AS link_name,
      COALESCE(dl.link_alias, e.deck_link_alias_snapshot) AS link_alias,
      COALESCE(dl.is_primary, e.deck_link_is_primary_snapshot, FALSE) AS is_primary,
      COALESCE(dl.is_enabled, FALSE) AS is_enabled,
      count(*)::int AS total_downloads,
      count(DISTINCT e.visitor_id)::int AS unique_downloaders,
      max(e.downloaded_at) AS latest_download_at
    FROM events e
    LEFT JOIN public.deck_links dl ON dl.id = e.deck_link_id
    WHERE e.source_type = 'deck_link'
    GROUP BY e.deck_link_id, dl.link_name, dl.link_alias, dl.is_primary, dl.is_enabled,
      e.deck_link_name_snapshot, e.deck_link_alias_snapshot, e.deck_link_is_primary_snapshot
  ), rooms AS (
    SELECT e.data_room_id, COALESCE(dr.name, 'Deleted data room') AS room_name,
      count(*)::int AS total_downloads, count(DISTINCT e.visitor_id)::int AS unique_downloaders,
      max(e.downloaded_at) AS latest_download_at
    FROM events e LEFT JOIN public.data_rooms dr ON dr.id = e.data_room_id
    WHERE e.source_type = 'data_room'
    GROUP BY e.data_room_id, dr.name
  ), downloaders AS (
    SELECT visitor_id, max(viewer_email) FILTER (WHERE viewer_email IS NOT NULL) AS viewer_email,
      count(*)::int AS total_downloads, max(downloaded_at) AS latest_download_at
    FROM events GROUP BY visitor_id
    ORDER BY total_downloads DESC, latest_download_at DESC
    LIMIT v_limit
  )
  SELECT jsonb_build_object(
    'total_downloads', (SELECT total_downloads FROM summary),
    'unique_downloaders', (SELECT unique_downloaders FROM summary),
    'direct_link_downloads', (SELECT direct_link_downloads FROM summary),
    'data_room_downloads', (SELECT data_room_downloads FROM summary),
    'links', COALESCE((SELECT jsonb_agg(to_jsonb(links) ORDER BY total_downloads DESC, latest_download_at DESC) FROM links), '[]'::jsonb),
    'data_rooms', COALESCE((SELECT jsonb_agg(to_jsonb(rooms) ORDER BY total_downloads DESC, latest_download_at DESC) FROM rooms), '[]'::jsonb),
    'downloaders', COALESCE((SELECT jsonb_agg(to_jsonb(downloaders) ORDER BY total_downloads DESC, latest_download_at DESC) FROM downloaders), '[]'::jsonb),
    'downloaders_truncated', (SELECT unique_downloaders > v_limit FROM summary)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS public.get_data_room_download_analytics(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.get_data_room_download_analytics(
  p_data_room_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
  v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.data_rooms WHERE id = p_data_room_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  WITH events AS (
    SELECT * FROM public.deck_download_events WHERE data_room_id = p_data_room_id
  ), room_documents AS (
    SELECT deck_id FROM public.data_room_documents WHERE data_room_id = p_data_room_id
  ), summary AS (
    SELECT count(*)::int AS total_downloads, count(DISTINCT visitor_id)::int AS unique_downloaders FROM events
  ), documents AS (
    SELECT COALESCE(rd.deck_id, e.deck_id) AS deck_id,
      COALESCE(d.title, 'Deleted deck') AS title,
      count(e.id)::int AS total_downloads,
      count(DISTINCT e.visitor_id)::int AS unique_downloaders,
      max(e.downloaded_at) AS latest_download_at
    FROM room_documents rd
    FULL OUTER JOIN events e ON e.deck_id = rd.deck_id
    LEFT JOIN public.decks d ON d.id = COALESCE(rd.deck_id, e.deck_id)
    GROUP BY COALESCE(rd.deck_id, e.deck_id), d.title
  ), downloader_summaries AS (
    SELECT visitor_id,
      max(viewer_email) FILTER (WHERE viewer_email IS NOT NULL) AS viewer_email,
      count(*)::int AS total_downloads,
      max(downloaded_at) AS latest_download_at
    FROM events
    GROUP BY visitor_id
  ), paged_downloaders AS (
    SELECT * FROM downloader_summaries
    ORDER BY total_downloads DESC, latest_download_at DESC, visitor_id ASC
    LIMIT v_limit OFFSET v_offset
  ), downloader_document_summaries AS (
    SELECT e.visitor_id, e.deck_id, COALESCE(d.title, 'Deleted deck') AS title,
      count(*)::int AS total_downloads, 1::int AS unique_downloaders,
      max(e.downloaded_at) AS latest_download_at
    FROM events e
    JOIN paged_downloaders pd ON pd.visitor_id = e.visitor_id
    LEFT JOIN public.decks d ON d.id = e.deck_id
    GROUP BY e.visitor_id, e.deck_id, d.title
  ), downloader_documents AS (
    SELECT visitor_id,
      jsonb_agg(jsonb_build_object(
        'deck_id', deck_id, 'title', title, 'total_downloads', total_downloads,
        'unique_downloaders', unique_downloaders, 'latest_download_at', latest_download_at
      ) ORDER BY total_downloads DESC, latest_download_at DESC, deck_id ASC) AS downloaded_documents
    FROM downloader_document_summaries
    GROUP BY visitor_id
  ), downloaders AS (
    SELECT pd.visitor_id, pd.viewer_email, pd.total_downloads, pd.latest_download_at,
      COALESCE(dd.downloaded_documents, '[]'::jsonb) AS downloaded_documents
    FROM paged_downloaders pd
    LEFT JOIN downloader_documents dd ON dd.visitor_id = pd.visitor_id
  )
  SELECT jsonb_build_object(
    'total_downloads', (SELECT total_downloads FROM summary),
    'unique_downloaders', (SELECT unique_downloaders FROM summary),
    'documents', COALESCE((SELECT jsonb_agg(to_jsonb(documents) ORDER BY total_downloads DESC, latest_download_at DESC, deck_id ASC) FROM documents), '[]'::jsonb),
    'downloaders', COALESCE((SELECT jsonb_agg(to_jsonb(downloaders) ORDER BY total_downloads DESC, latest_download_at DESC, visitor_id ASC) FROM downloaders), '[]'::jsonb),
    'downloaders_truncated', (SELECT unique_downloaders > v_offset + v_limit FROM summary)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_deck_download_analytics(UUID, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_data_room_download_analytics(UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_deck_download_analytics(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_room_download_analytics(UUID, INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- The signing function receives trusted attribution context from these payloads.
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

  SELECT v_deck.allow_download AND COALESCE(p.tier, 'FREE') IN ('PRO', 'PRO_PLUS', 'RAISE')
    INTO v_allow_download FROM public.profiles p WHERE p.id = v_deck.user_id;
  v_storage_path := regexp_replace(v_deck.file_url, '^.*/storage/v1/object/(public|sign|authenticated)/decks/', '');
  RETURN jsonb_build_object(
    'id', v_deck.id,
    'storage_path', v_storage_path, 'file_url', v_deck.file_url,
    'pages', v_deck.pages, 'title', v_deck.title, 'file_type', v_deck.file_type,
    'allow_download', COALESCE(v_allow_download, FALSE),
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
    'id', d.id, 'data_room_id', v_room.id,
    'title', d.title, 'slug', d.slug, 'description', d.description,
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

GRANT EXECUTE ON FUNCTION public.get_deck_payload(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_room_payload(TEXT, TEXT, TEXT) TO anon, authenticated;

COMMIT;
