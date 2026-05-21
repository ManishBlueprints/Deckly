-- DECKLY DATABASE SCHEMA
-- Copy and paste this into your Supabase SQL Editor

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    handle TEXT UNIQUE,
    avatar_url TEXT,
    tier TEXT DEFAULT 'FREE', -- FREE, PRO, PRO_PLUS
    onboarding_profile JSONB DEFAULT '{}'::jsonb,
    tutorial_state JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for profile handle availability checks
CREATE INDEX IF NOT EXISTS idx_profiles_handle ON public.profiles(handle);


-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR PROFILES
-- Drop legacy prod public-access policy (profiles_public VIEW serves public data now)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles; -- prod legacy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Anyone can view basic profile info" ON public.profiles;

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- RPC for updating tutorial state efficiently
CREATE OR REPLACE FUNCTION public.update_tutorial_state(p_state JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'unauthenticated';
    END IF;

    UPDATE public.profiles
    SET tutorial_state = COALESCE(tutorial_state, '{}'::jsonb) || p_state,
        updated_at = NOW()
    WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_tutorial_state(JSONB) TO authenticated;

-- 1. DECKS TABLE
CREATE TABLE IF NOT EXISTS public.decks (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
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
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    view_password TEXT,
    unique_visitors INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deck_links (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    link_name TEXT NOT NULL,
    link_alias TEXT,
    public_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT deck_links_public_token_format_check CHECK (public_token ~ '^[a-f0-9]{32}$'),
    CONSTRAINT deck_links_link_name_nonempty_check CHECK (length(trim(link_name)) > 0),
    CONSTRAINT deck_links_link_alias_format_check CHECK (link_alias IS NULL OR link_alias ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- 2. BRANDING TABLE
CREATE TABLE IF NOT EXISTS public.branding (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
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
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
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
CREATE INDEX IF NOT EXISTS idx_deck_links_deck_id ON public.deck_links(deck_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deck_links_public_token ON public.deck_links(public_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deck_links_one_primary_per_deck
    ON public.deck_links(deck_id)
    WHERE is_primary;
CREATE UNIQUE INDEX IF NOT EXISTS idx_deck_links_deck_alias
    ON public.deck_links(deck_id, link_alias)
    WHERE link_alias IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_rooms_user ON public.data_rooms(user_id);
CREATE INDEX IF NOT EXISTS idx_data_room_docs_room ON public.data_room_documents(data_room_id, display_order);

-- Enable RLS
ALTER TABLE public.deck_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_room_documents ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR DECK LINKS
DROP POLICY IF EXISTS "Owners can manage deck links" ON public.deck_links;
CREATE POLICY "Owners can manage deck links" ON public.deck_links
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.decks d
            WHERE d.id = deck_id
              AND d.user_id = (select auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.decks d
            WHERE d.id = deck_id
              AND d.user_id = (select auth.uid())
        )
    );

CREATE OR REPLACE FUNCTION public.sync_deck_public_compatibility_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_deck_id UUID := COALESCE(NEW.deck_id, OLD.deck_id);
    v_has_enabled_primary BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.deck_links dl
        WHERE dl.deck_id = v_deck_id
          AND dl.is_primary = TRUE
          AND dl.is_enabled = TRUE
    )
    INTO v_has_enabled_primary;

    UPDATE public.decks d
    SET is_public = v_has_enabled_primary,
        updated_at = NOW()
    WHERE d.id = v_deck_id
      AND d.is_public IS DISTINCT FROM v_has_enabled_primary;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_deck_public_compatibility ON public.deck_links;
CREATE TRIGGER tr_sync_deck_public_compatibility
    AFTER INSERT OR UPDATE OR DELETE ON public.deck_links
    FOR EACH ROW EXECUTE FUNCTION public.sync_deck_public_compatibility_trigger();

-- Backfill one enabled primary link for legacy bare-route public decks, then
-- reconcile decks.is_public so it remains only the enabled-primary mirror.
UPDATE public.deck_links dl
SET is_enabled = TRUE,
    updated_at = NOW()
FROM public.decks d
WHERE d.id = dl.deck_id
  AND d.is_public = TRUE
  AND dl.is_primary = TRUE
  AND dl.is_enabled IS DISTINCT FROM TRUE;

INSERT INTO public.deck_links (deck_id, link_name, link_alias, is_enabled, is_primary)
SELECT d.id, 'Default Link', d.slug, TRUE, TRUE
FROM public.decks d
WHERE d.is_public = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM public.deck_links dl
      WHERE dl.deck_id = d.id
        AND dl.is_primary = TRUE
  );

UPDATE public.decks d
SET is_public = EXISTS (
        SELECT 1
        FROM public.deck_links dl
        WHERE dl.deck_id = d.id
          AND dl.is_primary = TRUE
          AND dl.is_enabled = TRUE
    ),
    updated_at = NOW()
WHERE d.is_public IS DISTINCT FROM EXISTS (
        SELECT 1
        FROM public.deck_links dl
        WHERE dl.deck_id = d.id
          AND dl.is_primary = TRUE
          AND dl.is_enabled = TRUE
    );

-- POLICIES FOR DATA ROOMS
DROP POLICY IF EXISTS "Users can manage their own data rooms" ON public.data_rooms;
CREATE POLICY "Users can manage their own data rooms" ON public.data_rooms
    FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Anyone can view data rooms" ON public.data_rooms;

-- POLICIES FOR DATA ROOM DOCUMENTS
DROP POLICY IF EXISTS "Owners can manage data room documents" ON public.data_room_documents;
CREATE POLICY "Owners can manage data room documents" ON public.data_room_documents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.data_rooms dr 
            WHERE dr.id = data_room_id AND dr.user_id = (select auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.data_rooms dr 
            WHERE dr.id = data_room_id AND dr.user_id = (select auth.uid())
        ) AND EXISTS (
            SELECT 1 FROM public.decks d 
            WHERE d.id = deck_id AND d.user_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Anyone can view data room document lists" ON public.data_room_documents;
CREATE POLICY "Anyone can view data room document lists" ON public.data_room_documents
    FOR SELECT USING (true);

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
-- Batch sign thumbnails for the owner dashboard
CREATE OR REPLACE FUNCTION public.get_owner_thumbnails()
RETURNS TABLE (deck_id UUID, storage_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id as deck_id,
        CASE 
          WHEN (d.pages->0->>'image_url') IS NOT NULL THEN
            regexp_replace(d.pages->0->>'image_url', '^.*/storage/v1/object/(public|sign|authenticated)/decks/', '')
          WHEN (d.pages->0->>'url') IS NOT NULL THEN
            regexp_replace(d.pages->0->>'url', '^.*/storage/v1/object/(public|sign|authenticated)/decks/', '')
          ELSE NULL
        END as storage_path
    FROM public.decks d
    WHERE d.user_id = auth.uid()
      AND d.status = 'PROCESSED';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_thumbnails() TO authenticated;

CREATE OR REPLACE FUNCTION get_batch_data_room_analytics(p_room_ids UUID[])
RETURNS TABLE (
  room_id UUID,
  doc_count INTEGER,
  visitors INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

CREATE OR REPLACE FUNCTION public.reconcile_deck_tags(
    p_deck_id UUID,
    p_user_id UUID,
    p_tag_ids UUID[] DEFAULT '{}'::uuid[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
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
          AND d.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Deck not found or access denied';
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
    WHERE deck_id = p_deck_id
      AND NOT (tag_id = ANY(COALESCE(v_next_tag_ids, '{}'::uuid[])));

    INSERT INTO public.deck_tags (deck_id, tag_id)
    SELECT p_deck_id, tag_id
    FROM unnest(COALESCE(v_next_tag_ids, '{}'::uuid[])) AS tag_id
    ON CONFLICT (deck_id, tag_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_deck_tags(UUID, UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_deck_tags(UUID, UUID, UUID[]) TO authenticated;

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
-- Drop legacy prod policies (public access is now via decks_public VIEW)
DROP POLICY IF EXISTS "Anyone can view decks" ON public.decks;
DROP POLICY IF EXISTS "Public can view decks by slug" ON public.decks;
DROP POLICY IF EXISTS "Users can manage their own decks" ON public.decks;
CREATE POLICY "Users can manage their own decks" ON public.decks
    FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Anyone can view published decks" ON public.decks;

-- POLICIES FOR BRANDING
-- Drop legacy prod policies
DROP POLICY IF EXISTS "Allow public read access" ON public.branding;
DROP POLICY IF EXISTS "Anyone can view branding" ON public.branding;
DROP POLICY IF EXISTS "Public can read branding" ON public.branding;
DROP POLICY IF EXISTS "Users can manage their own branding" ON public.branding;
CREATE POLICY "Users can manage their own branding" ON public.branding
    FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Branding is viewable by everyone" ON public.branding;
CREATE POLICY "Branding is viewable by everyone" ON public.branding
    FOR SELECT USING (true);

-- POLICIES FOR ANALYTICS (Public insertion is created AFTER views below to avoid dependency error)
-- Owners can view their own page views
DROP POLICY IF EXISTS "Public can check own views" ON public.deck_page_views; -- prod legacy
DROP POLICY IF EXISTS "Owners can view their page views" ON public.deck_page_views;
CREATE POLICY "Owners can view their page views" ON public.deck_page_views
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = (select auth.uid())
    ));

DROP POLICY IF EXISTS "Owners can manage their own stats" ON public.deck_stats;
DROP POLICY IF EXISTS "Owners can view their stats" ON public.deck_stats;         -- redundant
DROP POLICY IF EXISTS "Users can view their own deck stats" ON public.deck_stats; -- prod legacy
CREATE POLICY "Owners can manage their own stats" ON public.deck_stats
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = (select auth.uid())
    ));

-- =============================================================================
-- RESOURCE GATING & TIER ENFORCEMENT
-- Each user tier has a strict file size limit enforced at the storage level.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tier_limits (
    tier TEXT PRIMARY KEY,
    max_file_size_bytes BIGINT NOT NULL,
    max_decks INTEGER NOT NULL,            -- Total library count (-1 for unlimited)
    max_decks_per_day INTEGER NOT NULL,    -- Anti-spam rate limit
    max_decks_per_room INTEGER NOT NULL,   -- Data room capacity
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Tier Limits (Matching src/constants/tiers.ts)
INSERT INTO public.tier_limits (tier, max_file_size_bytes, max_decks, max_decks_per_day, max_decks_per_room)
VALUES 
  ('FREE',     10485760,  10, 30, 50),   -- 10MB
  ('PRO',      52428800,  50, 30, 50),   -- 50MB
  ('PRO_PLUS', 104857600, -1, 30, 50)    -- 100MB
ON CONFLICT (tier) DO UPDATE SET
  max_file_size_bytes = EXCLUDED.max_file_size_bytes,
  max_decks = EXCLUDED.max_decks,
  max_decks_per_day = EXCLUDED.max_decks_per_day,
  max_decks_per_room = EXCLUDED.max_decks_per_room;

ALTER TABLE public.tier_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view tier limits" ON public.tier_limits;
CREATE POLICY "Anyone can view tier limits" ON public.tier_limits
FOR SELECT TO anon, authenticated USING (true);

-- Helper to fetch current user's tier configuration efficiently
-- Falls back to 'FREE' tier if user profile or tier is missing to prevent RLS crashes
CREATE OR REPLACE FUNCTION public.get_current_user_tier_limit()
RETURNS public.tier_limits
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, extensions
AS $$
  SELECT tl.*
  FROM public.tier_limits tl
  WHERE tl.tier = COALESCE(
    (SELECT tier FROM public.profiles WHERE id = auth.uid()),
    'FREE'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_tier_limit() TO authenticated;


-- =============================================================================
-- STORAGE BUCKETS & POLICIES
-- Buckets are created idempotently. Policies are dropped and recreated each run.
-- =============================================================================

-- Create buckets if they don't exist.
-- decks is PRIVATE: raw deck files (PDFs etc.) are access-gated via signed URLs
-- generated inside get_deck_payload after password/expiry checks pass.
INSERT INTO storage.buckets (id, name, public)
VALUES ('decks', 'decks', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- assets stays public: avatars, logos, banners — no sensitive content
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- ---- DECKS BUCKET ----
-- Authenticated users can upload/update/delete files in their own folder (user_id prefix)
DROP POLICY IF EXISTS "Authenticated users can upload to their own decks folder" ON storage.objects;
CREATE POLICY "Authenticated users can upload to their own decks folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'decks' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1] AND
    (
        -- Robust size check: fall back to 10MB if metadata or tier lookup fails
        COALESCE((metadata->>'size')::bigint, 0) <= 
        COALESCE((SELECT max_file_size_bytes FROM public.get_current_user_tier_limit()), 10485760)
    )
);


DROP POLICY IF EXISTS "Authenticated users can update their own deck files" ON storage.objects;
CREATE POLICY "Authenticated users can update their own deck files"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'decks' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1]
)
WITH CHECK (
    bucket_id = 'decks' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1] AND
    (
        COALESCE((metadata->>'size')::bigint, 0) <= 
        COALESCE((SELECT max_file_size_bytes FROM public.get_current_user_tier_limit()), 10485760)
    )
);


DROP POLICY IF EXISTS "Authenticated users can delete their own deck files" ON storage.objects;
CREATE POLICY "Authenticated users can delete their own deck files"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'decks' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1]
);

-- Owners can SELECT/list their own files (needed for dashboard management).
-- Anonymous viewing of deck content goes through signed URLs generated by
-- get_deck_payload (password/expiry enforced), not direct storage reads.
DROP POLICY IF EXISTS "Anyone can read decks bucket" ON storage.objects;
DROP POLICY IF EXISTS "Owners can read their own deck files" ON storage.objects;
CREATE POLICY "Owners can read their own deck files"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'decks' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1]
);

-- ---- ASSETS BUCKET ----
-- Same pattern for profile avatars, banners, logos, etc.
DROP POLICY IF EXISTS "Authenticated users can upload to their own assets folder" ON storage.objects;
CREATE POLICY "Authenticated users can upload to their own assets folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'assets' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1] AND
    COALESCE((metadata->>'size')::bigint, 0) <= 5242880 -- Fixed 5MB for assets (logos/avatars)
);

DROP POLICY IF EXISTS "Authenticated users can update their own asset files" ON storage.objects;
CREATE POLICY "Authenticated users can update their own asset files"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'assets' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1]
)
WITH CHECK (
    bucket_id = 'assets' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1] AND
    COALESCE((metadata->>'size')::bigint, 0) <= 5242880
);

DROP POLICY IF EXISTS "Authenticated users can delete their own asset files" ON storage.objects;
CREATE POLICY "Authenticated users can delete their own asset files"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'assets' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1]
);

-- Public asset URLs work because the bucket itself is public.
-- We intentionally do not add a broad SELECT policy here, which would also
-- allow clients to list all objects in the bucket through the Storage API.
DROP POLICY IF EXISTS "Anyone can read assets bucket" ON storage.objects;


-- MIGRATIONS (for multi-document support)
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'pdf';
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS display_mode TEXT DEFAULT 'raw'; -- 'raw' or 'interactive'
ALTER TABLE public.decks ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.data_rooms ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
-- Drop view before altering column type
DROP VIEW IF EXISTS public.decks_public CASCADE;
ALTER TABLE public.decks ALTER COLUMN pages DROP DEFAULT;
ALTER TABLE public.decks ALTER COLUMN pages TYPE JSONB USING to_jsonb(pages);
ALTER TABLE public.decks ALTER COLUMN pages SET DEFAULT '[]'::jsonb;
-- time_spent is already defined as NUMERIC in the CREATE TABLE above
-- These migrations are redundant but harmless — add comment for clarity
-- ALTER TABLE deck_page_views ADD COLUMN IF NOT EXISTS time_spent REAL DEFAULT 0; -- REDUNDANT: already NUMERIC in table definition
-- ALTER TABLE deck_page_views ADD COLUMN IF NOT EXISTS viewer_email TEXT; -- REDUNDANT: already defined in table definition

-- 7. SECURITY HARDENING: SECURE ACCESS GATE
-- This section implements server-side password validation to prevent leakage.

-- Cleanup public views (CASCADE handles dependent RLS policies)
DROP VIEW IF EXISTS public.profiles_public CASCADE;
DROP VIEW IF EXISTS public.decks_public CASCADE;
DROP VIEW IF EXISTS public.data_rooms_public CASCADE;

-- Minimal public profiles function: exposes only id and handle.
-- Runs with security definer semantics to safely bypass RLS on profiles without exposing sensitive columns.
CREATE OR REPLACE FUNCTION public.get_profiles_public()
RETURNS TABLE (id uuid, handle text) 
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
SELECT id, handle
FROM public.profiles;
$$;

-- Public function for decks (excludes sensitive view_password, file_url, and pages payload)
-- Runs with security definer semantics to bypass the restricted RLS on decks.
-- Public access is link-aware: the bare route resolves only through an enabled
-- primary link, while a tokenized route resolves only through the referenced
-- enabled link and never falls back to slug-only compatibility.
CREATE OR REPLACE FUNCTION public.get_decks_public(p_link_token TEXT DEFAULT NULL)
RETURNS TABLE (
    id uuid, user_id uuid, title text, slug text, description text, status text, 
    file_size bigint, display_order integer, require_email boolean, require_password boolean, 
    expires_at timestamptz, created_at timestamptz, updated_at timestamptz, 
    file_type text, display_mode text, user_handle text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
SELECT 
    d.id, d.user_id, d.title, d.slug, d.description, d.status, 
    d.file_size, d.display_order, d.require_email, d.require_password, d.expires_at, 
    d.created_at, d.updated_at, d.file_type, d.display_mode,
    p.handle as user_handle
FROM public.decks d
JOIN public.profiles p ON d.user_id = p.id
WHERE d.status <> 'DELETED'
  AND (d.expires_at IS NULL OR d.expires_at > NOW())
  AND (
    (
      p_link_token IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.deck_links dl
        WHERE dl.deck_id = d.id
          AND dl.is_primary = TRUE
          AND dl.is_enabled = TRUE
      )
    )
    OR
    (
      p_link_token IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.deck_links dl
        WHERE dl.deck_id = d.id
          AND dl.public_token = p_link_token
          AND dl.is_enabled = TRUE
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_decks_public()
RETURNS TABLE (
    id uuid, user_id uuid, title text, slug text, description text, status text,
    file_size bigint, display_order integer, require_email boolean, require_password boolean,
    expires_at timestamptz, created_at timestamptz, updated_at timestamptz,
    file_type text, display_mode text, user_handle text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
SELECT *
FROM public.get_decks_public(NULL);
$$;

-- Public function for data rooms (excludes sensitive view_password and associated documents)
-- Runs with security definer semantics to bypass the restricted RLS on data_rooms.
CREATE OR REPLACE FUNCTION public.get_data_rooms_public()
RETURNS TABLE (
    id uuid, user_id uuid, name text, slug text, description text, icon_url text, 
    require_email boolean, require_password boolean, expires_at timestamptz, 
    created_at timestamptz, updated_at timestamptz, user_handle text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
SELECT 
    dr.id, dr.user_id, dr.name, dr.slug, dr.description, dr.icon_url, dr.require_email, 
    dr.require_password, dr.expires_at, dr.created_at, dr.updated_at,
    p.handle as user_handle
FROM public.data_rooms dr
JOIN public.profiles p ON dr.user_id = p.id
WHERE dr.is_public = TRUE
  AND (dr.expires_at IS NULL OR dr.expires_at > NOW());
$$;

-- Cleanup the old, insecure "viewable by everyone" policy if it exists.
DROP POLICY IF EXISTS "Public profile fields are viewable by everyone" ON public.profiles;

-- Public reads go through SECURITY DEFINER functions above.
-- Raw table reads stay available to authenticated users and remain filtered by RLS.
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.decks FROM anon;
REVOKE SELECT ON public.data_rooms FROM anon;

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.decks TO authenticated;
GRANT SELECT ON public.data_rooms TO authenticated;

-- GRANT VIEW / FUNCTION PERMISSIONS --
GRANT EXECUTE ON FUNCTION public.get_profiles_public() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_tier_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_rooms_public() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_decks_public(TEXT) TO anon, authenticated;

-- Direct INSERT into deck_page_views is blocked.
-- All page view writes must go through record_deck_visit (SECURITY DEFINER)
-- which sanitizes inputs and enforces rate limits before inserting.
-- This prevents callers from forging visitor_id, location, time_spent, etc.
DROP POLICY IF EXISTS "Public can log valid page views" ON public.deck_page_views;
-- NOTE: No replacement INSERT policy is created here intentionally.
-- record_deck_visit runs as the table owner (SECURITY DEFINER) and bypasses RLS.


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
SET search_path = public, extensions
AS $$
BEGIN
  -- Handle NULL or empty string password clears
  IF NEW.view_password IS NULL OR NEW.view_password = '' THEN
    NEW.view_password = NULL;
    RETURN NEW;
  END IF;

  -- Only hash if it changed and isn't already hashed
  IF NEW.view_password IS DISTINCT FROM OLD.view_password THEN
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
SET search_path = public, extensions
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
SET search_path = public, extensions
AS $$
BEGIN
    DELETE FROM public.auth_rate_limits WHERE ip_address = p_ip AND target_slug = p_slug;
END;
$$;

-- Secure password validation function for Decks
CREATE OR REPLACE FUNCTION public.check_deck_password(
    p_slug TEXT,
    p_password TEXT,
    p_link_token TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- runs as owner
SET search_path = public, extensions
AS $$
DECLARE
    v_hashed_pw TEXT;
    v_ip TEXT := current_setting('request.headers', true)::json->>'x-forwarded-for';
BEGIN
    SELECT view_password INTO v_hashed_pw 
    FROM public.decks d
    WHERE d.slug = p_slug 
      AND (d.expires_at IS NULL OR d.expires_at > NOW())
      AND (
        (
          p_link_token IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.deck_links dl
            WHERE dl.deck_id = d.id
              AND dl.is_primary = TRUE
              AND dl.is_enabled = TRUE
          )
        )
        OR
        (
          p_link_token IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.deck_links dl
            WHERE dl.deck_id = d.id
              AND dl.public_token = p_link_token
              AND dl.is_enabled = TRUE
          )
        )
      );

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

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

CREATE OR REPLACE FUNCTION public.check_deck_password(p_slug TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
SELECT public.check_deck_password(p_slug, p_password, NULL);
$$;

-- Secure password validation function for Data Rooms
CREATE OR REPLACE FUNCTION public.check_data_room_password(p_slug TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_hashed_pw TEXT;
    v_ip TEXT := current_setting('request.headers', true)::json->>'x-forwarded-for';
BEGIN
    SELECT view_password INTO v_hashed_pw 
    FROM public.data_rooms 
    WHERE slug = p_slug 
      AND (expires_at IS NULL OR expires_at > NOW());

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

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
-- get_deck_payload enforces password + expiry BEFORE returning anything.
-- It returns the storage object path (not a public URL) so the caller can
-- request a short-lived signed URL via the sign-deck-url Edge Function.
-- The path alone cannot be used to download the file since the bucket is private.
CREATE OR REPLACE FUNCTION public.get_deck_payload(
    p_slug TEXT,
    p_password TEXT,
    p_link_token TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_deck RECORD;
    v_storage_path TEXT;
BEGIN
    SELECT * INTO v_deck 
    FROM public.decks 
    WHERE slug = p_slug 
      AND (expires_at IS NULL OR expires_at > NOW());
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_deck.user_id
          AND p_link_token IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.deck_links dl
            WHERE dl.deck_id = v_deck.id
              AND dl.is_primary = TRUE
              AND dl.is_enabled = TRUE
          ) THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_deck.user_id
          AND p_link_token IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.deck_links dl
            WHERE dl.deck_id = v_deck.id
              AND dl.public_token = p_link_token
              AND dl.is_enabled = TRUE
          ) THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_deck.user_id
          AND v_deck.require_password
          AND NOT public.check_deck_password(p_slug, p_password, p_link_token) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Extract just the storage object path from the stored URL.
    -- The file_url is a full Supabase storage URL; we strip the base to get the path.
    -- e.g. https://.../storage/v1/object/public/decks/user123/decks/file.pdf
    --   => user123/decks/file.pdf
    -- The client then exchanges this path for a short-lived signed URL via Edge Function.
    v_storage_path := regexp_replace(
        v_deck.file_url,
        '^.*/storage/v1/object/(public|sign|authenticated)/decks/',
        ''
    );

    RETURN jsonb_build_object(
        'storage_path', v_storage_path,
        'file_url', v_deck.file_url,  -- kept for backwards compat; client should prefer signed URL
        'pages', v_deck.pages
    )::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_deck_payload(p_slug TEXT, p_password TEXT)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
SELECT public.get_deck_payload(p_slug, p_password, NULL);
$$;

CREATE OR REPLACE FUNCTION public.get_data_room_payload(p_slug TEXT, p_password TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_room RECORD;
    v_documents jsonb;
BEGIN
    SELECT * INTO v_room 
    FROM public.data_rooms 
    WHERE slug = p_slug 
      AND (expires_at IS NULL OR expires_at > NOW());
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id
          AND NOT v_room.is_public THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id
          AND v_room.require_password
          AND NOT public.check_data_room_password(p_slug, p_password) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Fetch documents and payloads for this room.
    -- storage_path is extracted from file_url so clients can exchange it for
    -- a short-lived signed URL via the sign-deck-url Edge Function (same pattern
    -- as get_deck_payload). file_url is kept for backwards compatibility.
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
            'storage_path', regexp_replace(
                d.file_url,
                '^.*/storage/v1/object/(public|sign|authenticated)/decks/',
                ''
            ),
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
SET search_path = public, extensions
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
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT COUNT(DISTINCT visitor_id)::INTEGER
  FROM public.deck_page_views
  WHERE deck_id = p_deck_id;
$$;

-- 2. Get aggregated location stats (Returns exact structure for frontend)
CREATE OR REPLACE FUNCTION public.get_deck_locations(p_deck_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
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
GRANT EXECUTE ON FUNCTION public.count_unique_visitors(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_deck_locations(UUID) TO authenticated;

-- =============================================================================
-- ADVANCED RATE LIMITING & CAPACITY ENFORCEMENT
-- =============================================================================

-- SIGNUP THROTTLING (Security Hook)
CREATE TABLE IF NOT EXISTS public.signup_throttle (
    ip_address TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signup_throttle_ip ON public.signup_throttle(ip_address, created_at);

ALTER TABLE public.signup_throttle ENABLE ROW LEVEL SECURITY;
-- No policies added: signup_throttle is strictly internal and accessed via security definer functions.

-- Cleanup task for signup throttle (optional: runs via cron)
CREATE OR REPLACE FUNCTION public.cleanup_signup_throttle()
RETURNS VOID LANGUAGE sql AS $$
  DELETE FROM public.signup_throttle WHERE created_at < NOW() - INTERVAL '24 hours';
$$;

-- AUTH HOOK: Signups strictly 3 per hour per IP
CREATE OR REPLACE FUNCTION public.validate_signup_throttle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_ip TEXT := current_setting('request.headers', true)::json->>'x-forwarded-for';
    v_count INTEGER;
BEGIN
    -- Extract IP
    IF v_ip IS NOT NULL AND trim(v_ip) != '' THEN
        v_ip := trim(split_part(v_ip, ',', 1));
    END IF;
    IF v_ip IS NULL OR trim(v_ip) = '' THEN 
        v_ip := COALESCE(inet_client_addr()::text, 'local'); 
    END IF;

    -- Count attempts in last hour
    SELECT count(*)::INTEGER INTO v_count
    FROM public.signup_throttle
    WHERE ip_address = v_ip AND created_at > NOW() - INTERVAL '1 hour';

    IF v_count >= 3 THEN
        RAISE EXCEPTION 'Too many signup attempts from this IP. Please try again after 1 hour.';
    END IF;

    -- Log the attempt
    INSERT INTO public.signup_throttle (ip_address) VALUES (v_ip);

    -- Return success to Auth
    RETURN jsonb_build_object('success', true);
END;
$$;

-- DECK CREATION LIMIT: Combined Capacity + Time-based Rate Limit
CREATE OR REPLACE FUNCTION public.enforce_deck_creation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_config public.tier_limits;
    v_daily_count INTEGER;
    v_total_count INTEGER;
BEGIN
    -- 1. Fetch user config
    v_config := public.get_current_user_tier_limit();
    IF v_config IS NULL THEN 
        RAISE EXCEPTION 'Unable to determine user tier limits for user %', auth.uid(); 
    END IF;

    -- 2. Check Daily Rate Limit (30/day regardless of tier)
    SELECT count(*)::INTEGER INTO v_daily_count
    FROM public.decks
    WHERE user_id = auth.uid()
      AND created_at > NOW() - INTERVAL '24 hours';

    IF v_daily_count >= v_config.max_decks_per_day THEN
        RAISE EXCEPTION 'Daily deck creation limit reached (%/day). Please try again tomorrow.', v_config.max_decks_per_day;
    END IF;

    -- 3. Check Total Library Capacity (e.g. 10 for FREE, 50 for PRO, -1 for PRO_PLUS)
    IF v_config.max_decks <> -1 THEN
        SELECT count(*)::INTEGER INTO v_total_count
        FROM public.decks
        WHERE user_id = auth.uid()
          AND status <> 'DELETED';

        IF v_total_count >= v_config.max_decks THEN
            RAISE EXCEPTION 'Total library limit reached (% decks). Please delete an existing deck to upload more.', v_config.max_decks;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_deck_limit ON public.decks;
CREATE TRIGGER tr_enforce_deck_limit
    BEFORE INSERT ON public.decks
    FOR EACH ROW EXECUTE FUNCTION public.enforce_deck_creation_limit();

-- DATA ROOM CAPACITY: Dynamic check via tier_limits
CREATE OR REPLACE FUNCTION public.enforce_data_room_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_config public.tier_limits;
    v_count INTEGER;
BEGIN
    -- Support dynamic capacities per tier, though currently all set to 50
    v_config := public.get_current_user_tier_limit();
    
    SELECT count(*)::INTEGER INTO v_count
    FROM public.data_room_documents
    WHERE data_room_id = NEW.data_room_id;

    IF v_config IS NULL THEN
        RAISE EXCEPTION 'Unable to determine user tier limits for user %', auth.uid();
    ELSIF v_count >= COALESCE(v_config.max_decks_per_room, 50) THEN
        RAISE EXCEPTION 'Data Room capacity reached (max % decks). Please remove an existing deck to add a new one.', COALESCE(v_config.max_decks_per_room, 50);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_data_room_limit ON public.data_room_documents;
CREATE TRIGGER tr_enforce_data_room_limit
    BEFORE INSERT ON public.data_room_documents
    FOR EACH ROW EXECUTE FUNCTION public.enforce_data_room_capacity();

-- GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_deck_payload(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_deck_payload(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_deck_password(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_deck_password(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_room_payload(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_data_room_password(TEXT, TEXT) TO anon, authenticated;

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
-- Drop current and legacy prod policy names
DROP POLICY IF EXISTS "Users can manage their own library" ON public.investor_library;
DROP POLICY IF EXISTS "Owners can view bookmarks of their decks" ON public.investor_library;
-- Drop new names too so schema reruns are idempotent
DROP POLICY IF EXISTS "Users can read library entries" ON public.investor_library;
DROP POLICY IF EXISTS "Users can insert into their own library" ON public.investor_library;
DROP POLICY IF EXISTS "Users can update their own library" ON public.investor_library;
DROP POLICY IF EXISTS "Users can delete from their own library" ON public.investor_library;

-- Merged SELECT: own entries + deck-owner visibility (eliminates multiple_permissive_policies)
CREATE POLICY "Users can read library entries" ON public.investor_library
    FOR SELECT USING (
        (select auth.uid()) = user_id
        OR EXISTS (
            SELECT 1 FROM public.decks
            WHERE decks.id = deck_id AND decks.user_id = (select auth.uid())
        )
    );

-- Explicit write policies (owner only)
CREATE POLICY "Users can insert into their own library" ON public.investor_library
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own library" ON public.investor_library
    FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete from their own library" ON public.investor_library
    FOR DELETE USING ((select auth.uid()) = user_id);


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
DROP POLICY IF EXISTS "Notes are strictly private" ON public.investor_notes;
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
    tag_id UUID NOT NULL REFERENCES public.global_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (folder_id, tag_id)
);

-- Deck tags junction
CREATE TABLE IF NOT EXISTS public.library_deck_tags (
    library_id UUID NOT NULL REFERENCES public.investor_library(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.global_tags(id) ON DELETE CASCADE,
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

-- Drop prod legacy names before creating
DROP POLICY IF EXISTS "Owner only folders" ON public.library_folders; -- prod legacy
DROP POLICY IF EXISTS "Owner only" ON public.library_folders;
CREATE POLICY "Owner only" ON public.library_folders
    FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owner only tags" ON public.library_tags; -- prod legacy
DROP POLICY IF EXISTS "Owner only" ON public.library_tags;
CREATE POLICY "Owner only" ON public.library_tags
    FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Owner only folder_tags" ON public.library_folder_tags; -- prod legacy
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

DROP POLICY IF EXISTS "Owner only deck_tags" ON public.library_deck_tags; -- prod legacy
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_library_folders_user ON public.library_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_library_tags_user ON public.library_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_investor_library_folder ON public.investor_library(folder_id);
CREATE INDEX IF NOT EXISTS idx_library_folder_tags_folder ON public.library_folder_tags(folder_id);
CREATE INDEX IF NOT EXISTS idx_library_folder_tags_tag ON public.library_folder_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_library_deck_tags_library ON public.library_deck_tags(library_id);
CREATE INDEX IF NOT EXISTS idx_library_deck_tags_tag ON public.library_deck_tags(tag_id);

-- 11B. SAVED DATA ROOMS (MIXED LIBRARY)

CREATE TABLE IF NOT EXISTS public.saved_data_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data_room_id UUID REFERENCES public.data_rooms(id) ON DELETE SET NULL,
    content TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, data_room_id)
);

CREATE TABLE IF NOT EXISTS public.library_data_room_tags (
    saved_room_id UUID NOT NULL REFERENCES public.saved_data_rooms(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.global_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (saved_room_id, tag_id)
);

ALTER TABLE public.saved_data_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_data_room_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_data_room_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner only saved rooms" ON public.saved_data_rooms;
CREATE POLICY "Owner only saved rooms" ON public.saved_data_rooms
    FOR ALL USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Notes are strictly private" ON public.saved_data_room_notes;
CREATE POLICY "Notes are strictly private" ON public.saved_data_room_notes
    FOR ALL USING ((select auth.uid()) = user_id);

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

CREATE INDEX IF NOT EXISTS idx_saved_data_rooms_user ON public.saved_data_rooms(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_data_rooms_room ON public.saved_data_rooms(data_room_id);
CREATE INDEX IF NOT EXISTS idx_saved_data_rooms_folder ON public.saved_data_rooms(folder_id);
CREATE INDEX IF NOT EXISTS idx_saved_data_room_notes_user_room ON public.saved_data_room_notes(user_id, data_room_id);
CREATE INDEX IF NOT EXISTS idx_library_data_room_tags_room ON public.library_data_room_tags(saved_room_id);
CREATE INDEX IF NOT EXISTS idx_library_data_room_tags_tag ON public.library_data_room_tags(tag_id);

-- 12. AUTHENTICATION TRIGGERS
-- Automatically create profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
DROP POLICY IF EXISTS "notifications_owner_select" ON public.notifications;
CREATE POLICY "notifications_owner_select" ON public.notifications
    FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "notifications_owner_update" ON public.notifications;
CREATE POLICY "notifications_owner_update" ON public.notifications
    FOR UPDATE USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "notifications_owner_delete" ON public.notifications;
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
SET search_path = public, extensions
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
DROP POLICY IF EXISTS "Only admins can view admin_emails" ON public.admin_emails;
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
SET search_path = public, extensions
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
SET search_path = public, extensions
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
SET search_path = public, extensions
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
SET search_path = public, extensions
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
SET search_path = public, extensions
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
SET search_path = public, extensions
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
SET search_path = public, extensions
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
SET search_path = public, extensions
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
SET search_path = public, extensions
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
GRANT EXECUTE ON FUNCTION public.get_deck_payload(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_deck_payload(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_deck_password(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_deck_password(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_room_payload(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_data_room_password(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_deck_visit(UUID, INTEGER, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- =============================================================================
-- SECURITY HARDENING
-- Explicitly revoke default function execution so only intended roles can call
-- SECURITY DEFINER helpers through PostgREST RPC endpoints.
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.update_tutorial_state(JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_current_user_tier_limit() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.count_unique_visitors(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_deck_locations(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_admin_broadcast(UUID[], TEXT, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_admin_broadcast_all(TEXT, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_total_system_users() FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_failed_attempt(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_rate_limit(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_signup_throttle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_deck_save() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_signal_threshold() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_deck_update() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- ALIAS-ONLY DECK LINK IDENTITY OVERRIDES
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_deck_link_alias_workspace_collision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    IF NEW.link_alias IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT d.user_id INTO v_owner_id
    FROM public.decks d
    WHERE d.id = NEW.deck_id;

    IF EXISTS (
        SELECT 1
        FROM public.decks d
        WHERE d.user_id = v_owner_id
          AND d.slug = NEW.link_alias
          AND d.id <> NEW.deck_id
    ) THEN
        RAISE EXCEPTION 'Link alias conflicts with another deck slug in this workspace.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.deck_links dl
        JOIN public.decks d ON d.id = dl.deck_id
        WHERE d.user_id = v_owner_id
          AND dl.link_alias = NEW.link_alias
          AND dl.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
        RAISE EXCEPTION 'Link alias conflicts with another link alias in this workspace.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_deck_slug_workspace_collision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.deck_links dl
        JOIN public.decks d ON d.id = dl.deck_id
        WHERE d.user_id = NEW.user_id
          AND dl.link_alias = NEW.slug
          AND d.id <> NEW.id
    ) THEN
        RAISE EXCEPTION 'Deck slug conflicts with an existing link alias in this workspace.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_deck_link_alias_workspace_collision ON public.deck_links;
CREATE TRIGGER tr_enforce_deck_link_alias_workspace_collision
    BEFORE INSERT OR UPDATE OF link_alias ON public.deck_links
    FOR EACH ROW EXECUTE FUNCTION public.enforce_deck_link_alias_workspace_collision();

DROP TRIGGER IF EXISTS tr_enforce_deck_slug_workspace_collision ON public.decks;
CREATE TRIGGER tr_enforce_deck_slug_workspace_collision
    BEFORE INSERT OR UPDATE OF slug ON public.decks
    FOR EACH ROW EXECUTE FUNCTION public.enforce_deck_slug_workspace_collision();

CREATE OR REPLACE FUNCTION public.resolve_public_deck_link(
    p_handle TEXT DEFAULT NULL,
    p_slug_or_alias TEXT DEFAULT NULL
)
RETURNS TABLE (
    deck_id uuid,
    canonical_slug text,
    user_handle text,
    link_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
    d.id AS deck_id,
    d.slug AS canonical_slug,
    p.handle AS user_handle,
    dl.id AS link_id
FROM public.decks d
JOIN public.profiles p ON p.id = d.user_id
LEFT JOIN public.deck_links dl ON dl.deck_id = d.id AND dl.is_enabled = TRUE
WHERE d.status <> 'DELETED'
  AND (d.expires_at IS NULL OR d.expires_at > NOW())
  AND (
    (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) = d.user_id
      AND p_handle IS NOT NULL
      AND p.handle = p_handle
      AND (
        (p_slug_or_alias = d.slug AND dl.is_primary = TRUE)
        OR dl.link_alias = p_slug_or_alias
      )
    )
    OR
    (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) = d.user_id
      AND p_handle IS NULL
      AND p_slug_or_alias = d.slug
      AND dl.is_primary = TRUE
    )
    OR
    (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) = d.user_id
      AND p_handle IS NULL
      AND dl.link_alias = p_slug_or_alias
    )
    OR
    (
      p_handle IS NULL
      AND p_slug_or_alias = d.slug
      AND dl.is_primary = TRUE
    )
    OR
    (
      p_handle IS NOT NULL
      AND p.handle = p_handle
      AND (
        (p_slug_or_alias = d.slug AND dl.is_primary = TRUE)
        OR dl.link_alias = p_slug_or_alias
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_decks_public(
    p_handle TEXT DEFAULT NULL,
    p_slug_or_alias TEXT DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    title text,
    slug text,
    description text,
    status text,
    file_size bigint,
    display_order integer,
    require_email boolean,
    require_password boolean,
    expires_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    file_type text,
    display_mode text,
    user_handle text
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
    d.file_size,
    d.display_order,
    d.require_email,
    d.require_password,
    d.expires_at,
    d.created_at,
    d.updated_at,
    d.file_type,
    d.display_mode,
    resolved.user_handle
FROM public.resolve_public_deck_link(p_handle, p_slug_or_alias) resolved
JOIN public.decks d ON d.id = resolved.deck_id;
$$;

CREATE OR REPLACE FUNCTION public.get_decks_public()
RETURNS TABLE (
    id uuid,
    user_id uuid,
    title text,
    slug text,
    description text,
    status text,
    file_size bigint,
    display_order integer,
    require_email boolean,
    require_password boolean,
    expires_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    file_type text,
    display_mode text,
    user_handle text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT *
FROM public.get_decks_public(NULL, NULL);
$$;

CREATE OR REPLACE FUNCTION public.check_deck_password(
    p_handle TEXT,
    p_slug_or_alias TEXT,
    p_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_hashed_pw TEXT;
    v_ip TEXT := current_setting('request.headers', true)::json->>'x-forwarded-for';
BEGIN
    SELECT d.view_password INTO v_hashed_pw
    FROM public.resolve_public_deck_link(p_handle, p_slug_or_alias) resolved
    JOIN public.decks d ON d.id = resolved.deck_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_hashed_pw IS NULL THEN
        RETURN TRUE;
    END IF;

    IF v_ip IS NOT NULL AND trim(v_ip) != '' THEN
        v_ip := trim(split_part(v_ip, ',', 1));
    END IF;
    IF v_ip IS NULL OR trim(v_ip) = '' THEN
        v_ip := COALESCE(inet_client_addr()::text, 'local');
    END IF;

    IF NOT public.check_rate_limit(v_ip, p_slug_or_alias) THEN
        RAISE EXCEPTION 'Too many failed attempts. Please try again later.';
    END IF;

    IF v_hashed_pw = crypt(p_password, v_hashed_pw) THEN
        PERFORM public.clear_rate_limit(v_ip, p_slug_or_alias);
        RETURN TRUE;
    END IF;

    PERFORM public.record_failed_attempt(v_ip, p_slug_or_alias);
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_deck_password(p_slug TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
SELECT public.check_deck_password(NULL, p_slug, p_password);
$$;

CREATE OR REPLACE FUNCTION public.get_deck_payload(
    p_handle TEXT,
    p_slug_or_alias TEXT,
    p_password TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_deck RECORD;
    v_storage_path TEXT;
BEGIN
    SELECT d.* INTO v_deck
    FROM public.resolve_public_deck_link(p_handle, p_slug_or_alias) resolved
    JOIN public.decks d ON d.id = resolved.deck_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized';
    ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_deck.user_id
          AND v_deck.require_password
          AND NOT public.check_deck_password(p_handle, p_slug_or_alias, p_password) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    v_storage_path := regexp_replace(
        v_deck.file_url,
        '^.*/storage/v1/object/(public|sign|authenticated)/decks/',
        ''
    );

    RETURN jsonb_build_object(
        'storage_path', v_storage_path,
        'file_url', v_deck.file_url,
        'pages', v_deck.pages
    )::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_deck_payload(p_slug TEXT, p_password TEXT)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
SELECT public.get_deck_payload(NULL, p_slug, p_password);
$$;

GRANT EXECUTE ON FUNCTION public.resolve_public_deck_link(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_decks_public(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_deck_password(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_deck_payload(TEXT, TEXT, TEXT) TO anon, authenticated;
