
-- =============================================================================
-- 1. RESOURCE GATING & TIER ENFORCEMENT
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
SECURITY DEFINER
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
-- 2. SIGNUP THROTTLING (Security Hook)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.signup_throttle (
    ip_address TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signup_throttle_ip ON public.signup_throttle(ip_address, created_at);

ALTER TABLE public.signup_throttle ENABLE ROW LEVEL SECURITY;

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

    -- Serialize concurrent requests from the same IP using a transactional advisory lock.
    -- hashtext() produces a 32-bit signed integer; both overloads of pg_advisory_xact_lock
    -- accept that value. The lock is automatically released when this transaction ends,
    -- making the COUNT + INSERT below effectively atomic per IP.
    PERFORM pg_advisory_xact_lock(hashtext(v_ip));

    -- Count attempts in last hour (safe to read now that we hold the per-IP lock)
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

-- =============================================================================
-- 3. STORAGE POLICIES HARDENING
-- =============================================================================

-- ---- DECKS BUCKET ----
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

-- ---- ASSETS BUCKET ----
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

-- =============================================================================
-- 4. ANALYTICS FIX
-- =============================================================================

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
    SELECT dr.id
    FROM public.data_rooms dr
    WHERE dr.id = ANY(p_room_ids)
      AND dr.user_id = auth.uid()
  ),
  doc_counts AS (
    SELECT
      drd.data_room_id,
      COUNT(*)::INTEGER AS d_count_local
    FROM public.data_room_documents drd
    JOIN owned_rooms orm ON orm.id = drd.data_room_id
    GROUP BY drd.data_room_id
  ),
  visitor_counts AS (
    SELECT
      dpv.data_room_id,
      COUNT(DISTINCT dpv.visitor_id)::INTEGER AS v_count_local
    FROM public.deck_page_views dpv
    JOIN owned_rooms orm ON orm.id = dpv.data_room_id
    GROUP BY dpv.data_room_id
  )
  SELECT
    orm.id                        AS room_id,
    COALESCE(dc.d_count_local, 0) AS doc_count,
    COALESCE(vc.v_count_local, 0) AS visitors
  FROM owned_rooms orm
  LEFT JOIN doc_counts dc ON dc.data_room_id = orm.id
  LEFT JOIN visitor_counts vc ON vc.data_room_id = orm.id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_batch_data_room_analytics(UUID[]) TO authenticated;
