-- Saved data rooms and private room notes

CREATE TABLE IF NOT EXISTS public.saved_data_rooms (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    data_room_id UUID REFERENCES public.data_rooms(id) ON DELETE SET NULL,
    folder_id UUID REFERENCES public.library_folders(id) ON DELETE SET NULL,
    room_title TEXT NOT NULL,
    room_slug TEXT NOT NULL,
    room_handle TEXT NOT NULL,
    room_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    room_owner_handle TEXT NOT NULL,
    description TEXT DEFAULT NULL,
    expires_at TIMESTAMPTZ DEFAULT NULL,
    require_email BOOLEAN NOT NULL DEFAULT FALSE,
    require_password BOOLEAN NOT NULL DEFAULT FALSE,
    last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, data_room_id)
);

CREATE TABLE IF NOT EXISTS public.saved_data_room_notes (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data_room_id UUID REFERENCES public.data_rooms(id) ON DELETE SET NULL,
    content TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, data_room_id)
);

CREATE TABLE IF NOT EXISTS public.library_data_room_tags (
    saved_room_id UUID NOT NULL REFERENCES public.saved_data_rooms(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.library_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (saved_room_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_data_rooms_user ON public.saved_data_rooms(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_data_rooms_room ON public.saved_data_rooms(data_room_id);
CREATE INDEX IF NOT EXISTS idx_saved_data_rooms_folder ON public.saved_data_rooms(folder_id);
CREATE INDEX IF NOT EXISTS idx_saved_data_room_notes_user_room ON public.saved_data_room_notes(user_id, data_room_id);
CREATE INDEX IF NOT EXISTS idx_library_data_room_tags_room ON public.library_data_room_tags(saved_room_id);
CREATE INDEX IF NOT EXISTS idx_library_data_room_tags_tag ON public.library_data_room_tags(tag_id);

ALTER TABLE public.saved_data_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_data_room_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_data_room_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner only saved rooms" ON public.saved_data_rooms;
DROP POLICY IF EXISTS "Users can read saved rooms" ON public.saved_data_rooms;
DROP POLICY IF EXISTS "Users can insert saved rooms" ON public.saved_data_rooms;
DROP POLICY IF EXISTS "Users can update saved rooms" ON public.saved_data_rooms;
DROP POLICY IF EXISTS "Users can delete saved rooms" ON public.saved_data_rooms;

CREATE POLICY "Users can read saved rooms" ON public.saved_data_rooms
    FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert saved rooms" ON public.saved_data_rooms
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update saved rooms" ON public.saved_data_rooms
    FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete saved rooms" ON public.saved_data_rooms
    FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Notes are strictly private" ON public.saved_data_room_notes;
DROP POLICY IF EXISTS "Users can read saved room notes" ON public.saved_data_room_notes;
DROP POLICY IF EXISTS "Users can insert saved room notes" ON public.saved_data_room_notes;
DROP POLICY IF EXISTS "Users can update saved room notes" ON public.saved_data_room_notes;
DROP POLICY IF EXISTS "Users can delete saved room notes" ON public.saved_data_room_notes;

CREATE POLICY "Users can read saved room notes" ON public.saved_data_room_notes
    FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert saved room notes" ON public.saved_data_room_notes
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update saved room notes" ON public.saved_data_room_notes
    FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete saved room notes" ON public.saved_data_room_notes
    FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owner only room tags" ON public.library_data_room_tags;
DROP POLICY IF EXISTS "Users can read room tags" ON public.library_data_room_tags;
DROP POLICY IF EXISTS "Users can insert room tags" ON public.library_data_room_tags;
DROP POLICY IF EXISTS "Users can delete room tags" ON public.library_data_room_tags;

CREATE POLICY "Users can read room tags" ON public.library_data_room_tags
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.saved_data_rooms
        WHERE id = saved_room_id AND user_id = (select auth.uid())
    ));

CREATE POLICY "Users can insert room tags" ON public.library_data_room_tags
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.saved_data_rooms
        WHERE id = saved_room_id AND user_id = (select auth.uid())
    ));

CREATE POLICY "Users can delete room tags" ON public.library_data_room_tags
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM public.saved_data_rooms
        WHERE id = saved_room_id AND user_id = (select auth.uid())
    ));
