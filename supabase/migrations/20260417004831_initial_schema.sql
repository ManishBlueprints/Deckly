-- DECKLY CONSOLIDATED SCHEMA (INITIAL MIGRATION)
-- Optimized for Performance & Dependency Safety

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. CORE TABLES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    handle TEXT UNIQUE,
    avatar_url TEXT,
    tier TEXT DEFAULT 'FREE',
    tutorial_state JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.decks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    file_url TEXT,
    pages JSONB DEFAULT '[]'::jsonb,
    display_mode TEXT DEFAULT 'raw',
    file_type TEXT DEFAULT 'pdf',
    status TEXT DEFAULT 'PENDING',
    file_size BIGINT,
    display_order INTEGER DEFAULT 1,
    require_email BOOLEAN DEFAULT FALSE,
    require_password BOOLEAN DEFAULT FALSE,
    view_password TEXT,
    unique_visitors INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.branding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    room_name TEXT DEFAULT 'Deckly Data Room',
    banner_url TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.data_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon_url TEXT,
    require_email BOOLEAN DEFAULT FALSE,
    require_password BOOLEAN DEFAULT FALSE,
    view_password TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.data_room_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_room_id UUID NOT NULL REFERENCES public.data_rooms(id) ON DELETE CASCADE,
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(data_room_id, deck_id)
);

-- 3. VIEWS (Must exist before policies)
CREATE OR REPLACE VIEW public.profiles_public WITH (security_invoker = false) AS 
SELECT id, handle FROM public.profiles;

CREATE OR REPLACE VIEW public.decks_public WITH (security_invoker = false) AS
SELECT d.id, d.user_id, d.title, d.slug, d.description, d.status, d.file_size, d.display_order, d.require_email, d.require_password, d.expires_at, d.created_at, d.updated_at, d.file_type, d.display_mode, p.handle as user_handle
FROM public.decks d JOIN public.profiles_public p ON d.user_id = p.id;

CREATE OR REPLACE VIEW public.data_rooms_public WITH (security_invoker = false) AS
SELECT dr.id, dr.user_id, dr.name, dr.slug, dr.description, dr.icon_url, dr.require_email, dr.require_password, dr.expires_at, dr.created_at, dr.updated_at, p.handle as user_handle
FROM public.data_rooms dr JOIN public.profiles_public p ON dr.user_id = p.id;

-- 4. ANALYTICS & TOOLS TABLES
CREATE TABLE IF NOT EXISTS public.deck_page_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    data_room_id UUID REFERENCES public.data_rooms(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    visitor_id TEXT NOT NULL,
    viewer_email TEXT,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    time_spent NUMERIC DEFAULT 0,
    country TEXT DEFAULT 'Unknown',
    city TEXT DEFAULT 'Unknown City',
    country_code TEXT
);

CREATE TABLE IF NOT EXISTS public.deck_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    data_room_id UUID REFERENCES public.data_rooms(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_views INTEGER DEFAULT 0,
    total_time_seconds INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.investor_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    folder_id UUID,
    last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, deck_id)
);

CREATE TABLE IF NOT EXISTS public.investor_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    content TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, deck_id)
);

CREATE TABLE IF NOT EXISTS public.library_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) <= 30),
    color TEXT NOT NULL DEFAULT '#666666',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.investor_library ADD CONSTRAINT investor_library_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.library_folders(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.library_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) <= 30),
    color TEXT NOT NULL DEFAULT '#666666',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS public.library_folder_tags (folder_id UUID NOT NULL REFERENCES public.library_folders(id) ON DELETE CASCADE, tag_id UUID NOT NULL REFERENCES public.library_tags(id) ON DELETE CASCADE, PRIMARY KEY (folder_id, tag_id));
CREATE TABLE IF NOT EXISTS public.library_deck_tags (library_id UUID NOT NULL REFERENCES public.investor_library(id) ON DELETE CASCADE, tag_id UUID NOT NULL REFERENCES public.library_tags(id) ON DELETE CASCADE, PRIMARY KEY (library_id, tag_id));

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('deck_view', 'deck_save', 'signal_threshold', 'deck_update', 'admin_message')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS public.admin_emails (email TEXT PRIMARY KEY, added_at TIMESTAMPTZ DEFAULT NOW());

-- 5. RPC FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_tutorial_state(p_state JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF (select auth.uid()) IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
    UPDATE public.profiles SET tutorial_state = COALESCE(tutorial_state, '{}'::jsonb) || p_state, updated_at = NOW() WHERE id = (select auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := COALESCE(p_user_id, (select auth.uid())); v_email TEXT; BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    RETURN EXISTS (SELECT 1 FROM public.admin_emails WHERE email = v_email);
END; $$;

CREATE OR REPLACE FUNCTION public.create_notification_internal(p_user_id UUID, p_type TEXT, p_title TEXT, p_message TEXT, p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; BEGIN
    IF EXISTS (SELECT 1 FROM public.notifications WHERE user_id = p_user_id AND type = p_type AND title = p_title AND read_at IS NULL AND created_at > NOW() - INTERVAL '10 minutes') THEN RETURN NULL; END IF;
    INSERT INTO public.notifications (user_id, type, title, message, metadata) VALUES (p_user_id, p_type, p_title, p_message, COALESCE(p_metadata, '{}'::jsonb)) RETURNING id INTO v_id;
    RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id UUID, p_type TEXT, p_title TEXT, p_message TEXT, p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
    IF (select auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF (select auth.uid()) <> p_user_id AND NOT public.is_admin((select auth.uid())) THEN RAISE EXCEPTION 'Permission denied'; END IF;
    RETURN public.create_notification_internal(p_user_id, p_type, p_title, p_message, p_metadata);
END; $$;

CREATE OR REPLACE FUNCTION public.get_batch_data_room_analytics(p_room_ids UUID[])
RETURNS TABLE (room_id UUID, doc_count INTEGER, visitors INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH owned_rooms AS (SELECT dr.id FROM public.data_rooms dr WHERE dr.id = ANY(p_room_ids) AND dr.user_id = (select auth.uid())),
  doc_counts AS (SELECT drd.data_room_id, COUNT(*)::INTEGER AS d_count FROM public.data_room_documents drd JOIN owned_rooms orm ON orm.id = drd.data_room_id GROUP BY drd.data_room_id),
  visitor_counts AS (SELECT dpv.data_room_id, COUNT(DISTINCT dpv.visitor_id)::INTEGER AS v_count FROM public.deck_page_views dpv JOIN owned_rooms orm ON orm.id = dpv.data_room_id GROUP BY dpv.data_room_id)
  SELECT orm.id, COALESCE(dc.d_count, 0), COALESCE(vc.v_count, 0) FROM owned_rooms orm LEFT JOIN doc_counts dc ON dc.data_room_id = orm.id LEFT JOIN visitor_counts vc ON vc.data_room_id = orm.id;
END; $$;

-- 6. TRIGGERS
CREATE OR REPLACE FUNCTION public.notify_on_deck_save() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner_id UUID; v_deck_title TEXT; v_save_count BIGINT; BEGIN
    SELECT d.user_id, d.title INTO v_owner_id, v_deck_title FROM public.decks d WHERE d.id = NEW.deck_id;
    IF v_owner_id = NEW.user_id THEN RETURN NEW; END IF;
    SELECT COUNT(*) INTO v_save_count FROM public.investor_library WHERE deck_id = NEW.deck_id;
    PERFORM public.create_notification_internal(v_owner_id, 'deck_save', 'New Save 🔖', '"' || v_deck_title || '" was saved.', jsonb_build_object('deck_id', NEW.deck_id, 'save_count', v_save_count));
    RETURN NEW;
END; $$;

CREATE TRIGGER tr_notify_on_deck_save AFTER INSERT ON public.investor_library FOR EACH ROW EXECUTE FUNCTION public.notify_on_deck_save();

CREATE OR REPLACE FUNCTION public.notify_signal_threshold() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner_id UUID; v_deck_title TEXT; v_visitor_count BIGINT; v_milestone INTEGER; BEGIN
    SELECT d.user_id, d.title INTO v_owner_id, v_deck_title FROM public.decks d WHERE d.id = NEW.deck_id;
    IF EXISTS (SELECT 1 FROM public.deck_page_views WHERE deck_id = NEW.deck_id AND visitor_id = NEW.visitor_id AND id != NEW.id) THEN RETURN NEW; END IF;
    UPDATE public.decks SET unique_visitors = unique_visitors + 1 WHERE id = NEW.deck_id RETURNING unique_visitors INTO v_visitor_count;
    FOREACH v_milestone IN ARRAY ARRAY[3, 10, 25, 50, 100] LOOP
        IF v_visitor_count = v_milestone THEN
            PERFORM public.create_notification_internal(v_owner_id, 'signal_threshold', 'High Investor Interest 🔥', '"' || v_deck_title || '" reached ' || v_visitor_count || ' unique views.', jsonb_build_object('deck_id', NEW.deck_id, 'visitor_count', v_visitor_count));
            EXIT;
        END IF;
    END LOOP; RETURN NEW;
END; $$;

CREATE TRIGGER tr_notify_signal_threshold AFTER INSERT ON public.deck_page_views FOR EACH ROW EXECUTE FUNCTION public.notify_signal_threshold();

CREATE OR REPLACE FUNCTION public.hash_password_trigger() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.view_password IS NULL OR NEW.view_password = '' THEN NEW.view_password = NULL; RETURN NEW; END IF;
  IF NEW.view_password NOT LIKE '$2a$%' AND NEW.view_password NOT LIKE '$2b$%' AND NEW.view_password NOT LIKE '$2y$%' THEN
    NEW.view_password = crypt(NEW.view_password, gen_salt('bf'));
  END IF; RETURN NEW;
END; $$;

CREATE TRIGGER tr_hash_deck_password BEFORE INSERT OR UPDATE ON public.decks FOR EACH ROW EXECUTE FUNCTION public.hash_password_trigger();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, created_at, updated_at)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING; RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. RLS POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_room_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_folder_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_deck_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_view" ON public.profiles FOR SELECT USING ((select auth.uid()) = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING ((select auth.uid()) = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "decks_owner" ON public.decks FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "branding_owner" ON public.branding FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "branding_view" ON public.branding FOR SELECT USING (true);
CREATE POLICY "rooms_owner" ON public.data_rooms FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "room_docs_owner" ON public.data_room_documents FOR ALL USING (EXISTS (SELECT 1 FROM public.data_rooms dr WHERE dr.id = data_room_id AND dr.user_id = (select auth.uid())));

CREATE POLICY "analytics_insert" ON public.deck_page_views FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.decks_public WHERE id = deck_id));
CREATE POLICY "analytics_owner_view" ON public.deck_page_views FOR SELECT USING (EXISTS (SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = (select auth.uid())));
CREATE POLICY "stats_owner" ON public.deck_stats FOR ALL USING (EXISTS (SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = (select auth.uid())));

CREATE POLICY "library_owner" ON public.investor_library FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "notes_owner" ON public.investor_notes FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "folders_owner" ON public.library_folders FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "tags_owner" ON public.library_tags FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "notifications_owner" ON public.notifications FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "admin_emails_view" ON public.admin_emails FOR SELECT USING (public.is_admin());

-- 8. GRANTS
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.decks_public TO anon, authenticated;
GRANT SELECT ON public.data_rooms_public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tutorial_state(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_batch_data_room_analytics(UUID[]) TO authenticated;
