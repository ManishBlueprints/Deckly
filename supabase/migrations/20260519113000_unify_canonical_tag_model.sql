BEGIN;

INSERT INTO public.deck_tags (deck_id, tag_id, created_at, updated_at)
SELECT DISTINCT
    il.deck_id,
    ldt.tag_id,
    COALESCE(il.created_at, now()),
    COALESCE(il.created_at, now())
FROM public.investor_library il
JOIN public.library_deck_tags ldt
    ON ldt.library_id = il.id
JOIN public.decks d
    ON d.id = il.deck_id
JOIN public.global_tags gt
    ON gt.id = ldt.tag_id
   AND gt.user_id = d.user_id
   AND gt.deleted_at IS NULL
ON CONFLICT (deck_id, tag_id) DO NOTHING;

INSERT INTO public.deck_tags (deck_id, tag_id, created_at, updated_at)
SELECT DISTINCT
    drd.deck_id,
    drdt.tag_id,
    now(),
    now()
FROM public.data_room_documents drd
JOIN public.data_room_document_tags drdt
    ON drdt.document_id = drd.id
JOIN public.decks d
    ON d.id = drd.deck_id
JOIN public.global_tags gt
    ON gt.id = drdt.tag_id
   AND gt.user_id = d.user_id
   AND gt.deleted_at IS NULL
ON CONFLICT (deck_id, tag_id) DO NOTHING;

DROP FUNCTION IF EXISTS public.get_library_deck_metadata(UUID[]);

CREATE FUNCTION public.get_library_deck_metadata(
    p_deck_ids UUID[]
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    title text,
    slug text,
    description text,
    status text,
    file_type text,
    display_mode text,
    user_handle text,
    tags jsonb
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
    d.file_type,
    d.display_mode,
    p.handle AS user_handle,
    COALESCE((
        SELECT jsonb_agg(tag_row.tag ORDER BY tag_row.name)
        FROM (
            SELECT DISTINCT
                gt.name,
                jsonb_build_object(
                    'id', gt.id,
                    'name', gt.name,
                    'color', gt.color,
                    'deleted_at', gt.deleted_at,
                    'created_at', gt.created_at,
                    'updated_at', gt.updated_at
                ) AS tag
            FROM public.deck_tags dt
            JOIN public.global_tags gt
                ON gt.id = dt.tag_id
            WHERE dt.deck_id = d.id
              AND gt.deleted_at IS NULL
        ) AS tag_row
    ), '[]'::jsonb) AS tags
FROM public.decks d
JOIN public.profiles p
    ON p.id = d.user_id
WHERE d.id = ANY(COALESCE(p_deck_ids, ARRAY[]::uuid[]))
  AND (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) = d.user_id
    OR (
      d.status <> 'DELETED'
      AND (d.expires_at IS NULL OR d.expires_at > NOW())
      AND EXISTS (
        SELECT 1
        FROM public.deck_links dl
        WHERE dl.deck_id = d.id
          AND dl.is_primary = TRUE
          AND dl.is_enabled = TRUE
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_library_deck_metadata(UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_saved_room_library_tags(
    p_saved_room_ids UUID[]
)
RETURNS TABLE (
    saved_room_id uuid,
    tags jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
    sdr.id AS saved_room_id,
    COALESCE((
        SELECT jsonb_agg(tag_row.tag ORDER BY tag_row.name)
        FROM (
            SELECT DISTINCT
                gt.name,
                jsonb_build_object(
                    'id', gt.id,
                    'name', gt.name,
                    'color', gt.color,
                    'deleted_at', gt.deleted_at,
                    'created_at', gt.created_at,
                    'updated_at', gt.updated_at
                ) AS tag
            FROM public.data_room_documents drd
            JOIN public.deck_tags dt
                ON dt.deck_id = drd.deck_id
            JOIN public.global_tags gt
                ON gt.id = dt.tag_id
            WHERE drd.data_room_id = sdr.data_room_id
              AND gt.deleted_at IS NULL
        ) AS tag_row
    ), '[]'::jsonb) AS tags
FROM public.saved_data_rooms sdr
WHERE sdr.user_id = COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  AND sdr.id = ANY(COALESCE(p_saved_room_ids, ARRAY[]::uuid[]));
$$;

GRANT EXECUTE ON FUNCTION public.get_saved_room_library_tags(UUID[]) TO authenticated;

DROP TABLE IF EXISTS public.library_data_room_tags;
DROP TABLE IF EXISTS public.data_room_document_tags;
DROP TABLE IF EXISTS public.library_deck_tags;

COMMIT;
