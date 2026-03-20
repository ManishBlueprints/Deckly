-- DECKLY DATABASE SCHEMA
-- Copy and paste this into your Supabase SQL Editor

-- 0. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    handle TEXT UNIQUE,
    avatar_url TEXT,
    tier TEXT DEFAULT 'FREE', -- FREE, PRO, PRO_PLUS
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for profile handle (removed unused var)


-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR PROFILES
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING ((select auth.uid()) = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- 1. DECKS TABLE
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
    status TEXT DEFAULT 'PENDING', -- PENDING, PROCESSED, ERROR
    file_size BIGINT,
    display_order INTEGER DEFAULT 1,
    require_email BOOLEAN DEFAULT FALSE,
    require_password BOOLEAN DEFAULT FALSE,
    view_password TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BRANDING TABLE
CREATE TABLE IF NOT EXISTS public.branding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    room_name TEXT DEFAULT 'Deckly Data Room',
    banner_url TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ANALYTICS TABLES
CREATE TABLE IF NOT EXISTS public.deck_page_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    visitor_id TEXT NOT NULL,
    viewer_email TEXT,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    time_spent REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.deck_stats (
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    user_id UUID NOT NULL, -- Owner of the deck (redundant but helpful for RLS)
    total_views INTEGER DEFAULT 0,
    total_time_seconds INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (deck_id, page_number)
);

-- Optimized index for dashboard retrieval (filtering by deck, owner, and date)
CREATE INDEX IF NOT EXISTS idx_deck_stats_dashboard ON public.deck_stats(deck_id, user_id, updated_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_stats ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR DECKS
CREATE POLICY "Users can manage their own decks" ON public.decks
    FOR ALL USING ((select auth.uid()) = user_id);

-- Removed: "Decks are viewable by everyone" USING (true)
-- Decks can now only be accessed by the public via security definer views or RPCs.

-- POLICIES FOR BRANDING
CREATE POLICY "Users can manage their own branding" ON public.branding
    FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Branding is viewable by everyone" ON public.branding
    FOR SELECT USING (true);

-- POLICIES FOR ANALYTICS (Public insertion, Owner viewing)
CREATE POLICY "Public can log valid page views" ON public.deck_page_views
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.decks WHERE id = deck_id));

CREATE POLICY "Owners can view their page views" ON public.deck_page_views
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = (select auth.uid())
    ));

CREATE POLICY "Owners can manage their own stats" ON public.deck_stats
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = (select auth.uid())
    ));

CREATE POLICY "Owners can view their stats" ON public.deck_stats
    FOR SELECT USING ((select auth.uid()) = user_id);

-- 5. DATA ROOMS TABLE
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

-- 6. DATA ROOM DOCUMENTS (junction table)
CREATE TABLE IF NOT EXISTS public.data_room_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_room_id UUID NOT NULL REFERENCES public.data_rooms(id) ON DELETE CASCADE,
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(data_room_id, deck_id)
);

-- Indexes for data rooms
CREATE INDEX IF NOT EXISTS idx_data_rooms_user ON public.data_rooms(user_id);
CREATE INDEX IF NOT EXISTS idx_data_room_docs_room ON public.data_room_documents(data_room_id, display_order);

-- Enable RLS
ALTER TABLE public.data_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_room_documents ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR DATA ROOMS
CREATE POLICY "Users can manage their own data rooms" ON public.data_rooms
    FOR ALL USING ((select auth.uid()) = user_id);

-- Removed: "Data rooms are viewable by everyone" USING (true)
-- Rooms can now only be accessed by the public via security definer views or RPCs.

-- POLICIES FOR DATA ROOM DOCUMENTS
CREATE POLICY "Owners can manage data room documents" ON public.data_room_documents
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.data_rooms dr WHERE dr.id = data_room_id AND dr.user_id = (select auth.uid())
    ));

-- Removed: "Data room documents are viewable by everyone" USING (true)
-- Documents can now only be read by the public via get_data_room_payload RPC.

-- STORAGE BUCKETS
-- You must manually create a public bucket named 'decks' in the Supabase Dashboard.
-- Then apply these policies in the Storage tab:

/*
  1. ALL: Authenticated users can upload to their own folder (e.g., userId/...)
  2. SELECT: Anyone can read from the bucket (since it's public)
*/

-- MIGRATIONS (for multi-document support)
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'pdf';
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS display_mode TEXT DEFAULT 'raw'; -- 'raw' or 'interactive'
-- Drop view before altering column type
DROP VIEW IF EXISTS public.decks_public;
ALTER TABLE public.decks ALTER COLUMN pages DROP DEFAULT;
ALTER TABLE public.decks ALTER COLUMN pages TYPE JSONB USING to_jsonb(pages);
ALTER TABLE public.decks ALTER COLUMN pages SET DEFAULT '[]'::jsonb;
ALTER TABLE deck_page_views ADD COLUMN IF NOT EXISTS time_spent REAL DEFAULT 0;
ALTER TABLE deck_page_views ADD COLUMN IF NOT EXISTS viewer_email TEXT;

-- 7. SECURITY HARDENING: SECURE ACCESS GATE
-- This section implements server-side password validation to prevent leakage.

-- Minimal public profiles view: exposes only id and handle.
-- IMPORTANT: regular PostgreSQL views do NOT bypass RLS automatically.
-- The "Public profile fields" policy below grants anonymous SELECT on profiles;
-- column-level GRANTs ensure only id and handle are accessible to anon/authenticated.
CREATE OR REPLACE VIEW public.profiles_public WITH (security_invoker = true) AS
SELECT id, handle
FROM public.profiles;

-- Public view for decks (excludes sensitive view_password, file_url, and pages payload)
-- Runs with security definer semantics to bypass the restricted RLS on decks.
DROP VIEW IF EXISTS public.decks_public CASCADE;
CREATE OR REPLACE VIEW public.decks_public WITH (security_invoker = false) AS
SELECT 
    d.id, d.user_id, d.title, d.slug, d.description, d.status, 
    d.file_size, d.display_order, d.require_email, d.require_password, d.expires_at, 
    d.created_at, d.updated_at, d.file_type, d.display_mode,
    p.handle as user_handle
FROM public.decks d
JOIN public.profiles_public p ON d.user_id = p.id;

-- Public view for data rooms (excludes sensitive view_password and associated documents)
-- Runs with security definer semantics to bypass the restricted RLS on data_rooms.
DROP VIEW IF EXISTS public.data_rooms_public CASCADE;
CREATE OR REPLACE VIEW public.data_rooms_public WITH (security_invoker = false) AS
SELECT 
    dr.id, dr.user_id, dr.name, dr.slug, dr.description, dr.icon_url, dr.require_email, 
    dr.require_password, dr.expires_at, dr.created_at, dr.updated_at,
    p.handle as user_handle
FROM public.data_rooms dr
JOIN public.profiles_public p ON dr.user_id = p.id;

-- Allow anonymous and authenticated roles to read only the public profile fields.
-- Without this policy, RLS blocks all anon reads even through profiles_public.
CREATE POLICY "Public profile fields are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Restrict which columns anon/authenticated can actually access on profiles.
-- RLS controls which ROWS are visible; column grants control which COLUMNS.
GRANT SELECT (id, handle) ON public.profiles TO anon, authenticated;

-- GRANT VIEW PERMISSIONS --
GRANT SELECT ON public.decks_public TO anon, authenticated;
GRANT SELECT ON public.data_rooms_public TO anon, authenticated;

-- RATE LIMITING FOR PASSWORD CHECKS
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    ip_address TEXT NOT NULL,
    target_slug TEXT NOT NULL,
    failed_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (ip_address, target_slug)
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_last_attempt ON public.auth_rate_limits(last_attempt_at);

-- PASSWORD HASHING SETUP
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.hash_password_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.view_password IS NOT NULL AND NEW.view_password IS DISTINCT FROM OLD.view_password THEN
    IF NEW.view_password NOT LIKE '$2a$%' AND NEW.view_password NOT LIKE '$2b$%' AND NEW.view_password NOT LIKE '$2y$%' THEN
      NEW.view_password = crypt(NEW.view_password, gen_salt('bf'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_hash_deck_password ON public.decks;
CREATE TRIGGER tr_hash_deck_password
BEFORE INSERT OR UPDATE ON public.decks
FOR EACH ROW EXECUTE FUNCTION public.hash_password_trigger();

DROP TRIGGER IF EXISTS tr_hash_room_password ON public.data_rooms;
CREATE TRIGGER tr_hash_room_password
BEFORE INSERT OR UPDATE ON public.data_rooms
FOR EACH ROW EXECUTE FUNCTION public.hash_password_trigger();

-- SECURE PASSWORD CHECKING HELPERS
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_ip TEXT, p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempts INTEGER;
    v_last_attempt TIMESTAMPTZ;
BEGIN
    SELECT failed_attempts, last_attempt_at INTO v_attempts, v_last_attempt
    FROM public.auth_rate_limits
    WHERE ip_address = p_ip AND target_slug = p_slug;

    -- If more than 5 attempts within 5 minutes, block
    IF FOUND AND v_attempts >= 5 AND (NOW() - v_last_attempt) < INTERVAL '5 minutes' THEN
        RETURN FALSE;
    END IF;

    -- Reset if window passed
    IF FOUND AND (NOW() - v_last_attempt) >= INTERVAL '5 minutes' THEN
        UPDATE public.auth_rate_limits SET failed_attempts = 0 WHERE ip_address = p_ip AND target_slug = p_slug;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_failed_attempt(p_ip TEXT, p_slug TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.auth_rate_limits (ip_address, target_slug, failed_attempts, last_attempt_at)
    VALUES (p_ip, p_slug, 1, NOW())
    ON CONFLICT (ip_address, target_slug)
    DO UPDATE SET failed_attempts = auth_rate_limits.failed_attempts + 1, last_attempt_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_rate_limit(p_ip TEXT, p_slug TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.auth_rate_limits WHERE ip_address = p_ip AND target_slug = p_slug;
END;
$$;

-- Secure password validation function for Decks
CREATE OR REPLACE FUNCTION public.check_deck_password(p_slug TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- runs as owner
SET search_path = public
AS $$
DECLARE
    v_hashed_pw TEXT;
    v_ip TEXT := current_setting('request.headers', true)::json->>'x-forwarded-for';
BEGIN
    SELECT view_password INTO v_hashed_pw FROM public.decks WHERE slug = p_slug;

    -- Return early if no password is set to bypass rate limiting overhead/spam
    IF v_hashed_pw IS NULL THEN
        RETURN TRUE;
    END IF;

    IF v_ip IS NOT NULL AND trim(v_ip) != '' THEN
        v_ip := trim(split_part(v_ip, ',', 1));
    END IF;
    IF v_ip IS NULL OR trim(v_ip) = '' THEN 
        v_ip := COALESCE(inet_client_addr()::text, 'local'); 
    END IF;

    IF NOT public.check_rate_limit(v_ip, p_slug) THEN
        RAISE EXCEPTION 'Too many failed attempts. Please try again later.';
    END IF;


    IF v_hashed_pw = crypt(p_password, v_hashed_pw) THEN
        PERFORM public.clear_rate_limit(v_ip, p_slug);
        RETURN TRUE;
    END IF;

    PERFORM public.record_failed_attempt(v_ip, p_slug);
    RETURN FALSE;
END;
$$;

-- Secure password validation function for Data Rooms
CREATE OR REPLACE FUNCTION public.check_data_room_password(p_slug TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hashed_pw TEXT;
    v_ip TEXT := current_setting('request.headers', true)::json->>'x-forwarded-for';
BEGIN
    SELECT view_password INTO v_hashed_pw FROM public.data_rooms WHERE slug = p_slug;

    -- Return early if no password is set to bypass rate limiting overhead/spam
    IF v_hashed_pw IS NULL THEN
        RETURN TRUE;
    END IF;

    IF v_ip IS NOT NULL AND trim(v_ip) != '' THEN
        v_ip := trim(split_part(v_ip, ',', 1));
    END IF;
    IF v_ip IS NULL OR trim(v_ip) = '' THEN 
        v_ip := COALESCE(inet_client_addr()::text, 'local'); 
    END IF;

    IF NOT public.check_rate_limit(v_ip, p_slug) THEN
        RAISE EXCEPTION 'Too many failed attempts. Please try again later.';
    END IF;

    IF v_hashed_pw = crypt(p_password, v_hashed_pw) THEN
        PERFORM public.clear_rate_limit(v_ip, p_slug);
        RETURN TRUE;
    END IF;

    PERFORM public.record_failed_attempt(v_ip, p_slug);
    RETURN FALSE;
END;
$$;

-- SECURE PAYLOAD RPCS
CREATE OR REPLACE FUNCTION public.get_deck_payload(p_slug TEXT, p_password TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deck RECORD;
BEGIN
    SELECT * INTO v_deck FROM public.decks WHERE slug = p_slug;
    -- Enforce exact password check via RPC helper (shared error prevents slug enumeration)
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF v_deck.require_password AND NOT public.check_deck_password(p_slug, p_password) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN json_build_object(
        'file_url', v_deck.file_url,
        'pages', v_deck.pages
    )::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_data_room_payload(p_slug TEXT, p_password TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room RECORD;
    v_documents jsonb;
BEGIN
    SELECT * INTO v_room FROM public.data_rooms WHERE slug = p_slug;
    -- Shared error prevents slug enumeration
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF v_room.require_password AND NOT public.check_data_room_password(p_slug, p_password) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Fetch documents and payloads for this room
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
            'pages', d.pages
        ) ORDER BY drd.display_order ASC
    ), '[]'::jsonb) INTO v_documents
    FROM public.data_room_documents drd
    JOIN public.decks d ON d.id = drd.deck_id
    WHERE drd.data_room_id = v_room.id;

    RETURN v_documents;
END;
$$;

-- Secure Postgres Function for Analytics (replaces client-side inserts/updates)
CREATE OR REPLACE FUNCTION public.record_deck_visit(
    p_deck_id UUID,
    p_page_number INTEGER,
    p_time_spent REAL,
    p_visitor_id TEXT,
    p_viewer_email TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deck_owner_id UUID;
    v_recent_view_id UUID;
    v_is_unique BOOLEAN;
    v_email_count INTEGER;
BEGIN
    -- Input Validations
    IF p_time_spent < 0 THEN p_time_spent := 0; END IF;
    p_time_spent := LEAST(p_time_spent, 300); -- hard cap at 5 mins per ping
    
    -- Ensure visitor_id doesn't exceed 100 chars instead of silently dropping
    IF LENGTH(p_visitor_id) > 100 THEN 
        p_visitor_id := LEFT(p_visitor_id, 100); 
    END IF;

    -- Enforce email uniqueness spam limit per visitor
    IF p_viewer_email IS NOT NULL THEN
        SELECT COUNT(DISTINCT viewer_email) INTO v_email_count
        FROM public.deck_page_views
        WHERE visitor_id = p_visitor_id AND deck_id = p_deck_id AND viewer_email IS NOT NULL;

        IF v_email_count >= 3 THEN
           -- Ignore the injected email, do not process it
           p_viewer_email := NULL;
        END IF;
    END IF;

    -- 1. Get the deck owner
    SELECT user_id INTO v_deck_owner_id FROM public.decks WHERE id = p_deck_id;
    IF NOT FOUND THEN RETURN; END IF;

    -- 2. Check for unique view in last 24 hours
    SELECT id INTO v_recent_view_id
    FROM public.deck_page_views
    WHERE deck_id = p_deck_id
      AND page_number = p_page_number
      AND visitor_id = p_visitor_id
      AND viewed_at > (NOW() - INTERVAL '24 hours')
    LIMIT 1;

    v_is_unique := (v_recent_view_id IS NULL);

    -- 3. Sync deck_page_views
    IF v_is_unique THEN
        INSERT INTO public.deck_page_views (deck_id, page_number, visitor_id, time_spent, viewer_email)
        VALUES (p_deck_id, p_page_number, p_visitor_id, p_time_spent, p_viewer_email);
    ELSE
        -- Also refresh viewed_at so the 24-hour window advances correctly,
        -- and keep viewer_email up-to-date ONLY if it was previously null.
        UPDATE public.deck_page_views
        SET time_spent   = LEAST(time_spent + p_time_spent, 86400), -- Daily cap of 24 hrs
            viewed_at    = NOW(),
            viewer_email = COALESCE(viewer_email, p_viewer_email)
        WHERE id = v_recent_view_id;
    END IF;

    -- 4. Sync deck_stats (Aggregate)
    INSERT INTO public.deck_stats (deck_id, page_number, user_id, total_views, total_time_seconds)
    VALUES (
        p_deck_id, p_page_number, v_deck_owner_id, 
        CASE WHEN v_is_unique THEN 1 ELSE 0 END, 
        ROUND(p_time_spent::numeric)::INTEGER
    )
    ON CONFLICT (deck_id, page_number)
    DO UPDATE SET
        total_views        = deck_stats.total_views + (CASE WHEN v_is_unique THEN 1 ELSE 0 END),
        total_time_seconds = deck_stats.total_time_seconds + ROUND(p_time_spent::numeric)::INTEGER,
        updated_at         = NOW();
END;
$$;

-- 8. INVESTOR LIBRARY
CREATE TABLE IF NOT EXISTS public.investor_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, deck_id)
);

-- Index for library query
CREATE INDEX IF NOT EXISTS idx_investor_library_user ON public.investor_library(user_id);
CREATE INDEX IF NOT EXISTS idx_investor_library_deck ON public.investor_library(deck_id);

-- Index for unique visitor counting
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON public.deck_page_views(deck_id, visitor_id);

-- Enable RLS
ALTER TABLE public.investor_library ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR INVESTOR LIBRARY
CREATE POLICY "Users can manage their own library" ON public.investor_library
    FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Owners can view bookmarks of their decks" 
ON public.investor_library 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE decks.id = deck_id 
    AND decks.user_id = (select auth.uid())
  )
);


-- 9. INVESTOR NOTES
CREATE TABLE IF NOT EXISTS public.investor_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    content TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, deck_id)
);

-- Index for note retrieval
CREATE INDEX IF NOT EXISTS idx_investor_notes_user_deck ON public.investor_notes(user_id, deck_id);

-- Enable RLS
ALTER TABLE public.investor_notes ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR INVESTOR NOTES
CREATE POLICY "Notes are strictly private" ON public.investor_notes
    FOR ALL USING ((select auth.uid()) = user_id);

-- 10. FOREIGN KEY OPTIMIZATION INDEXES
CREATE INDEX IF NOT EXISTS idx_branding_user ON public.branding(user_id);
CREATE INDEX IF NOT EXISTS idx_data_room_documents_deck ON public.data_room_documents(deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_stats_user ON public.deck_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_decks_user ON public.decks(user_id);
CREATE INDEX IF NOT EXISTS idx_investor_notes_deck ON public.investor_notes(deck_id);
