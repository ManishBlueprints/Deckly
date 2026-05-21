-- Make data room slugs unique per owner instead of globally.
ALTER TABLE public.data_rooms
  DROP CONSTRAINT IF EXISTS data_rooms_slug_key;

ALTER TABLE public.data_rooms
  ADD CONSTRAINT data_rooms_user_id_slug_key UNIQUE (user_id, slug);

DROP FUNCTION IF EXISTS public.check_data_room_password(text, text);
DROP FUNCTION IF EXISTS public.get_data_room_payload(text, text);

CREATE OR REPLACE FUNCTION public.check_data_room_password(
    p_handle text,
    p_slug text,
    p_password text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
    v_hashed_pw text;
    v_ip text := current_setting('request.headers', true)::json->>'x-forwarded-for';
    v_rate_limit_key text := concat(COALESCE(p_handle, ''), '/room/', p_slug);
BEGIN
    SELECT dr.view_password INTO v_hashed_pw
    FROM public.data_rooms dr
    JOIN public.profiles p ON p.id = dr.user_id
    WHERE p.handle = p_handle
      AND dr.slug = p_slug
      AND (dr.expires_at IS NULL OR dr.expires_at > NOW());
    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF v_hashed_pw IS NULL THEN RETURN TRUE; END IF;
    IF v_ip IS NOT NULL AND trim(v_ip) != '' THEN v_ip := trim(split_part(v_ip, ',', 1)); END IF;
    IF v_ip IS NULL OR trim(v_ip) = '' THEN v_ip := COALESCE(inet_client_addr()::text, 'local'); END IF;
    IF NOT public.check_rate_limit(v_ip, v_rate_limit_key) THEN
        RAISE EXCEPTION 'Too many failed attempts. Please try again later.';
    END IF;
    IF v_hashed_pw = crypt(p_password, v_hashed_pw) THEN
        PERFORM public.clear_rate_limit(v_ip, v_rate_limit_key); RETURN TRUE;
    END IF;
    PERFORM public.record_failed_attempt(v_ip, v_rate_limit_key); RETURN FALSE;
END; $$;

CREATE OR REPLACE FUNCTION public.get_data_room_payload(
    p_handle text,
    p_slug text,
    p_password text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
    v_room record;
    v_documents jsonb;
BEGIN
    SELECT dr.* INTO v_room
    FROM public.data_rooms dr
    JOIN public.profiles p ON p.id = dr.user_id
    WHERE p.handle = p_handle
      AND dr.slug = p_slug
      AND (dr.expires_at IS NULL OR dr.expires_at > NOW());
    IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id
       AND NOT v_room.is_public THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id
       AND v_room.require_password
       AND NOT public.check_data_room_password(p_handle, p_slug, p_password) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', d.id, 'title', d.title, 'slug', d.slug, 'description', d.description,
            'status', d.status, 'file_type', d.file_type, 'display_mode', d.display_mode,
            'file_url', d.file_url,
            'folder_id', drd.folder_id,
            'folder_name', drf.name,
            'storage_path', regexp_replace(
                d.file_url, '^.*/storage/v1/object/(public|sign|authenticated)/decks/', ''
            ),
            'pages', d.pages
        ) ORDER BY drd.display_order ASC
    ), '[]'::jsonb) INTO v_documents
    FROM public.data_room_documents drd
    JOIN public.decks d ON d.id = drd.deck_id
    LEFT JOIN public.data_room_folders drf ON drf.id = drd.folder_id
    WHERE drd.data_room_id = v_room.id;
    RETURN v_documents;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_data_room_payload(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_data_room_password(text, text, text) TO anon, authenticated;
