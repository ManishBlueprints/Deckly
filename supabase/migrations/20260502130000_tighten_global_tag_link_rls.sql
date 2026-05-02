-- Tighten legacy tag-link tables after they were repointed to public.global_tags.
-- These policies must validate both ownership of the parent record and ownership
-- of the referenced non-deleted global tag row.

DROP POLICY IF EXISTS "Owner only" ON public.library_folder_tags;
CREATE POLICY "Owner only" ON public.library_folder_tags
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.library_folders lf
        JOIN public.global_tags gt ON gt.id = tag_id
        WHERE lf.id = folder_id
          AND lf.user_id = (select auth.uid())
          AND gt.user_id = lf.user_id
          AND gt.deleted_at IS NULL
    ))
    WITH CHECK (EXISTS (
        SELECT 1
        FROM public.library_folders lf
        JOIN public.global_tags gt ON gt.id = tag_id
        WHERE lf.id = folder_id
          AND lf.user_id = (select auth.uid())
          AND gt.user_id = lf.user_id
          AND gt.deleted_at IS NULL
    ));

DROP POLICY IF EXISTS "Owner only" ON public.library_deck_tags;
CREATE POLICY "Owner only" ON public.library_deck_tags
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.investor_library il
        JOIN public.global_tags gt ON gt.id = tag_id
        WHERE il.id = library_id
          AND il.user_id = (select auth.uid())
          AND gt.user_id = il.user_id
          AND gt.deleted_at IS NULL
    ))
    WITH CHECK (EXISTS (
        SELECT 1
        FROM public.investor_library il
        JOIN public.global_tags gt ON gt.id = tag_id
        WHERE il.id = library_id
          AND il.user_id = (select auth.uid())
          AND gt.user_id = il.user_id
          AND gt.deleted_at IS NULL
    ));

DROP POLICY IF EXISTS "Owner only room tags" ON public.library_data_room_tags;
DROP POLICY IF EXISTS "Users can read room tags" ON public.library_data_room_tags;
DROP POLICY IF EXISTS "Users can insert room tags" ON public.library_data_room_tags;
DROP POLICY IF EXISTS "Users can delete room tags" ON public.library_data_room_tags;

CREATE POLICY "Users can read room tags" ON public.library_data_room_tags
    FOR SELECT USING (EXISTS (
        SELECT 1
        FROM public.saved_data_rooms sdr
        JOIN public.global_tags gt ON gt.id = tag_id
        WHERE sdr.id = saved_room_id
          AND sdr.user_id = (select auth.uid())
          AND gt.user_id = sdr.user_id
          AND gt.deleted_at IS NULL
    ));

CREATE POLICY "Users can insert room tags" ON public.library_data_room_tags
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1
        FROM public.saved_data_rooms sdr
        JOIN public.global_tags gt ON gt.id = tag_id
        WHERE sdr.id = saved_room_id
          AND sdr.user_id = (select auth.uid())
          AND gt.user_id = sdr.user_id
          AND gt.deleted_at IS NULL
    ));

CREATE POLICY "Users can delete room tags" ON public.library_data_room_tags
    FOR DELETE USING (EXISTS (
        SELECT 1
        FROM public.saved_data_rooms sdr
        JOIN public.global_tags gt ON gt.id = tag_id
        WHERE sdr.id = saved_room_id
          AND sdr.user_id = (select auth.uid())
          AND gt.user_id = sdr.user_id
          AND gt.deleted_at IS NULL
    ));
