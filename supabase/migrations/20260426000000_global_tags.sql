-- Canonical global tags with alias compatibility for legacy tag rows.

CREATE TABLE IF NOT EXISTS public.global_tags (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(btrim(name)) > 0),
    color TEXT NOT NULL DEFAULT '#666666',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_tags_user_name_unique
    ON public.global_tags (user_id, lower(btrim(name)))
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_global_tags_user
    ON public.global_tags (user_id);

CREATE TABLE IF NOT EXISTS public.global_tag_aliases (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alias_type TEXT NOT NULL CHECK (alias_type IN ('legacy_name', 'legacy_id')),
    alias_value TEXT NOT NULL,
    tag_id UUID NOT NULL REFERENCES public.global_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_tag_aliases_unique
    ON public.global_tag_aliases (user_id, alias_type, alias_value);

CREATE INDEX IF NOT EXISTS idx_global_tag_aliases_tag
    ON public.global_tag_aliases (tag_id);

ALTER TABLE public.global_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_tag_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read global tags" ON public.global_tags;
DROP POLICY IF EXISTS "Users can insert global tags" ON public.global_tags;
DROP POLICY IF EXISTS "Users can update global tags" ON public.global_tags;
DROP POLICY IF EXISTS "Users can delete global tags" ON public.global_tags;

CREATE POLICY "Users can read global tags" ON public.global_tags
    FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert global tags" ON public.global_tags
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update global tags" ON public.global_tags
    FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete global tags" ON public.global_tags
    FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read global tag aliases" ON public.global_tag_aliases;
DROP POLICY IF EXISTS "Users can insert global tag aliases" ON public.global_tag_aliases;
DROP POLICY IF EXISTS "Users can update global tag aliases" ON public.global_tag_aliases;
DROP POLICY IF EXISTS "Users can delete global tag aliases" ON public.global_tag_aliases;

CREATE POLICY "Users can read global tag aliases" ON public.global_tag_aliases
    FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert global tag aliases" ON public.global_tag_aliases
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update global tag aliases" ON public.global_tag_aliases
    FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete global tag aliases" ON public.global_tag_aliases
    FOR DELETE USING ((select auth.uid()) = user_id);

INSERT INTO public.global_tags (id, user_id, name, color, created_at, updated_at, deleted_at)
SELECT
    lt.id,
    lt.user_id,
    btrim(lt.name),
    lt.color,
    COALESCE(lt.created_at::timestamptz, now()),
    COALESCE(lt.created_at::timestamptz, now()),
    NULL::timestamptz
FROM public.library_tags lt
ON CONFLICT (id) DO UPDATE
SET
    user_id = EXCLUDED.user_id,
    name = EXCLUDED.name,
    color = EXCLUDED.color,
    updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at;

DROP TABLE IF EXISTS room_tag_map;

CREATE TEMP TABLE room_tag_map ON COMMIT DROP AS
WITH room_tag_sources AS (
    SELECT
        drt.id AS source_tag_id,
        dr.user_id,
        lower(btrim(drt.name)) AS normalized_name,
        btrim(drt.name) AS source_name,
        drt.color,
        drt.created_at,
        drt.updated_at,
        lt.id AS library_tag_id,
        first_value(drt.id) OVER (
            PARTITION BY dr.user_id, lower(btrim(drt.name))
            ORDER BY drt.created_at, drt.id
        ) AS first_room_tag_id,
        first_value(btrim(drt.name)) OVER (
            PARTITION BY dr.user_id, lower(btrim(drt.name))
            ORDER BY drt.created_at, drt.id
        ) AS canonical_room_name,
        first_value(drt.color) OVER (
            PARTITION BY dr.user_id, lower(btrim(drt.name))
            ORDER BY drt.created_at, drt.id
        ) AS canonical_room_color
    FROM public.data_room_tags drt
    JOIN public.data_rooms dr ON dr.id = drt.data_room_id
    LEFT JOIN public.library_tags lt
        ON lt.user_id = dr.user_id
       AND lower(btrim(lt.name)) = lower(btrim(drt.name))
)
SELECT DISTINCT
    source_tag_id,
    user_id,
    normalized_name,
    source_name,
    COALESCE(library_tag_id, first_room_tag_id) AS canonical_tag_id,
    CASE
        WHEN library_tag_id IS NOT NULL THEN btrim(source_name)
        ELSE canonical_room_name
    END AS canonical_name,
    CASE
        WHEN library_tag_id IS NOT NULL THEN color
        ELSE canonical_room_color
    END AS canonical_color
FROM room_tag_sources;
INSERT INTO public.global_tags (id, user_id, name, color, created_at, updated_at, deleted_at)
SELECT DISTINCT
    canonical_tag_id,
    user_id,
    canonical_name,
    canonical_color,
    COALESCE((SELECT MIN(created_at)::timestamptz FROM public.data_room_tags drt2 WHERE drt2.id = room_tag_map.canonical_tag_id), now()),
    COALESCE((SELECT MIN(updated_at)::timestamptz FROM public.data_room_tags drt3 WHERE drt3.id = room_tag_map.canonical_tag_id), now()),
    NULL::timestamptz
FROM room_tag_map
WHERE source_tag_id = canonical_tag_id
  AND NOT EXISTS (
      SELECT 1
      FROM public.global_tags gt
      WHERE gt.id = room_tag_map.canonical_tag_id
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.global_tag_aliases (user_id, alias_type, alias_value, tag_id, created_at, updated_at)
SELECT DISTINCT
    user_id,
    'legacy_id',
    source_tag_id::text,
    canonical_tag_id,
    now(),
    now()
FROM room_tag_map
WHERE source_tag_id <> canonical_tag_id
ON CONFLICT (user_id, alias_type, alias_value) DO UPDATE
SET tag_id = EXCLUDED.tag_id,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.global_tag_aliases (user_id, alias_type, alias_value, tag_id, created_at, updated_at)
SELECT DISTINCT
    user_id,
    'legacy_name',
    normalized_name,
    canonical_tag_id,
    now(),
    now()
FROM room_tag_map
WHERE source_tag_id <> canonical_tag_id
ON CONFLICT (user_id, alias_type, alias_value) DO UPDATE
SET tag_id = EXCLUDED.tag_id,
    updated_at = EXCLUDED.updated_at;

WITH folder_tag_candidates AS (
    SELECT
        folder_tag.ctid,
        row_number() OVER (
            PARTITION BY
                folder_tag.folder_id,
                COALESCE(room_tag_map.canonical_tag_id, folder_tag.tag_id)
            ORDER BY
                CASE
                    WHEN room_tag_map.canonical_tag_id IS NULL THEN 0
                    ELSE 1
                END,
                folder_tag.tag_id
        ) AS duplicate_rank
    FROM public.data_room_folder_tags folder_tag
    LEFT JOIN room_tag_map
        ON folder_tag.tag_id = room_tag_map.source_tag_id
       AND room_tag_map.source_tag_id <> room_tag_map.canonical_tag_id
)
DELETE FROM public.data_room_folder_tags folder_tag
USING folder_tag_candidates
WHERE folder_tag.ctid = folder_tag_candidates.ctid
  AND folder_tag_candidates.duplicate_rank > 1;

UPDATE public.data_room_folder_tags folder_tag
SET tag_id = room_tag_map.canonical_tag_id
FROM room_tag_map
WHERE folder_tag.tag_id = room_tag_map.source_tag_id
  AND room_tag_map.source_tag_id <> room_tag_map.canonical_tag_id;

WITH document_tag_candidates AS (
    SELECT
        document_tag.ctid,
        row_number() OVER (
            PARTITION BY
                document_tag.document_id,
                COALESCE(room_tag_map.canonical_tag_id, document_tag.tag_id)
            ORDER BY
                CASE
                    WHEN room_tag_map.canonical_tag_id IS NULL THEN 0
                    ELSE 1
                END,
                document_tag.tag_id
        ) AS duplicate_rank
    FROM public.data_room_document_tags document_tag
    LEFT JOIN room_tag_map
        ON document_tag.tag_id = room_tag_map.source_tag_id
       AND room_tag_map.source_tag_id <> room_tag_map.canonical_tag_id
)
DELETE FROM public.data_room_document_tags document_tag
USING document_tag_candidates
WHERE document_tag.ctid = document_tag_candidates.ctid
  AND document_tag_candidates.duplicate_rank > 1;

UPDATE public.data_room_document_tags document_tag
SET tag_id = room_tag_map.canonical_tag_id
FROM room_tag_map
WHERE document_tag.tag_id = room_tag_map.source_tag_id
  AND room_tag_map.source_tag_id <> room_tag_map.canonical_tag_id;

ALTER TABLE public.library_folder_tags
    DROP CONSTRAINT IF EXISTS library_folder_tags_tag_id_fkey;
ALTER TABLE public.library_folder_tags
    ADD CONSTRAINT library_folder_tags_tag_id_fkey
    FOREIGN KEY (tag_id) REFERENCES public.global_tags(id) ON DELETE CASCADE;

ALTER TABLE public.library_deck_tags
    DROP CONSTRAINT IF EXISTS library_deck_tags_tag_id_fkey;
ALTER TABLE public.library_deck_tags
    ADD CONSTRAINT library_deck_tags_tag_id_fkey
    FOREIGN KEY (tag_id) REFERENCES public.global_tags(id) ON DELETE CASCADE;

ALTER TABLE public.library_data_room_tags
    DROP CONSTRAINT IF EXISTS library_data_room_tags_tag_id_fkey;
ALTER TABLE public.library_data_room_tags
    ADD CONSTRAINT library_data_room_tags_tag_id_fkey
    FOREIGN KEY (tag_id) REFERENCES public.global_tags(id) ON DELETE CASCADE;

ALTER TABLE public.data_room_folder_tags
    DROP CONSTRAINT IF EXISTS data_room_folder_tags_tag_id_fkey;
ALTER TABLE public.data_room_folder_tags
    ADD CONSTRAINT data_room_folder_tags_tag_id_fkey
    FOREIGN KEY (tag_id) REFERENCES public.global_tags(id) ON DELETE CASCADE;

ALTER TABLE public.data_room_document_tags
    DROP CONSTRAINT IF EXISTS data_room_document_tags_tag_id_fkey;
ALTER TABLE public.data_room_document_tags
    ADD CONSTRAINT data_room_document_tags_tag_id_fkey
    FOREIGN KEY (tag_id) REFERENCES public.global_tags(id) ON DELETE CASCADE;
