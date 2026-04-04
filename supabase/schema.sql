-- DECKLY DATABASE SCHEMA
-- Copy and paste this into your Supabase SQL Editor

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    unique_visitors INTEGER DEFAULT 0,
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

-- 3. DATA ROOMS TABLE
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

-- 4. DATA ROOM DOCUMENTS (junction table)
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

-- POLICIES FOR DATA ROOM DOCUMENTS
CREATE POLICY "Owners can manage data room documents" ON public.data_room_documents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.data_rooms dr 
            WHERE dr.id = data_room_id AND dr.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.data_rooms dr 
            WHERE dr.id = data_room_id AND dr.user_id = auth.uid()
        ) AND EXISTS (
            SELECT 1 FROM public.decks d 
            WHERE d.id = deck_id AND d.user_id = auth.uid()
        )
    );

-- 5. ANALYTICS TABLES
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

-- Migration: add columns to existing deck_page_views table
ALTER TABLE public.deck_page_views ADD COLUMN IF NOT EXISTS data_room_id UUID;
ALTER TABLE public.deck_page_views ADD COLUMN IF NOT EXISTS viewer_email TEXT;
ALTER TABLE public.deck_page_views ADD COLUMN IF NOT EXISTS time_spent NUMERIC DEFAULT 0;
ALTER TABLE public.deck_page_views ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Unknown';
ALTER TABLE public.deck_page_views ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Unknown City';
ALTER TABLE public.deck_page_views ADD COLUMN IF NOT EXISTS country_code TEXT;
-- NOTE: deck_page_views stores one row per PAGE view (multiple rows per visitor per deck
-- are expected). Uniqueness for visitor counting is enforced at the trigger level in
-- notify_signal_threshold() which atomically increments decks.unique_visitors.
-- FK constraint for data_room_id (safe to re-run; DO NOTHING if exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deck_page_views_data_room_id_fkey'
  ) THEN
    ALTER TABLE public.deck_page_views
      ADD CONSTRAINT deck_page_views_data_room_id_fkey
      FOREIGN KEY (data_room_id) REFERENCES public.data_rooms(id) ON DELETE CASCADE;
  END IF;
END $$;

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

-- Migration: add data_room_id to existing deck_stats table
ALTER TABLE public.deck_stats ADD COLUMN IF NOT EXISTS data_room_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deck_stats_data_room_id_fkey'
  ) THEN
    ALTER TABLE public.deck_stats
      ADD CONSTRAINT deck_stats_data_room_id_fkey
      FOREIGN KEY (data_room_id) REFERENCES public.data_rooms(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =============================================================================
-- DATA ROOMS OPTIMIZATION
-- Get all data rooms with doc counts and visitor counts in ONE call
-- =============================================================================
CREATE OR REPLACE FUNCTION get_batch_data_room_analytics(p_room_ids UUID[])
RETURNS TABLE (
  room_id UUID,
  doc_count INTEGER,
  visitors INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH owned_rooms AS (
    -- Security Filter: Only process rooms owned by the authenticated caller.
    -- auth.uid() reads from JWT claims and works correctly inside SECURITY DEFINER.
    SELECT dr.id
    FROM public.data_rooms dr
    WHERE dr.id = ANY(p_room_ids)
      AND dr.user_id = auth.uid()
  ),
  doc_counts AS (
    SELECT
      drd.data_room_id,
      COUNT(*)::INTEGER AS d_count
    FROM public.data_room_documents drd
    JOIN owned_rooms orm ON orm.id = drd.data_room_id
    GROUP BY drd.data_room_id
  ),
  visitor_counts AS (
    SELECT
      dpv.data_room_id,
      COUNT(DISTINCT dpv.visitor_id)::INTEGER AS v_count
    FROM public.deck_page_views dpv
    JOIN owned_rooms orm ON orm.id = dpv.data_room_id
    GROUP BY dpv.data_room_id
  )
  SELECT
    orm.id                  AS room_id,
    COALESCE(dc.d_count, 0) AS doc_count,
    COALESCE(vc.v_count, 0) AS visitors
  FROM owned_rooms orm
  LEFT JOIN doc_counts dc ON dc.data_room_id = orm.id
  LEFT JOIN visitor_counts vc ON vc.data_room_id = orm.id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_batch_data_room_analytics(UUID[]) TO authenticated;

-- Unique index to handle per-room aggregation (treating NULL as Global context)
CREATE UNIQUE INDEX IF NOT EXISTS idx_deck_stats_unique_room 
ON public.deck_stats (deck_id, page_number, (COALESCE(data_room_id, '00000000-0000-0000-0000-000000000000'::uuid)));

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

-- POLICIES FOR BRANDING
CREATE POLICY "Users can manage their own branding" ON public.branding
    FOR ALL USING ((select auth.uid()) = user_id);

CREATE POLICY "Branding is viewable by everyone" ON public.branding
    FOR SELECT USING (true);

-- POLICIES FOR ANALYTICS (Public insertion, Owner viewing)
CREATE POLICY "Public can log valid page views" ON public.deck_page_views
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.decks_public WHERE id = deck_id)
    );

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
-- time_spent is already defined as NUMERIC in the CREATE TABLE above
-- These migrations are redundant but harmless — add comment for clarity
-- ALTER TABLE deck_page_views ADD COLUMN IF NOT EXISTS time_spent REAL DEFAULT 0; -- REDUNDANT: already NUMERIC in table definition
-- ALTER TABLE deck_page_views ADD COLUMN IF NOT EXISTS viewer_email TEXT; -- REDUNDANT: already defined in table definition

-- 7. SECURITY HARDENING: SECURE ACCESS GATE
-- This section implements server-side password validation to prevent leakage.

-- Minimal public profiles view: exposes only id and handle.
-- Runs with security definer semantics to safely bypass RLS on profiles without exposing sensitive columns.
CREATE OR REPLACE VIEW public.profiles_public WITH (security_invoker = false) AS
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

-- Cleanup the old, insecure "viewable by everyone" policy if it exists.
DROP POLICY IF EXISTS "Public profile fields are viewable by everyone" ON public.profiles;

-- Restore standard table-level SELECT so authenticated users can read all columns of their OWN profile 
-- (as permitted by the "Users can view their own profile" RLS policy above).
GRANT SELECT ON public.profiles TO anon, authenticated;

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

-- Enable RLS for security monitoring best practices. 
-- Direct access remains denied; managed via SECURITY DEFINER functions.
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

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

CREATE OR REPLACE FUNCTION public.record_deck_visit(
    p_deck_id UUID,
    p_page_number INTEGER,
    p_time_spent NUMERIC,
    p_visitor_id TEXT,
    p_viewer_email TEXT DEFAULT NULL,
    p_data_room_id UUID DEFAULT NULL,
    p_country TEXT DEFAULT 'Unknown',
    p_city TEXT DEFAULT 'Unknown City',
    p_country_code TEXT DEFAULT NULL
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
    p_time_spent := LEAST(p_time_spent, 3600); -- updated cap: 1 hr
    
    -- Ensure visitor_id doesn't exceed 100 chars instead of silently dropping
    IF LENGTH(p_visitor_id) > 100 THEN 
        p_visitor_id := LEFT(p_visitor_id, 100); 
    END IF;

    -- Enforce email uniqueness spam limit per visitor
    IF p_viewer_email IS NOT NULL THEN
        SELECT COUNT(DISTINCT viewer_email) INTO v_email_count
        FROM public.deck_page_views
        WHERE visitor_id = p_visitor_id AND deck_id = p_deck_id AND viewer_email IS NOT NULL;

        IF v_email_count >= 5 THEN
           -- Ignore the injected email
           p_viewer_email := NULL;
        END IF;
    END IF;

    -- 1. Validate p_data_room_id: ensure it's linked to p_deck_id to prevent spoofing
    IF p_data_room_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.data_room_documents
            WHERE data_room_id = p_data_room_id AND deck_id = p_deck_id
        ) THEN
            -- Room is not linked to this deck; silently discard the association
            p_data_room_id := NULL;
        END IF;
    END IF;

    -- 2. Get the deck owner
    SELECT user_id INTO v_deck_owner_id FROM public.decks WHERE id = p_deck_id;
    IF NOT FOUND THEN RETURN; END IF;

    -- 2. Check for unique view in last 24 hours (now context-aware)
    SELECT id INTO v_recent_view_id
    FROM public.deck_page_views
    WHERE deck_id = p_deck_id
      AND page_number = p_page_number
      AND visitor_id = p_visitor_id
      AND (
          (p_data_room_id IS NULL AND data_room_id IS NULL) OR 
          (p_data_room_id IS NOT NULL AND data_room_id = p_data_room_id)
      )
      AND viewed_at > (NOW() - INTERVAL '24 hours')
    LIMIT 1;

    v_is_unique := (v_recent_view_id IS NULL);

    -- 3. Sync deck_page_views
    IF v_is_unique THEN
        INSERT INTO public.deck_page_views (
            deck_id, page_number, visitor_id, time_spent, 
            viewer_email, data_room_id, country, city, country_code
        )
        VALUES (
            p_deck_id, p_page_number, p_visitor_id, p_time_spent, 
            p_viewer_email, p_data_room_id, p_country, p_city, p_country_code
        );
    ELSE
        -- Also refresh viewed_at so the 24-hour window advances correctly,
        -- and keep viewer_email/location up-to-date ONLY if they were previously null or unknown.
        UPDATE public.deck_page_views
        SET time_spent   = LEAST(time_spent + p_time_spent, 86400), -- Daily cap of 24 hrs
            viewed_at    = NOW(),
            viewer_email = COALESCE(viewer_email, p_viewer_email),
            country      = CASE WHEN country = 'Unknown' THEN p_country ELSE country END,
            city         = CASE WHEN city = 'Unknown City' THEN p_city ELSE city END,
            country_code = COALESCE(country_code, p_country_code)
        WHERE id = v_recent_view_id;
    END IF;

    -- 4. Sync deck_stats (Aggregate - now context-aware)
    INSERT INTO public.deck_stats (deck_id, page_number, user_id, data_room_id, total_views, total_time_seconds)
    VALUES (
        p_deck_id, p_page_number, v_deck_owner_id, p_data_room_id,
        CASE WHEN v_is_unique THEN 1 ELSE 0 END, 
        ROUND(p_time_spent::numeric)::INTEGER
    )
    ON CONFLICT (deck_id, page_number, (COALESCE(data_room_id, '00000000-0000-0000-0000-000000000000'::uuid)))
    DO UPDATE SET
        total_views        = deck_stats.total_views + (CASE WHEN v_is_unique THEN 1 ELSE 0 END),
        total_time_seconds = deck_stats.total_time_seconds + ROUND(p_time_spent::numeric)::INTEGER,
        updated_at         = NOW(),
        user_id            = COALESCE(deck_stats.user_id, EXCLUDED.user_id);
END;
$$;

-- 1. Count unique visitors (Highly Efficient)
CREATE OR REPLACE FUNCTION public.count_unique_visitors(p_deck_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(DISTINCT visitor_id)::INTEGER
  FROM public.deck_page_views
  WHERE deck_id = p_deck_id;
$$;

-- 2. Get aggregated location stats (Returns exact structure for frontend)
CREATE OR REPLACE FUNCTION public.get_deck_locations(p_deck_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'countries', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT 
          COALESCE(country, 'Unknown') as name, 
          COALESCE(country_code, 'US') as code, 
          COUNT(*)::INTEGER as count
        FROM public.deck_page_views
        WHERE deck_id = p_deck_id
        GROUP BY country, country_code
        ORDER BY count DESC
      ) t
    ), '[]'::jsonb),
    'cities', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT 
          COALESCE(city, 'Unknown City') as name, 
          COALESCE(country, 'Unknown') as country, 
          COUNT(*)::INTEGER as count
        FROM public.deck_page_views
        WHERE deck_id = p_deck_id
        GROUP BY city, country
        ORDER BY count DESC
      ) t
    ), '[]'::jsonb)
  );
END;
$$;

-- Grant permissions for analytics
REVOKE EXECUTE ON FUNCTION public.record_deck_visit(UUID, INTEGER, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_deck_visit(UUID, INTEGER, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_unique_visitors(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_deck_locations(UUID) TO anon, authenticated;

-- 8. INVESTOR LIBRARY
CREATE TABLE IF NOT EXISTS public.investor_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

-- 11. LIBRARY ORGANIZATION (INVESTOR ORGANIZER)

-- Folders
CREATE TABLE IF NOT EXISTS public.library_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) <= 30),
    color TEXT NOT NULL DEFAULT '#666666',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags
CREATE TABLE IF NOT EXISTS public.library_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) <= 30),
    color TEXT NOT NULL DEFAULT '#666666',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Folder tags junction
CREATE TABLE IF NOT EXISTS public.library_folder_tags (
    folder_id UUID NOT NULL REFERENCES public.library_folders(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.library_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (folder_id, tag_id)
);

-- Deck tags junction
CREATE TABLE IF NOT EXISTS public.library_deck_tags (
    library_id UUID NOT NULL REFERENCES public.investor_library(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.library_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (library_id, tag_id)
);

-- Add folder_id to investor_library
ALTER TABLE public.investor_library 
    ADD COLUMN IF NOT EXISTS folder_id UUID 
    REFERENCES public.library_folders(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.library_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_folder_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_deck_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Owner only" ON public.library_folders
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Owner only" ON public.library_tags
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Owner only" ON public.library_folder_tags
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.library_folders 
        WHERE id = folder_id AND user_id = auth.uid()
    ));

CREATE POLICY "Owner only" ON public.library_deck_tags
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.investor_library 
        WHERE id = library_id AND user_id = auth.uid()
    ));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_library_folders_user ON public.library_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_library_tags_user ON public.library_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_investor_library_folder ON public.investor_library(folder_id);
CREATE INDEX IF NOT EXISTS idx_library_folder_tags_folder ON public.library_folder_tags(folder_id);
CREATE INDEX IF NOT EXISTS idx_library_folder_tags_tag ON public.library_folder_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_library_deck_tags_library ON public.library_deck_tags(library_id);
CREATE INDEX IF NOT EXISTS idx_library_deck_tags_tag ON public.library_deck_tags(tag_id);

-- 12. AUTHENTICATION TRIGGERS
-- Automatically create profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 13. NOTIFICATIONS
-- =============================================================================

-- Core table
CREATE TABLE IF NOT EXISTS public.notifications (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type        TEXT        NOT NULL CHECK (type IN (
                                'deck_view',
                                'deck_save',
                                'signal_threshold',
                                'deck_update',
                                'admin_message'
                            )),
    title       TEXT        NOT NULL,
    message     TEXT        NOT NULL,
    metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    read_at     TIMESTAMPTZ DEFAULT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read / update (mark read) / delete their own notifications.
-- INSERT is handled exclusively by SECURITY DEFINER functions below, which
-- bypass RLS — so no open INSERT policy is needed (and would be unsafe).
CREATE POLICY "notifications_owner_select" ON public.notifications
    FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "notifications_owner_update" ON public.notifications
    FOR UPDATE USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "notifications_owner_delete" ON public.notifications
    FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON public.notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON public.notifications(user_id)
    WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_created
    ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_expires
    ON public.notifications(expires_at);

-- Composite index for the most common query pattern:
-- "get all unread notifications for user X ordered by newest first"
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
    ON public.notifications(user_id, created_at DESC)
    WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_dedup
    ON public.notifications(user_id, type, title, created_at DESC)
    WHERE read_at IS NULL;

-- =============================================================================
-- 13a. HELPERS: admin_emails & is_admin()
-- =============================================================================

-- Create a simple allowlist table for admins
CREATE TABLE IF NOT EXISTS public.admin_emails (
    email TEXT PRIMARY KEY,
    added_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

-- Canonical is_admin function (email-allowlist based)
-- Must be defined BEFORE the policy that references it.
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID;
    v_email TEXT;
BEGIN
    v_uid := COALESCE(p_user_id, auth.uid());
    
    -- Get email from auth.users (SECURITY DEFINER can read auth schema)
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    
    -- Check against allowlist
    RETURN EXISTS (
        SELECT 1 FROM public.admin_emails WHERE email = v_email
    );
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

-- Only admins can manage the list (bootstrapped by direct SQL insert)
-- Defined AFTER is_admin() so the policy can safely reference it.
CREATE POLICY "Only admins can view admin_emails" ON public.admin_emails
    FOR SELECT USING (public.is_admin());
-- =============================================================================

-- =============================================================================
-- 13b. create_notification_internal() — privileged insert helper
-- SECURITY DEFINER and NOT directly granted to authenticated callers.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_notification_internal(
    p_user_id UUID,
    p_type     TEXT,
    p_title    TEXT,
    p_message  TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF p_type NOT IN (
        'deck_view', 'deck_save', 'signal_threshold', 'deck_update', 'admin_message'
    ) THEN
        RAISE EXCEPTION 'Invalid notification type: %', p_type;
    END IF;

    -- Deduplicate: skip if an identical unread notification already exists
    -- created within the last 10 minutes (prevents trigger spam on bulk ops)
    IF EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id   = p_user_id
          AND type      = p_type
          AND title     = p_title
          AND read_at   IS NULL
          AND created_at > NOW() - INTERVAL '10 minutes'
    ) THEN
        RETURN NULL;  -- silently skip duplicate
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (p_user_id, p_type, p_title, p_message, COALESCE(p_metadata, '{}'::jsonb))
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- =============================================================================
-- 13b. create_notification() — public RPC wrapper
-- SECURITY INVOKER + explicit auth check:
-- caller must be notifying self OR caller must be admin.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type     TEXT,
    p_title    TEXT,
    p_message  TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF auth.uid() <> p_user_id AND NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    RETURN public.create_notification_internal(
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_metadata
    );
END;
$$;

-- =============================================================================
-- 13c. create_admin_broadcast() — admin-only
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_admin_broadcast(
    p_user_ids UUID[],
    p_title    TEXT,
    p_message  TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid    UUID;
    v_count  INTEGER := 0;
BEGIN
    -- Only admins may broadcast
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Permission denied: admin role required';
    END IF;

    IF p_user_ids IS NULL OR array_length(p_user_ids, 1) = 0 THEN
        RAISE EXCEPTION 'p_user_ids must contain at least one user';
    END IF;

    FOREACH v_uid IN ARRAY p_user_ids LOOP
        INSERT INTO public.notifications (user_id, type, title, message, metadata)
        VALUES (v_uid, 'admin_message', p_title, p_message, COALESCE(p_metadata, '{}'::jsonb));
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- =============================================================================
-- 13d. create_admin_broadcast_all() — broadcast to ALL users (admin-only)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_admin_broadcast_all(
    p_title    TEXT,
    p_message  TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Permission denied: admin role required';
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    SELECT p.id, 'admin_message', p_title, p_message, COALESCE(p_metadata, '{}'::jsonb)
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.admin_emails ae WHERE ae.email = u.email
    );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- =============================================================================
-- 13e. cleanup_expired_notifications() — service-role / pg_cron only
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count       INTEGER := 0;
    v_batch_count INTEGER;
BEGIN
    -- Extra guard: only service role or admin can call this manually
    IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    -- Batched delete to avoid long table locks on high volumes
    LOOP
        DELETE FROM public.notifications 
        WHERE id IN (
            SELECT id FROM public.notifications 
            WHERE expires_at < NOW() 
            LIMIT 1000
        );
        
        GET DIAGNOSTICS v_batch_count = ROW_COUNT;
        v_count := v_count + v_batch_count;
        
        EXIT WHEN v_batch_count = 0;
    END LOOP;

    RETURN v_count;
END;
$$;

-- =============================================================================
-- 13f. TRIGGER — notify deck owner when someone saves their deck
-- Fires on INSERT into investor_library
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_deck_save()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id   UUID;
    v_deck_title TEXT;
    v_save_count BIGINT;
BEGIN
    -- Fetch deck owner + title
    SELECT d.user_id, d.title
    INTO v_owner_id, v_deck_title
    FROM public.decks d
    WHERE d.id = NEW.deck_id;

    -- Don't notify if the owner saved their own deck
    IF v_owner_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Count total saves for display
    SELECT COUNT(*) INTO v_save_count
    FROM public.investor_library
    WHERE deck_id = NEW.deck_id;

    PERFORM public.create_notification_internal(
        v_owner_id,
        'deck_save',
        'New Save 🔖',
        '"' || v_deck_title || '" was saved by a viewer. ' ||
        'It now has ' || v_save_count || ' save' || CASE WHEN v_save_count = 1 THEN '' ELSE 's' END || '.',
        jsonb_build_object(
            'deck_id',    NEW.deck_id,
            'save_count', v_save_count
        )
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_on_deck_save ON public.investor_library;
CREATE TRIGGER tr_notify_on_deck_save
    AFTER INSERT ON public.investor_library
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_deck_save();

-- =============================================================================
-- 13g. TRIGGER — signal threshold (3, 10, 25, 50, 100 unique visitors)
-- Fires on INSERT into deck_page_views
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_signal_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id      UUID;
    v_deck_title    TEXT;
    v_visitor_count BIGINT;
    v_milestones    INTEGER[] := ARRAY[3, 10, 25, 50, 100, 250, 500, 1000];
    v_milestone     INTEGER;
BEGIN
    -- Get deck metadata
    SELECT d.user_id, d.title
    INTO v_owner_id, v_deck_title
    FROM public.decks d
    WHERE d.id = NEW.deck_id;

    -- Guard: only count as a unique visitor if no prior page_view row exists
    -- for this same (deck_id, visitor_id) combination.
    -- The non-unique idx_page_views_visitor index covers this query efficiently.
    -- NOTE: We cannot rely on a unique index here because deck_page_views intentionally
    -- allows multiple rows per visitor (one per page viewed per session).
    IF EXISTS (
        SELECT 1 FROM public.deck_page_views
        WHERE deck_id   = NEW.deck_id
          AND visitor_id = NEW.visitor_id
          AND id        != NEW.id  -- exclude the row that just fired this trigger
    ) THEN
        -- Not a first-time visitor for this deck; skip counter increment.
        RETURN NEW;
    END IF;

    -- First-time visitor: atomically increment unique_visitors on the deck.
    UPDATE public.decks
    SET unique_visitors = unique_visitors + 1
    WHERE id = NEW.deck_id
    RETURNING unique_visitors INTO v_visitor_count;

    -- Milestone check
    FOREACH v_milestone IN ARRAY v_milestones LOOP
        IF v_visitor_count = v_milestone THEN
            PERFORM public.create_notification_internal(
                v_owner_id,
                'signal_threshold',
                'High Investor Interest 🔥',
                '"' || v_deck_title || '" has now been viewed by ' ||
                v_visitor_count || ' unique investor' ||
                CASE WHEN v_visitor_count = 1 THEN '' ELSE 's' END || '.',
                jsonb_build_object(
                    'deck_id',       NEW.deck_id,
                    'visitor_count', v_visitor_count,
                    'milestone',     v_milestone
                )
            );
            EXIT;  -- Only one milestone per insert
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_signal_threshold ON public.deck_page_views;
CREATE TRIGGER tr_notify_signal_threshold
    AFTER INSERT ON public.deck_page_views
    FOR EACH ROW EXECUTE FUNCTION public.notify_signal_threshold();

-- =============================================================================
-- 13h. TRIGGER — notify investors when a saved deck is updated
-- Fires on UPDATE of status on decks (CONVERTING → PROCESSED = new version)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_deck_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_investor RECORD;
    v_count    INTEGER := 0;
BEGIN
    -- Only trigger when a deck finishes processing (new version uploaded)
    IF OLD.status IS DISTINCT FROM NEW.status
       AND OLD.status = 'CONVERTING'
       AND NEW.status = 'PROCESSED' THEN

        FOR v_investor IN
            SELECT user_id
            FROM public.investor_library
            WHERE deck_id = NEW.id
        LOOP
            PERFORM public.create_notification_internal(
                v_investor.user_id,
                'deck_update',
                'Deck Updated 📄',
                '"' || NEW.title || '" has been updated by the founder. Tap to view the latest version.',
                jsonb_build_object(
                    'deck_id',   NEW.id,
                    'deck_slug', NEW.slug
                )
            );
            v_count := v_count + 1;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_on_deck_update ON public.decks;
CREATE TRIGGER tr_notify_on_deck_update
    AFTER UPDATE OF status ON public.decks
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_deck_update();

-- =============================================================================
-- 13i. GRANTS
-- create_notification_internal → internal helper only (no authenticated grant)
-- create_notification  → authenticated self/admin wrapper
-- create_admin_broadcast / _all → authenticated (function enforces admin check)
-- cleanup_expired_notifications → NOT granted to authenticated (cron only)
-- is_admin → authenticated (needed for UI role checks)
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.is_admin(UUID)                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification_internal(UUID, TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_admin_broadcast(UUID[], TEXT, TEXT, JSONB)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_broadcast_all(TEXT, TEXT, JSONB)      TO authenticated;
-- cleanup_expired_notifications is intentionally NOT granted to authenticated.
-- Schedule it via pg_cron (Supabase dashboard → Database → Cron Jobs):
--   SELECT cron.schedule('cleanup-notifications', '0 3 * * *',
--     $$SELECT public.cleanup_expired_notifications();$$);

-- =============================================================================
-- Admin Dashboard Metrics
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_total_system_users()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_count FROM public.profiles;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_total_system_users() TO authenticated;
