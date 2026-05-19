BEGIN;

ALTER TABLE public.deck_tags
    ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE public.deck_tags dt
SET user_id = d.user_id
FROM public.decks d
WHERE d.id = dt.deck_id
  AND dt.user_id IS NULL;

ALTER TABLE public.deck_tags
    DROP CONSTRAINT IF EXISTS deck_tags_deck_id_tag_id_key;

ALTER TABLE public.deck_tags
    DROP CONSTRAINT IF EXISTS deck_tags_user_id_deck_id_tag_id_key;

ALTER TABLE public.deck_tags
    ADD CONSTRAINT deck_tags_user_id_deck_id_tag_id_key
    UNIQUE (user_id, deck_id, tag_id);

INSERT INTO public.deck_tags (user_id, deck_id, tag_id, created_at, updated_at)
SELECT DISTINCT
    il.user_id,
    il.deck_id,
    ldt.tag_id,
    COALESCE(il.created_at, now()),
    COALESCE(il.created_at, now())
FROM public.investor_library il
JOIN public.library_deck_tags ldt
    ON ldt.library_id = il.id
JOIN public.global_tags gt
    ON gt.id = ldt.tag_id
   AND gt.user_id = il.user_id
   AND gt.deleted_at IS NULL
ON CONFLICT (user_id, deck_id, tag_id) DO NOTHING;

INSERT INTO public.deck_tags (user_id, deck_id, tag_id, created_at, updated_at)
SELECT DISTINCT
    dr.user_id,
    drd.deck_id,
    drdt.tag_id,
    now(),
    now()
FROM public.data_room_documents drd
JOIN public.data_room_document_tags drdt
    ON drdt.document_id = drd.id
JOIN public.data_rooms dr
    ON dr.id = drd.data_room_id
JOIN public.global_tags gt
    ON gt.id = drdt.tag_id
   AND gt.user_id = dr.user_id
   AND gt.deleted_at IS NULL
ON CONFLICT (user_id, deck_id, tag_id) DO NOTHING;

ALTER TABLE public.deck_tags
    ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deck_tags_user_id_deck_id
    ON public.deck_tags (user_id, deck_id);

DROP POLICY IF EXISTS "Owners can manage deck tags" ON public.deck_tags;
DROP POLICY IF EXISTS "Users can manage their deck tags" ON public.deck_tags;
CREATE POLICY "Users can manage their deck tags" ON public.deck_tags
    FOR ALL
    USING (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1
            FROM public.decks d
            WHERE d.id = deck_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.global_tags gt
            WHERE gt.id = tag_id
              AND gt.user_id = user_id
              AND gt.deleted_at IS NULL
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1
            FROM public.decks d
            WHERE d.id = deck_id
        )
        AND EXISTS (
            SELECT 1
            FROM public.global_tags gt
            WHERE gt.id = tag_id
              AND gt.user_id = user_id
              AND gt.deleted_at IS NULL
        )
    );

CREATE OR REPLACE FUNCTION public.reconcile_deck_tags(
    p_deck_id UUID,
    p_user_id UUID,
    p_tag_ids UUID[] DEFAULT '{}'::uuid[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_next_tag_ids UUID[];
    v_owned_tag_count INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    SELECT ARRAY(
        SELECT DISTINCT tag_id
        FROM unnest(COALESCE(p_tag_ids, '{}'::uuid[])) AS tag_id
        WHERE tag_id IS NOT NULL
    )
    INTO v_next_tag_ids;

    IF NOT EXISTS (
        SELECT 1
        FROM public.decks d
        WHERE d.id = p_deck_id
    ) THEN
        RAISE EXCEPTION 'Deck not found';
    END IF;

    SELECT COUNT(*)::INTEGER
    INTO v_owned_tag_count
    FROM public.global_tags gt
    WHERE gt.id = ANY(COALESCE(v_next_tag_ids, '{}'::uuid[]))
      AND gt.user_id = p_user_id
      AND gt.deleted_at IS NULL;

    IF v_owned_tag_count <> COALESCE(array_length(v_next_tag_ids, 1), 0) THEN
        RAISE EXCEPTION 'One or more tags were not found.';
    END IF;

    DELETE FROM public.deck_tags
    WHERE user_id = p_user_id
      AND deck_id = p_deck_id
      AND NOT (tag_id = ANY(COALESCE(v_next_tag_ids, '{}'::uuid[])));

    INSERT INTO public.deck_tags (user_id, deck_id, tag_id)
    SELECT p_user_id, p_deck_id, tag_id
    FROM unnest(COALESCE(v_next_tag_ids, '{}'::uuid[])) AS tag_id
    ON CONFLICT (user_id, deck_id, tag_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_deck_tags(UUID, UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_deck_tags(UUID, UUID, UUID[]) TO authenticated;

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
              AND dt.user_id = auth.uid()
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

DROP FUNCTION IF EXISTS public.get_saved_room_library_tags(UUID[]);

DROP TABLE IF EXISTS public.library_data_room_tags;
DROP TABLE IF EXISTS public.data_room_document_tags;
DROP TABLE IF EXISTS public.library_deck_tags;

COMMIT;
