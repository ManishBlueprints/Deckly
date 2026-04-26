-- Data Room folder/tag RLS hardening
-- Keeps owner workflows working while removing the old direct anonymous table read.

ALTER TABLE public.data_room_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_room_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_room_folder_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_room_documents ENABLE ROW LEVEL SECURITY;

-- Folders: owner-only read/write.
DROP POLICY IF EXISTS "Owners can manage data room folders" ON public.data_room_folders;
CREATE POLICY "Owners can manage data room folders" ON public.data_room_folders
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.data_rooms dr
        WHERE dr.id = data_room_id
          AND dr.user_id = (SELECT auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1
        FROM public.data_rooms dr
        WHERE dr.id = data_room_id
          AND dr.user_id = (SELECT auth.uid())
    ));

-- Tags: owner-only read/write.
DROP POLICY IF EXISTS "Owners can manage data room tags" ON public.data_room_tags;
CREATE POLICY "Owners can manage data room tags" ON public.data_room_tags
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.data_rooms dr
        WHERE dr.id = data_room_id
          AND dr.user_id = (SELECT auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1
        FROM public.data_rooms dr
        WHERE dr.id = data_room_id
          AND dr.user_id = (SELECT auth.uid())
    ));

-- Folder-tag links: owner-only and same-room only.
DROP POLICY IF EXISTS "Owners can manage data room folder tags" ON public.data_room_folder_tags;
CREATE POLICY "Owners can manage data room folder tags" ON public.data_room_folder_tags
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.data_room_folders f
        JOIN public.data_room_tags t ON t.data_room_id = f.data_room_id
        JOIN public.data_rooms dr ON dr.id = f.data_room_id
        WHERE f.id = folder_id
          AND t.id = tag_id
          AND dr.user_id = (SELECT auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1
        FROM public.data_room_folders f
        JOIN public.data_room_tags t ON t.data_room_id = f.data_room_id
        JOIN public.data_rooms dr ON dr.id = f.data_room_id
        WHERE f.id = folder_id
          AND t.id = tag_id
          AND dr.user_id = (SELECT auth.uid())
    ));

-- Documents: keep owner management, but remove the legacy anonymous read path.
DROP POLICY IF EXISTS "Anyone can view data room document lists" ON public.data_room_documents;
CREATE POLICY "Owners can view data room document lists" ON public.data_room_documents
    FOR SELECT
    USING (EXISTS (
        SELECT 1
        FROM public.data_rooms dr
        WHERE dr.id = data_room_id
          AND dr.user_id = (SELECT auth.uid())
    ));

REVOKE SELECT ON public.data_room_documents FROM anon;
