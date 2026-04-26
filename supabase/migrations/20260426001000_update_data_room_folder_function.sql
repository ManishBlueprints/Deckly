-- Make the data room folder RPC consume global tags instead of room-local tags.

CREATE OR REPLACE FUNCTION public.create_data_room_folder(
    p_room_id uuid,
    p_name text,
    p_color text,
    p_tag_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_room record;
    v_folder record;
    v_user_tier text;
    v_clean_name text := btrim(p_name);
    v_clean_color text := COALESCE(NULLIF(btrim(p_color), ''), 'slate');
    v_tag_ids uuid[] := ARRAY(
        SELECT DISTINCT unnest(COALESCE(p_tag_ids, '{}'::uuid[]))
    );
    v_folder_count integer := 0;
    v_next_position text;
    v_inserted_tag_count integer := 0;
BEGIN
    SELECT * INTO v_room
    FROM public.data_rooms
    WHERE id = p_room_id
    FOR UPDATE;

    IF NOT FOUND OR v_room.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF char_length(v_clean_name) = 0 THEN
        RAISE EXCEPTION 'Folder name cannot be empty.';
    ELSIF char_length(v_clean_name) > 50 THEN
        RAISE EXCEPTION 'Folder name must be 50 characters or less.';
    END IF;

    SELECT COALESCE((SELECT tier FROM public.profiles WHERE id = auth.uid()), 'FREE')
    INTO v_user_tier;

    SELECT count(*)::integer
    INTO v_folder_count
    FROM public.data_room_folders
    WHERE data_room_id = p_room_id;

    IF v_user_tier = 'FREE' AND v_folder_count >= 1 THEN
        RAISE EXCEPTION 'Free plans allow up to 1 folder per room.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.data_room_folders
        WHERE data_room_id = p_room_id
          AND lower(btrim(name)) = lower(v_clean_name)
    ) THEN
        RAISE EXCEPTION 'A folder with that name already exists in this room.';
    END IF;

    SELECT lpad((COALESCE(MAX(position::bigint), 0) + 1)::text, 8, '0')
    INTO v_next_position
    FROM public.data_room_folders
    WHERE data_room_id = p_room_id;

    INSERT INTO public.data_room_folders (
        data_room_id,
        name,
        color,
        position,
        created_by,
        updated_by
    ) VALUES (
        p_room_id,
        v_clean_name,
        v_clean_color,
        v_next_position,
        auth.uid(),
        NULL
    )
    RETURNING * INTO v_folder;

    IF cardinality(v_tag_ids) > 0 THEN
        WITH inserted_tags AS (
            INSERT INTO public.data_room_folder_tags (folder_id, tag_id)
            SELECT v_folder.id, tag.id
            FROM public.global_tags tag
            WHERE tag.user_id = v_room.user_id
              AND tag.deleted_at IS NULL
              AND tag.id = ANY(v_tag_ids)
            RETURNING tag_id
        )
        SELECT count(*)::integer INTO v_inserted_tag_count FROM inserted_tags;

        IF v_inserted_tag_count <> cardinality(v_tag_ids) THEN
            RAISE EXCEPTION 'One or more tags were not found.';
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'id', v_folder.id,
        'data_room_id', v_folder.data_room_id,
        'name', v_folder.name,
        'color', v_folder.color,
        'position', v_folder.position,
        'created_by', v_folder.created_by,
        'updated_by', v_folder.updated_by,
        'created_at', v_folder.created_at,
        'updated_at', v_folder.updated_at,
        'tags', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', tag.id,
                        'name', tag.name,
                        'color', tag.color,
                        'created_at', tag.created_at,
                        'updated_at', tag.updated_at,
                        'deleted_at', tag.deleted_at
                    )
                    ORDER BY tag.name
                )
                FROM public.data_room_folder_tags folder_tag
                JOIN public.global_tags tag ON tag.id = folder_tag.tag_id
                WHERE folder_tag.folder_id = v_folder.id
            ),
            '[]'::jsonb
        )
    );
END;
$$;
