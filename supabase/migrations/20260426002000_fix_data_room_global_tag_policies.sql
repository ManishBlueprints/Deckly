-- Align data room tag tables with the global tag schema.
-- Room-owned tags are now global_tags, so policy checks must validate against
-- the room owner's global tag rows instead of legacy data_room_tags.

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

ALTER TABLE public.data_room_folder_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_room_document_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage data room folder tags" ON public.data_room_folder_tags;
CREATE POLICY "Owners can manage data room folder tags" ON public.data_room_folder_tags
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.data_room_folders f
        JOIN public.data_rooms dr ON dr.id = f.data_room_id
        JOIN public.global_tags gt ON gt.id = tag_id
        WHERE f.id = folder_id
          AND dr.user_id = (SELECT auth.uid())
          AND gt.user_id = dr.user_id
          AND gt.deleted_at IS NULL
    ))
    WITH CHECK (EXISTS (
        SELECT 1
        FROM public.data_room_folders f
        JOIN public.data_rooms dr ON dr.id = f.data_room_id
        JOIN public.global_tags gt ON gt.id = tag_id
        WHERE f.id = folder_id
          AND dr.user_id = (SELECT auth.uid())
          AND gt.user_id = dr.user_id
          AND gt.deleted_at IS NULL
    ));

DROP POLICY IF EXISTS "Owners can manage data room document tags" ON public.data_room_document_tags;
CREATE POLICY "Owners can manage data room document tags" ON public.data_room_document_tags
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.data_room_documents drd
        JOIN public.data_rooms dr ON dr.id = drd.data_room_id
        JOIN public.global_tags gt ON gt.id = tag_id
        WHERE drd.id = document_id
          AND dr.user_id = (SELECT auth.uid())
          AND gt.user_id = dr.user_id
          AND gt.deleted_at IS NULL
    ))
    WITH CHECK (EXISTS (
        SELECT 1
        FROM public.data_room_documents drd
        JOIN public.data_rooms dr ON dr.id = drd.data_room_id
        JOIN public.global_tags gt ON gt.id = tag_id
        WHERE drd.id = document_id
          AND dr.user_id = (SELECT auth.uid())
          AND gt.user_id = dr.user_id
          AND gt.deleted_at IS NULL
    ));
