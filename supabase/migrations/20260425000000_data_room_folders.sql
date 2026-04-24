-- Data Room folder foundation
-- Phase 1: schema, constraints, and lookup support

CREATE TABLE IF NOT EXISTS "public"."data_room_folders" (
    "id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    "data_room_id" uuid NOT NULL REFERENCES public.data_rooms(id) ON DELETE CASCADE,
    "name" text NOT NULL,
    "color" text NOT NULL DEFAULT 'slate',
    "position" text NOT NULL,
    "created_by" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "updated_by" uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "data_room_folders_name_not_blank" CHECK (char_length(btrim("name")) > 0),
    CONSTRAINT "data_room_folders_name_max_length" CHECK (char_length(btrim("name")) <= 50)
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_data_room_folders_room_name_unique"
    ON "public"."data_room_folders" ("data_room_id", lower(btrim("name")));

CREATE INDEX IF NOT EXISTS "idx_data_room_folders_room"
    ON "public"."data_room_folders" ("data_room_id");

CREATE INDEX IF NOT EXISTS "idx_data_room_folders_room_position"
    ON "public"."data_room_folders" ("data_room_id", "position");

CREATE OR REPLACE FUNCTION public.set_data_room_folder_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "tr_set_data_room_folder_audit_fields" ON "public"."data_room_folders";
CREATE TRIGGER "tr_set_data_room_folder_audit_fields"
    BEFORE UPDATE ON "public"."data_room_folders"
    FOR EACH ROW
    EXECUTE FUNCTION public.set_data_room_folder_audit_fields();

ALTER TABLE "public"."data_room_documents"
    ADD COLUMN IF NOT EXISTS "folder_id" uuid NULL;

ALTER TABLE "public"."data_room_documents"
    DROP CONSTRAINT IF EXISTS "data_room_documents_folder_id_fkey";

ALTER TABLE "public"."data_room_documents"
    ADD CONSTRAINT "data_room_documents_folder_id_fkey"
    FOREIGN KEY ("folder_id")
    REFERENCES public.data_room_folders(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_data_room_documents_folder"
    ON "public"."data_room_documents" ("folder_id");

CREATE TABLE IF NOT EXISTS "public"."data_room_tags" (
    "id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    "data_room_id" uuid NOT NULL REFERENCES public.data_rooms(id) ON DELETE CASCADE,
    "name" text NOT NULL,
    "color" text NOT NULL DEFAULT 'slate',
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "data_room_tags_name_not_blank" CHECK (char_length(btrim("name")) > 0),
    CONSTRAINT "data_room_tags_name_max_length" CHECK (char_length(btrim("name")) <= 20)
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_data_room_tags_room_name_unique"
    ON "public"."data_room_tags" ("data_room_id", lower(btrim("name")));

CREATE INDEX IF NOT EXISTS "idx_data_room_tags_room"
    ON "public"."data_room_tags" ("data_room_id");

CREATE TABLE IF NOT EXISTS "public"."data_room_folder_tags" (
    "folder_id" uuid NOT NULL REFERENCES public.data_room_folders(id) ON DELETE CASCADE,
    "tag_id" uuid NOT NULL REFERENCES public.data_room_tags(id) ON DELETE CASCADE,
    PRIMARY KEY ("folder_id", "tag_id")
);

CREATE INDEX IF NOT EXISTS "idx_data_room_folder_tags_tag"
    ON "public"."data_room_folder_tags" ("tag_id");

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
            FROM public.data_room_tags tag
            WHERE tag.data_room_id = p_room_id
              AND tag.id = ANY(v_tag_ids)
            RETURNING tag_id
        )
        SELECT count(*)::integer INTO v_inserted_tag_count FROM inserted_tags;

        IF v_inserted_tag_count <> cardinality(v_tag_ids) THEN
            RAISE EXCEPTION 'One or more tags were not found in this room.';
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
                        'data_room_id', tag.data_room_id,
                        'name', tag.name,
                        'color', tag.color,
                        'created_at', tag.created_at,
                        'updated_at', tag.updated_at
                    )
                    ORDER BY tag.name
                )
                FROM public.data_room_folder_tags folder_tag
                JOIN public.data_room_tags tag ON tag.id = folder_tag.tag_id
                WHERE folder_tag.folder_id = v_folder.id
            ),
            '[]'::jsonb
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_data_room_folders(
    p_room_id uuid,
    p_ordered_folder_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_room record;
    v_current_ids uuid[];
    v_requested_ids uuid[] := ARRAY(
        SELECT unnest(COALESCE(p_ordered_folder_ids, '{}'::uuid[]))
    );
    v_distinct_requested_ids uuid[] := ARRAY(
        SELECT DISTINCT unnest(COALESCE(p_ordered_folder_ids, '{}'::uuid[]))
    );
BEGIN
    SELECT * INTO v_room
    FROM public.data_rooms
    WHERE id = p_room_id
    FOR UPDATE;

    IF NOT FOUND OR v_room.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT array_agg(id ORDER BY position)
    INTO v_current_ids
    FROM public.data_room_folders
    WHERE data_room_id = p_room_id;

    IF COALESCE(cardinality(v_requested_ids), 0) <> COALESCE(cardinality(v_distinct_requested_ids), 0)
       OR COALESCE(cardinality(v_current_ids), 0) <> COALESCE(cardinality(v_distinct_requested_ids), 0)
       OR EXISTS (
           SELECT 1
           FROM unnest(COALESCE(v_current_ids, '{}'::uuid[])) AS current_id
           WHERE current_id <> ALL(v_distinct_requested_ids)
       ) THEN
        RAISE EXCEPTION 'The folder order does not match the current room folders.';
    END IF;

    WITH ordered AS (
        SELECT folder_id, ordinality AS sort_order
        FROM unnest(v_requested_ids) WITH ORDINALITY AS u(folder_id, ordinality)
    )
    UPDATE public.data_room_folders folder
    SET position = lpad(ordered.sort_order::text, 8, '0')
    FROM ordered
    WHERE folder.id = ordered.folder_id
      AND folder.data_room_id = p_room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_data_room_folder(uuid, text, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_data_room_folders(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_data_room_payload(p_slug text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_room record;
    v_documents jsonb;
BEGIN
    SELECT * INTO v_room
    FROM public.data_rooms
    WHERE slug = p_slug
      AND (expires_at IS NULL OR expires_at > NOW());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id
          AND NOT v_room.is_public THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id
          AND v_room.require_password
          AND NOT public.check_data_room_password(p_slug, p_password) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', d.id,
            'title', d.title,
            'slug', d.slug,
            'description', d.description,
            'status', d.status,
            'file_type', d.file_type,
            'display_mode', d.display_mode,
            'file_url', d.file_url,
            'folder_id', drd.folder_id,
            'folder_name', drf.name,
            'storage_path', regexp_replace(
                d.file_url,
                '^.*/storage/v1/object/(public|sign|authenticated)/decks/',
                ''
            ),
            'pages', d.pages
        ) ORDER BY drd.display_order ASC
    ), '[]'::jsonb) INTO v_documents
    FROM public.data_room_documents drd
    JOIN public.decks d ON d.id = drd.deck_id
    LEFT JOIN public.data_room_folders drf ON drf.id = drd.folder_id
    WHERE drd.data_room_id = v_room.id;

    RETURN v_documents;
END;
$$;
