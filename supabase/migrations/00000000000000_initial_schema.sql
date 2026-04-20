-- =============================================================================
-- DECKLY INITIAL SCHEMA (OPEN SOURCE BASELINE)
-- Consolidated & Hardened — v2 (corrected)
-- =============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";

-- 2. RESOURCE GATING & TIER ENFORCEMENT
CREATE TABLE IF NOT EXISTS "public"."tier_limits" (
    "tier" text PRIMARY KEY,
    "max_file_size_bytes" bigint NOT NULL,
    "max_decks" integer NOT NULL,
    "max_decks_per_day" integer NOT NULL,
    "max_decks_per_room" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now()
);

INSERT INTO "public"."tier_limits" ("tier", "max_file_size_bytes", "max_decks", "max_decks_per_day", "max_decks_per_room")
VALUES
    ('FREE',     10485760,  10, 30, 50),
    ('PRO',      52428800,  50, 30, 50),
    ('PRO_PLUS', 104857600, -1, 30, 50)
ON CONFLICT ("tier") DO UPDATE SET
    "max_file_size_bytes" = EXCLUDED."max_file_size_bytes",
    "max_decks"           = EXCLUDED."max_decks",
    "max_decks_per_day"   = EXCLUDED."max_decks_per_day",
    "max_decks_per_room"  = EXCLUDED."max_decks_per_room";

ALTER TABLE "public"."tier_limits" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view tier limits" ON "public"."tier_limits";
CREATE POLICY "Anyone can view tier limits" ON "public"."tier_limits"
    FOR SELECT TO anon, authenticated USING (true);

-- 3. SIGNUP THROTTLING (Security Hook)
CREATE TABLE IF NOT EXISTS "public"."signup_throttle" (
    "ip_address" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_signup_throttle_ip" ON "public"."signup_throttle" ("ip_address", "created_at");
ALTER TABLE "public"."signup_throttle" ENABLE ROW LEVEL SECURITY;
-- No policies: accessed exclusively via SECURITY DEFINER functions.

-- =============================================================================
-- 4. TABLES & CORE SCHEMA
-- =============================================================================

-- Profiles
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    "updated_at" timestamp with time zone,
    "full_name" text,
    "avatar_url" text,
    "tier" text DEFAULT 'FREE'::text,
    "handle" text UNIQUE,
    "created_at" timestamp with time zone DEFAULT now(),
    "tutorial_state" jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

-- Decks
CREATE TABLE IF NOT EXISTS "public"."decks" (
    "id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "title" text NOT NULL,
    "slug" text UNIQUE NOT NULL,
    "description" text,
    "file_url" text,
    "pages" jsonb DEFAULT '[]'::jsonb,
    "display_mode" text DEFAULT 'raw'::text,
    "file_type" text DEFAULT 'pdf'::text,
    "status" text DEFAULT 'PENDING'::text,
    "file_size" bigint,
    "display_order" integer DEFAULT 1,
    "require_email" boolean DEFAULT false,
    "require_password" boolean DEFAULT false,
    "is_public" boolean NOT NULL DEFAULT false,
    "view_password" text,
    "unique_visitors" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."decks" ENABLE ROW LEVEL SECURITY;

-- Branding
CREATE TABLE IF NOT EXISTS "public"."branding" (
    "id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    "room_name" text DEFAULT 'Deckly Data Room'::text,
    "banner_url" text,
    "logo_url" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."branding" ENABLE ROW LEVEL SECURITY;

-- Data Rooms
CREATE TABLE IF NOT EXISTS "public"."data_rooms" (
    "id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "name" text NOT NULL,
    "slug" text UNIQUE NOT NULL,
    "description" text,
    "icon_url" text,
    "require_email" boolean DEFAULT false,
    "require_password" boolean DEFAULT false,
    "is_public" boolean NOT NULL DEFAULT false,
    "view_password" text,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."data_rooms" ENABLE ROW LEVEL SECURITY;

-- Data Room Documents
CREATE TABLE IF NOT EXISTS "public"."data_room_documents" (
    "id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    "data_room_id" uuid NOT NULL REFERENCES public.data_rooms(id) ON DELETE CASCADE,
    "deck_id" uuid NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    "display_order" integer DEFAULT 0,
    "added_at" timestamp with time zone DEFAULT now(),
    UNIQUE("data_room_id", "deck_id")
);
ALTER TABLE "public"."data_room_documents" ENABLE ROW LEVEL SECURITY;

-- Analytics: Page Views
-- NOTE: intentionally allows multiple rows per visitor (one per page/session).
-- Unique visitor counting is done via the notify_signal_threshold trigger
-- which atomically increments decks.unique_visitors on first-ever visit.
CREATE TABLE IF NOT EXISTS "public"."deck_page_views" (
    "id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    "deck_id" uuid NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    "data_room_id" uuid REFERENCES public.data_rooms(id) ON DELETE CASCADE,
    "page_number" integer NOT NULL,
    "visitor_id" text NOT NULL,
    "viewer_email" text,
    "viewed_at" timestamp with time zone DEFAULT now(),
    "time_spent" numeric DEFAULT 0,
    "country" text DEFAULT 'Unknown'::text,
    "city" text DEFAULT 'Unknown City'::text,
    "country_code" text
);
ALTER TABLE "public"."deck_page_views" ENABLE ROW LEVEL SECURITY;

-- Analytics: Aggregated Stats
-- IMPORTANT: Do NOT add a plain UNIQUE on (deck_id, page_number, data_room_id)
-- because data_room_id is nullable and two NULLs are never equal in SQL.
-- The partial unique index below handles this correctly using COALESCE.
CREATE TABLE IF NOT EXISTS "public"."deck_stats" (
    "id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    "deck_id" uuid NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    "data_room_id" uuid REFERENCES public.data_rooms(id) ON DELETE CASCADE,
    "page_number" integer NOT NULL,
    "user_id" uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    "total_views" integer DEFAULT 0,
    "total_time_seconds" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."deck_stats" ENABLE ROW LEVEL SECURITY;

-- Admin emails allowlist
CREATE TABLE IF NOT EXISTS "public"."admin_emails" (
    "email" text PRIMARY KEY,
    "added_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."admin_emails" ENABLE ROW LEVEL SECURITY;

-- Password Rate Limiting
CREATE TABLE IF NOT EXISTS "public"."auth_rate_limits" (
    "ip_address" text NOT NULL,
    "target_slug" text NOT NULL,
    "failed_attempts" integer DEFAULT 0,
    "last_attempt_at" timestamp with time zone DEFAULT now(),
    PRIMARY KEY ("ip_address", "target_slug")
);
ALTER TABLE "public"."auth_rate_limits" ENABLE ROW LEVEL SECURITY;
-- No policies: managed exclusively via SECURITY DEFINER functions.

-- Investor Library
CREATE TABLE IF NOT EXISTS "public"."investor_library" (
    "id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    "user_id" uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    "deck_id" uuid NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    "last_viewed_at" timestamp with time zone DEFAULT now(),
    "created_at" timestamp with time zone DEFAULT now(),
    "folder_id" uuid,
    UNIQUE("user_id", "deck_id")
);
ALTER TABLE "public"."investor_library" ENABLE ROW LEVEL SECURITY;

-- Investor Notes
CREATE TABLE IF NOT EXISTS "public"."investor_notes" (
    "id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "deck_id" uuid NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    "content" text DEFAULT ''::text,
    "updated_at" timestamp with time zone DEFAULT now(),
    "created_at" timestamp with time zone DEFAULT now(),
    UNIQUE("user_id", "deck_id")
);
ALTER TABLE "public"."investor_notes" ENABLE ROW LEVEL SECURITY;

-- Library Folders
CREATE TABLE IF NOT EXISTS "public"."library_folders" (
    "id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "name" text NOT NULL CHECK (char_length(name) <= 30),
    "color" text NOT NULL DEFAULT '#666666'::text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."library_folders" ENABLE ROW LEVEL SECURITY;

-- Library Tags
CREATE TABLE IF NOT EXISTS "public"."library_tags" (
    "id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "name" text NOT NULL CHECK (char_length(name) <= 30),
    "color" text NOT NULL DEFAULT '#666666'::text,
    "created_at" timestamp with time zone DEFAULT now(),
    UNIQUE("user_id", "name")
);
ALTER TABLE "public"."library_tags" ENABLE ROW LEVEL SECURITY;

-- Library Folder-Tag Junction
CREATE TABLE IF NOT EXISTS "public"."library_folder_tags" (
    "folder_id" uuid NOT NULL REFERENCES public.library_folders(id) ON DELETE CASCADE,
    "tag_id" uuid NOT NULL REFERENCES public.library_tags(id) ON DELETE CASCADE,
    PRIMARY KEY ("folder_id", "tag_id")
);
ALTER TABLE "public"."library_folder_tags" ENABLE ROW LEVEL SECURITY;

-- Library Deck-Tag Junction
CREATE TABLE IF NOT EXISTS "public"."library_deck_tags" (
    "library_id" uuid NOT NULL REFERENCES public.investor_library(id) ON DELETE CASCADE,
    "tag_id" uuid NOT NULL REFERENCES public.library_tags(id) ON DELETE CASCADE,
    PRIMARY KEY ("library_id", "tag_id")
);
ALTER TABLE "public"."library_deck_tags" ENABLE ROW LEVEL SECURITY;

-- Notifications
CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    "user_id" uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    "type" text NOT NULL CHECK (type = ANY (ARRAY[
        'deck_view'::text, 'deck_save'::text, 'signal_threshold'::text,
        'deck_update'::text, 'admin_message'::text
    ])),
    "title" text NOT NULL,
    "message" text NOT NULL,
    "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "expires_at" timestamp with time zone NOT NULL DEFAULT (now() + '30 days'::interval)
);
ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS "idx_profiles_handle"
    ON "public"."profiles" ("handle");
CREATE INDEX IF NOT EXISTS "idx_data_rooms_user"
    ON "public"."data_rooms" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_data_room_docs_room"
    ON "public"."data_room_documents" ("data_room_id", "display_order");
CREATE INDEX IF NOT EXISTS "idx_deck_stats_dashboard"
    ON "public"."deck_stats" ("deck_id", "user_id", "updated_at");
-- Correct unique index: treats NULL data_room_id as a sentinel value so UPSERT works
CREATE UNIQUE INDEX IF NOT EXISTS "idx_deck_stats_unique_room"
    ON "public"."deck_stats" ("deck_id", "page_number",
        (COALESCE("data_room_id", '00000000-0000-0000-0000-000000000000'::uuid)));
CREATE INDEX IF NOT EXISTS "idx_auth_rate_limits_last_attempt"
    ON "public"."auth_rate_limits" ("last_attempt_at");
CREATE INDEX IF NOT EXISTS "idx_investor_library_user"
    ON "public"."investor_library" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_investor_library_deck"
    ON "public"."investor_library" ("deck_id");
CREATE INDEX IF NOT EXISTS "idx_page_views_visitor"
    ON "public"."deck_page_views" ("deck_id", "visitor_id");
CREATE INDEX IF NOT EXISTS "idx_investor_notes_user_deck"
    ON "public"."investor_notes" ("user_id", "deck_id");
CREATE INDEX IF NOT EXISTS "idx_library_folders_user"
    ON "public"."library_folders" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_library_tags_user"
    ON "public"."library_tags" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_user"
    ON "public"."notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_unread"
    ON "public"."notifications" ("user_id") WHERE ("read_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_notifications_user_unread_created"
    ON "public"."notifications" ("user_id", "created_at" DESC) WHERE ("read_at" IS NULL);
CREATE INDEX IF NOT EXISTS "idx_notifications_created"
    ON "public"."notifications" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_notifications_expires"
    ON "public"."notifications" ("expires_at");

-- =============================================================================
-- 6. FUNCTIONS
-- =============================================================================

-- Tier helper (must come before triggers that reference it)
CREATE OR REPLACE FUNCTION public.get_current_user_tier_limit()
RETURNS public.tier_limits
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, extensions AS $$
  SELECT tl.* FROM public.tier_limits tl
  WHERE tl.tier = COALESCE((SELECT tier FROM public.profiles WHERE id = auth.uid()), 'FREE');
$$;

-- Signup throttle hook (called by Supabase Auth)
CREATE OR REPLACE FUNCTION public.validate_signup_throttle()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
    v_ip TEXT := current_setting('request.headers', true)::json->>'x-forwarded-for';
    v_count INTEGER;
BEGIN
    IF v_ip IS NOT NULL AND trim(v_ip) != '' THEN v_ip := trim(split_part(v_ip, ',', 1)); END IF;
    IF v_ip IS NULL OR trim(v_ip) = '' THEN v_ip := COALESCE(inet_client_addr()::text, 'local'); END IF;
    SELECT count(*)::INTEGER INTO v_count FROM public.signup_throttle
        WHERE ip_address = v_ip AND created_at > NOW() - INTERVAL '1 hour';
    IF v_count >= 3 THEN
        RAISE EXCEPTION 'Too many signup attempts from this IP. Please try again after 1 hour.';
    END IF;
    INSERT INTO public.signup_throttle (ip_address) VALUES (v_ip);
    RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.cleanup_signup_throttle()
RETURNS VOID LANGUAGE sql AS $$
  DELETE FROM public.signup_throttle WHERE created_at < NOW() - INTERVAL '24 hours';
$$;

-- Profile auto-creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END; $$;

-- Admin check
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_uid uuid; v_email text;
BEGIN
    v_uid := COALESCE(p_user_id, auth.uid());
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    RETURN EXISTS (SELECT 1 FROM public.admin_emails WHERE email = v_email);
END; $$;

-- Tutorial state RPC
CREATE OR REPLACE FUNCTION public.update_tutorial_state(p_state jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
    UPDATE public.profiles
    SET tutorial_state = COALESCE(tutorial_state, '{}'::jsonb) || p_state,
        updated_at = NOW()
    WHERE id = auth.uid();
END; $$;

-- Password hashing trigger function
CREATE OR REPLACE FUNCTION public.hash_password_trigger()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, extensions AS $$
BEGIN
    IF NEW.view_password IS NULL OR NEW.view_password = '' THEN
        NEW.view_password = NULL;
        RETURN NEW;
    END IF;
    IF NEW.view_password IS DISTINCT FROM OLD.view_password THEN
        IF NEW.view_password NOT LIKE '$2a$%'
           AND NEW.view_password NOT LIKE '$2b$%'
           AND NEW.view_password NOT LIKE '$2y$%' THEN
            NEW.view_password = crypt(NEW.view_password, gen_salt('bf'));
        END IF;
    END IF;
    RETURN NEW;
END; $$;

-- Rate limiting helpers
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_ip text, p_slug text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_attempts integer; v_last_attempt timestamptz;
BEGIN
    SELECT failed_attempts, last_attempt_at INTO v_attempts, v_last_attempt
        FROM public.auth_rate_limits WHERE ip_address = p_ip AND target_slug = p_slug;
    IF FOUND AND v_attempts >= 5 AND (NOW() - v_last_attempt) < INTERVAL '5 minutes' THEN RETURN FALSE; END IF;
    IF FOUND AND (NOW() - v_last_attempt) >= INTERVAL '5 minutes' THEN
        UPDATE public.auth_rate_limits SET failed_attempts = 0 WHERE ip_address = p_ip AND target_slug = p_slug;
    END IF;
    RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION public.record_failed_attempt(p_ip text, p_slug text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
    INSERT INTO public.auth_rate_limits (ip_address, target_slug, failed_attempts, last_attempt_at)
    VALUES (p_ip, p_slug, 1, NOW())
    ON CONFLICT (ip_address, target_slug)
    DO UPDATE SET failed_attempts = auth_rate_limits.failed_attempts + 1, last_attempt_at = NOW();
END; $$;

CREATE OR REPLACE FUNCTION public.clear_rate_limit(p_ip text, p_slug text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
    DELETE FROM public.auth_rate_limits WHERE ip_address = p_ip AND target_slug = p_slug;
END; $$;

-- Password validation RPCs
CREATE OR REPLACE FUNCTION public.check_deck_password(p_slug text, p_password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
    v_hashed_pw text;
    v_ip text := current_setting('request.headers', true)::json->>'x-forwarded-for';
BEGIN
    SELECT view_password INTO v_hashed_pw FROM public.decks
        WHERE slug = p_slug AND (expires_at IS NULL OR expires_at > NOW());
    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF v_hashed_pw IS NULL THEN RETURN TRUE; END IF;
    IF v_ip IS NOT NULL AND trim(v_ip) != '' THEN v_ip := trim(split_part(v_ip, ',', 1)); END IF;
    IF v_ip IS NULL OR trim(v_ip) = '' THEN v_ip := COALESCE(inet_client_addr()::text, 'local'); END IF;
    IF NOT public.check_rate_limit(v_ip, p_slug) THEN
        RAISE EXCEPTION 'Too many failed attempts. Please try again later.';
    END IF;
    IF v_hashed_pw = crypt(p_password, v_hashed_pw) THEN
        PERFORM public.clear_rate_limit(v_ip, p_slug); RETURN TRUE;
    END IF;
    PERFORM public.record_failed_attempt(v_ip, p_slug); RETURN FALSE;
END; $$;

CREATE OR REPLACE FUNCTION public.check_data_room_password(p_slug text, p_password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
    v_hashed_pw text;
    v_ip text := current_setting('request.headers', true)::json->>'x-forwarded-for';
BEGIN
    SELECT view_password INTO v_hashed_pw FROM public.data_rooms
        WHERE slug = p_slug AND (expires_at IS NULL OR expires_at > NOW());
    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF v_hashed_pw IS NULL THEN RETURN TRUE; END IF;
    IF v_ip IS NOT NULL AND trim(v_ip) != '' THEN v_ip := trim(split_part(v_ip, ',', 1)); END IF;
    IF v_ip IS NULL OR trim(v_ip) = '' THEN v_ip := COALESCE(inet_client_addr()::text, 'local'); END IF;
    IF NOT public.check_rate_limit(v_ip, p_slug) THEN
        RAISE EXCEPTION 'Too many failed attempts. Please try again later.';
    END IF;
    IF v_hashed_pw = crypt(p_password, v_hashed_pw) THEN
        PERFORM public.clear_rate_limit(v_ip, p_slug); RETURN TRUE;
    END IF;
    PERFORM public.record_failed_attempt(v_ip, p_slug); RETURN FALSE;
END; $$;

-- Public-safe read functions (bypass restricted RLS; exclude sensitive columns)
CREATE OR REPLACE FUNCTION public.get_profiles_public()
RETURNS TABLE (id uuid, handle text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT id, handle FROM public.profiles;
$$;

CREATE OR REPLACE FUNCTION public.get_decks_public()
RETURNS TABLE (
    id uuid, user_id uuid, title text, slug text, description text, status text,
    file_size bigint, display_order integer, require_email boolean, require_password boolean,
    expires_at timestamptz, created_at timestamptz, updated_at timestamptz,
    file_type text, display_mode text, unique_visitors integer, user_handle text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT d.id, d.user_id, d.title, d.slug, d.description, d.status,
           d.file_size, d.display_order, d.require_email, d.require_password,
           d.expires_at, d.created_at, d.updated_at, d.file_type, d.display_mode,
           d.unique_visitors, p.handle as user_handle
    FROM public.decks d
    JOIN public.profiles p ON d.user_id = p.id
    WHERE d.is_public = TRUE
      AND d.status <> 'DELETED'
      AND (d.expires_at IS NULL OR d.expires_at > NOW());
$$;

CREATE OR REPLACE FUNCTION public.get_data_rooms_public()
RETURNS TABLE (
    id uuid, user_id uuid, name text, slug text, description text, icon_url text,
    require_email boolean, require_password boolean, expires_at timestamptz,
    created_at timestamptz, updated_at timestamptz, user_handle text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    SELECT dr.id, dr.user_id, dr.name, dr.slug, dr.description, dr.icon_url,
           dr.require_email, dr.require_password, dr.expires_at,
           dr.created_at, dr.updated_at, p.handle as user_handle
    FROM public.data_rooms dr
    JOIN public.profiles p ON dr.user_id = p.id
    WHERE dr.is_public = TRUE
      AND (dr.expires_at IS NULL OR dr.expires_at > NOW());
$$;

-- Dashboard: batch sign thumbnail storage paths for owner's decks
CREATE OR REPLACE FUNCTION public.get_owner_thumbnails()
RETURNS TABLE (deck_id uuid, storage_path text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
    RETURN QUERY
    SELECT d.id as deck_id,
        CASE
            WHEN (d.pages->0->>'image_url') IS NOT NULL THEN
                regexp_replace(d.pages->0->>'image_url', '^.*/storage/v1/object/(public|sign|authenticated)/decks/', '')
            WHEN (d.pages->0->>'url') IS NOT NULL THEN
                regexp_replace(d.pages->0->>'url', '^.*/storage/v1/object/(public|sign|authenticated)/decks/', '')
            ELSE NULL
        END as storage_path
    FROM public.decks d
    WHERE d.user_id = auth.uid() AND d.status = 'PROCESSED';
END; $$;

-- Analytics: batch room stats for the dashboard (owner-scoped, alias-safe)
CREATE OR REPLACE FUNCTION public.get_batch_data_room_analytics(p_room_ids uuid[])
RETURNS TABLE (room_id uuid, doc_count integer, visitors integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
    RETURN QUERY
    WITH owned_rooms AS (
        SELECT dr.id FROM public.data_rooms dr
        WHERE dr.id = ANY(p_room_ids) AND dr.user_id = auth.uid()
    ),
    doc_counts AS (
        SELECT drd.data_room_id,
               COUNT(*)::INTEGER AS d_count_local
        FROM public.data_room_documents drd
        JOIN owned_rooms orm ON orm.id = drd.data_room_id
        GROUP BY drd.data_room_id
    ),
    visitor_counts AS (
        SELECT dpv.data_room_id,
               COUNT(DISTINCT dpv.visitor_id)::INTEGER AS v_count_local
        FROM public.deck_page_views dpv
        JOIN owned_rooms orm ON orm.id = dpv.data_room_id
        GROUP BY dpv.data_room_id
    )
    SELECT orm.id AS room_id,
           COALESCE(dc.d_count_local, 0) AS doc_count,
           COALESCE(vc.v_count_local, 0) AS visitors
    FROM owned_rooms orm
    LEFT JOIN doc_counts dc ON dc.data_room_id = orm.id
    LEFT JOIN visitor_counts vc ON vc.data_room_id = orm.id;
END; $$;

-- Analytics: record a single page view (sanitized, rate-limited)
CREATE OR REPLACE FUNCTION public.record_deck_visit(
    p_deck_id uuid, p_page_number integer, p_time_spent numeric, p_visitor_id text,
    p_viewer_email text DEFAULT NULL, p_data_room_id uuid DEFAULT NULL,
    p_country text DEFAULT 'Unknown'::text, p_city text DEFAULT 'Unknown City'::text,
    p_country_code text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
    v_deck_owner_id uuid;
    v_recent_view_id uuid;
    v_is_unique boolean;
    v_email_count integer;
BEGIN
    IF p_time_spent < 0 THEN p_time_spent := 0; END IF;
    p_time_spent := LEAST(p_time_spent, 3600);
    IF LENGTH(p_visitor_id) > 100 THEN p_visitor_id := LEFT(p_visitor_id, 100); END IF;

    IF p_viewer_email IS NOT NULL THEN
        SELECT COUNT(DISTINCT viewer_email) INTO v_email_count
        FROM public.deck_page_views
        WHERE visitor_id = p_visitor_id AND deck_id = p_deck_id AND viewer_email IS NOT NULL;
        IF v_email_count >= 5 THEN p_viewer_email := NULL; END IF;
    END IF;

    IF p_data_room_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.data_room_documents
                       WHERE data_room_id = p_data_room_id AND deck_id = p_deck_id) THEN
            p_data_room_id := NULL;
        END IF;
    END IF;

    SELECT user_id INTO v_deck_owner_id FROM public.decks WHERE id = p_deck_id;
    IF NOT FOUND THEN RETURN; END IF;

    SELECT id INTO v_recent_view_id FROM public.deck_page_views
        WHERE deck_id = p_deck_id AND page_number = p_page_number AND visitor_id = p_visitor_id
          AND ((p_data_room_id IS NULL AND data_room_id IS NULL) OR
               (p_data_room_id IS NOT NULL AND data_room_id = p_data_room_id))
          AND viewed_at > (NOW() - INTERVAL '24 hours')
        LIMIT 1;

    v_is_unique := (v_recent_view_id IS NULL);

    IF v_is_unique THEN
        INSERT INTO public.deck_page_views
            (deck_id, page_number, visitor_id, time_spent, viewer_email, data_room_id, country, city, country_code)
        VALUES
            (p_deck_id, p_page_number, p_visitor_id, p_time_spent, p_viewer_email,
             p_data_room_id, p_country, p_city, p_country_code);
    ELSE
        UPDATE public.deck_page_views SET
            time_spent   = LEAST(time_spent + p_time_spent, 86400),
            viewed_at    = NOW(),
            viewer_email = COALESCE(viewer_email, p_viewer_email),
            country      = CASE WHEN country = 'Unknown' THEN p_country ELSE country END,
            city         = CASE WHEN city = 'Unknown City' THEN p_city ELSE city END,
            country_code = COALESCE(country_code, p_country_code)
        WHERE id = v_recent_view_id;
    END IF;

    INSERT INTO public.deck_stats
        (deck_id, page_number, user_id, data_room_id, total_views, total_time_seconds)
    VALUES
        (p_deck_id, p_page_number, v_deck_owner_id, p_data_room_id,
         CASE WHEN v_is_unique THEN 1 ELSE 0 END, ROUND(p_time_spent::numeric)::INTEGER)
    ON CONFLICT (deck_id, page_number,
        (COALESCE(data_room_id, '00000000-0000-0000-0000-000000000000'::uuid)))
    DO UPDATE SET
        total_views        = deck_stats.total_views + (CASE WHEN v_is_unique THEN 1 ELSE 0 END),
        total_time_seconds = deck_stats.total_time_seconds + ROUND(p_time_spent::numeric)::INTEGER,
        updated_at         = NOW(),
        user_id            = COALESCE(deck_stats.user_id, EXCLUDED.user_id);
END; $$;

-- Count unique visitors for a deck
CREATE OR REPLACE FUNCTION public.count_unique_visitors(p_deck_id uuid)
RETURNS integer LANGUAGE sql SECURITY DEFINER
SET search_path = public, extensions AS $$
    SELECT COUNT(DISTINCT visitor_id)::INTEGER FROM public.deck_page_views WHERE deck_id = p_deck_id;
$$;

-- Aggregated location stats for the analytics dashboard
CREATE OR REPLACE FUNCTION public.get_deck_locations(p_deck_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
    RETURN jsonb_build_object(
        'countries', COALESCE((
            SELECT jsonb_agg(t) FROM (
                SELECT COALESCE(country, 'Unknown') as name,
                       COALESCE(country_code, 'US') as code,
                       COUNT(*)::INTEGER as count
                FROM public.deck_page_views WHERE deck_id = p_deck_id
                GROUP BY country, country_code ORDER BY count DESC
            ) t
        ), '[]'::jsonb),
        'cities', COALESCE((
            SELECT jsonb_agg(t) FROM (
                SELECT COALESCE(city, 'Unknown City') as name,
                       COALESCE(country, 'Unknown') as country,
                       COUNT(*)::INTEGER as count
                FROM public.deck_page_views WHERE deck_id = p_deck_id
                GROUP BY city, country ORDER BY count DESC
            ) t
        ), '[]'::jsonb)
    );
END; $$;

-- Payload RPCs: enforce password + expiry before returning anything
CREATE OR REPLACE FUNCTION public.get_deck_payload(p_slug text, p_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_deck record; v_storage_path text;
BEGIN
    SELECT * INTO v_deck FROM public.decks
        WHERE slug = p_slug AND (expires_at IS NULL OR expires_at > NOW());
    IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_deck.user_id
       AND NOT v_deck.is_public THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_deck.user_id
       AND v_deck.require_password
       AND NOT public.check_deck_password(p_slug, p_password) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    v_storage_path := regexp_replace(
        v_deck.file_url,
        '^.*/storage/v1/object/(public|sign|authenticated)/decks/', ''
    );
    RETURN jsonb_build_object(
        'storage_path', v_storage_path,
        'file_url', v_deck.file_url,
        'pages', v_deck.pages
    )::jsonb;
END; $$;

CREATE OR REPLACE FUNCTION public.get_data_room_payload(p_slug text, p_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_room record; v_documents jsonb;
BEGIN
    SELECT * INTO v_room FROM public.data_rooms
        WHERE slug = p_slug AND (expires_at IS NULL OR expires_at > NOW());
    IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id
       AND NOT v_room.is_public THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id
       AND v_room.require_password
       AND NOT public.check_data_room_password(p_slug, p_password) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', d.id, 'title', d.title, 'slug', d.slug, 'description', d.description,
            'status', d.status, 'file_type', d.file_type, 'display_mode', d.display_mode,
            'file_url', d.file_url,
            'storage_path', regexp_replace(
                d.file_url, '^.*/storage/v1/object/(public|sign|authenticated)/decks/', ''
            ),
            'pages', d.pages
        ) ORDER BY drd.display_order ASC
    ), '[]'::jsonb) INTO v_documents
    FROM public.data_room_documents drd
    JOIN public.decks d ON d.id = drd.deck_id
    WHERE drd.data_room_id = v_room.id;
    RETURN v_documents;
END; $$;

-- Capacity enforcement triggers
CREATE OR REPLACE FUNCTION public.enforce_deck_creation_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_config public.tier_limits; v_daily_count integer; v_total_count integer;
BEGIN
    v_config := public.get_current_user_tier_limit();
    IF v_config IS NULL THEN
        RAISE EXCEPTION 'Unable to determine user tier limits for user %', auth.uid();
    END IF;
    SELECT count(*)::integer INTO v_daily_count FROM public.decks
        WHERE user_id = auth.uid() AND created_at > NOW() - INTERVAL '24 hours';
    IF v_daily_count >= v_config.max_decks_per_day THEN
        RAISE EXCEPTION 'Daily deck creation limit reached (%/day). Please try again tomorrow.', v_config.max_decks_per_day;
    END IF;
    IF v_config.max_decks <> -1 THEN
        SELECT count(*)::integer INTO v_total_count FROM public.decks
            WHERE user_id = auth.uid() AND status <> 'DELETED';
        IF v_total_count >= v_config.max_decks THEN
            RAISE EXCEPTION 'Library limit reached (% decks). Please delete a deck to add more.', v_config.max_decks;
        END IF;
    END IF;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_data_room_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_config public.tier_limits; v_count integer;
BEGIN
    v_config := public.get_current_user_tier_limit();
    SELECT count(*)::integer INTO v_count FROM public.data_room_documents
        WHERE data_room_id = NEW.data_room_id;
    IF v_config IS NULL THEN
        RAISE EXCEPTION 'Unable to determine user tier limits for user %', auth.uid();
    ELSIF v_count >= COALESCE(v_config.max_decks_per_room, 50) THEN
        RAISE EXCEPTION 'Data Room capacity reached (max % decks).', COALESCE(v_config.max_decks_per_room, 50);
    END IF;
    RETURN NEW;
END; $$;

-- Notification internal helper (SECURITY DEFINER, NOT granted to callers)
CREATE OR REPLACE FUNCTION public.create_notification_internal(
    p_user_id uuid, p_type text, p_title text, p_message text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_id uuid;
BEGIN
    IF p_type NOT IN ('deck_view','deck_save','signal_threshold','deck_update','admin_message') THEN
        RAISE EXCEPTION 'Invalid notification type: %', p_type;
    END IF;
    IF EXISTS (SELECT 1 FROM public.notifications
               WHERE user_id = p_user_id AND type = p_type AND title = p_title
                 AND read_at IS NULL AND created_at > NOW() - INTERVAL '10 minutes') THEN
        RETURN NULL;
    END IF;
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (p_user_id, p_type, p_title, p_message, COALESCE(p_metadata, '{}'::jsonb))
    RETURNING id INTO v_id;
    RETURN v_id;
END; $$;

-- Public notification wrapper (authenticated self or admin)
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id uuid, p_type text, p_title text, p_message text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, extensions AS $$
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF auth.uid() <> p_user_id AND NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;
    RETURN public.create_notification_internal(p_user_id, p_type, p_title, p_message, p_metadata);
END; $$;

-- Admin broadcast functions
CREATE OR REPLACE FUNCTION public.create_admin_broadcast(
    p_user_ids uuid[], p_title text, p_message text, p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_uid uuid; v_count integer := 0;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Permission denied: admin role required'; END IF;
    IF p_user_ids IS NULL OR array_length(p_user_ids, 1) = 0 THEN
        RAISE EXCEPTION 'p_user_ids must contain at least one user';
    END IF;
    FOREACH v_uid IN ARRAY p_user_ids LOOP
        INSERT INTO public.notifications (user_id, type, title, message, metadata)
        VALUES (v_uid, 'admin_message', p_title, p_message, COALESCE(p_metadata, '{}'::jsonb));
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.create_admin_broadcast_all(
    p_title text, p_message text, p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_count integer;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Permission denied: admin role required'; END IF;
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    SELECT p.id, 'admin_message', p_title, p_message, COALESCE(p_metadata, '{}'::jsonb)
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE NOT EXISTS (SELECT 1 FROM public.admin_emails ae WHERE ae.email = u.email);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_count integer := 0; v_batch_count integer;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;
    LOOP
        DELETE FROM public.notifications
        WHERE id IN (SELECT id FROM public.notifications WHERE expires_at < NOW() LIMIT 1000);
        GET DIAGNOSTICS v_batch_count = ROW_COUNT;
        v_count := v_count + v_batch_count;
        EXIT WHEN v_batch_count = 0;
    END LOOP;
    RETURN v_count;
END; $$;

-- Admin metrics
CREATE OR REPLACE FUNCTION public.get_total_system_users()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_count integer;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    SELECT COUNT(*)::INTEGER INTO v_count FROM public.profiles;
    RETURN v_count;
END; $$;

-- Notification trigger functions
CREATE OR REPLACE FUNCTION public.notify_on_deck_save()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_owner_id uuid; v_deck_title text; v_save_count bigint;
BEGIN
    SELECT d.user_id, d.title INTO v_owner_id, v_deck_title FROM public.decks d WHERE d.id = NEW.deck_id;
    IF v_owner_id = NEW.user_id THEN RETURN NEW; END IF;
    SELECT COUNT(*) INTO v_save_count FROM public.investor_library WHERE deck_id = NEW.deck_id;
    PERFORM public.create_notification_internal(
        v_owner_id, 'deck_save', 'New Save 🔖',
        '"' || v_deck_title || '" was saved. It now has ' || v_save_count ||
        ' save' || CASE WHEN v_save_count = 1 THEN '' ELSE 's' END || '.',
        jsonb_build_object('deck_id', NEW.deck_id, 'save_count', v_save_count)
    );
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_signal_threshold()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
    v_owner_id uuid; v_deck_title text; v_visitor_count bigint;
    v_milestones integer[] := ARRAY[3, 10, 25, 50, 100, 250, 500, 1000];
    v_milestone integer;
BEGIN
    SELECT d.user_id, d.title INTO v_owner_id, v_deck_title FROM public.decks d WHERE d.id = NEW.deck_id;
    IF EXISTS (SELECT 1 FROM public.deck_page_views
               WHERE deck_id = NEW.deck_id AND visitor_id = NEW.visitor_id AND id != NEW.id) THEN
        RETURN NEW;
    END IF;
    UPDATE public.decks SET unique_visitors = unique_visitors + 1
        WHERE id = NEW.deck_id RETURNING unique_visitors INTO v_visitor_count;
    FOREACH v_milestone IN ARRAY v_milestones LOOP
        IF v_visitor_count = v_milestone THEN
            PERFORM public.create_notification_internal(
                v_owner_id, 'signal_threshold', 'High Investor Interest 🔥',
                '"' || v_deck_title || '" has now been viewed by ' || v_visitor_count ||
                ' unique investor' || CASE WHEN v_visitor_count = 1 THEN '' ELSE 's' END || '.',
                jsonb_build_object('deck_id', NEW.deck_id, 'visitor_count', v_visitor_count, 'milestone', v_milestone)
            );
            EXIT;
        END IF;
    END LOOP;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_deck_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_investor record;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status AND OLD.status = 'CONVERTING' AND NEW.status = 'PROCESSED' THEN
        FOR v_investor IN SELECT user_id FROM public.investor_library WHERE deck_id = NEW.id LOOP
            PERFORM public.create_notification_internal(
                v_investor.user_id, 'deck_update', 'Deck Updated 📄',
                '"' || NEW.title || '" has been updated by the founder. Tap to view the latest version.',
                jsonb_build_object('deck_id', NEW.id, 'deck_slug', NEW.slug)
            );
        END LOOP;
    END IF;
    RETURN NEW;
END; $$;

-- =============================================================================
-- 7. TRIGGERS
-- =============================================================================
DROP TRIGGER IF EXISTS tr_hash_deck_password ON public.decks;
CREATE TRIGGER tr_hash_deck_password
    BEFORE INSERT OR UPDATE ON public.decks
    FOR EACH ROW EXECUTE FUNCTION public.hash_password_trigger();

DROP TRIGGER IF EXISTS tr_hash_room_password ON public.data_rooms;
CREATE TRIGGER tr_hash_room_password
    BEFORE INSERT OR UPDATE ON public.data_rooms
    FOR EACH ROW EXECUTE FUNCTION public.hash_password_trigger();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS tr_enforce_deck_limit ON public.decks;
CREATE TRIGGER tr_enforce_deck_limit
    BEFORE INSERT ON public.decks
    FOR EACH ROW EXECUTE FUNCTION public.enforce_deck_creation_limit();

DROP TRIGGER IF EXISTS tr_enforce_data_room_limit ON public.data_room_documents;
CREATE TRIGGER tr_enforce_data_room_limit
    BEFORE INSERT ON public.data_room_documents
    FOR EACH ROW EXECUTE FUNCTION public.enforce_data_room_capacity();

DROP TRIGGER IF EXISTS tr_notify_on_deck_save ON public.investor_library;
CREATE TRIGGER tr_notify_on_deck_save
    AFTER INSERT ON public.investor_library
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_deck_save();

DROP TRIGGER IF EXISTS tr_notify_signal_threshold ON public.deck_page_views;
CREATE TRIGGER tr_notify_signal_threshold
    AFTER INSERT ON public.deck_page_views
    FOR EACH ROW EXECUTE FUNCTION public.notify_signal_threshold();

DROP TRIGGER IF EXISTS tr_notify_on_deck_update ON public.decks;
CREATE TRIGGER tr_notify_on_deck_update
    AFTER UPDATE OF status ON public.decks
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_deck_update();

-- =============================================================================
-- 8. STORAGE BUCKETS
-- =============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('decks',   'decks',   false) ON CONFLICT (id) DO UPDATE SET public = false;
INSERT INTO storage.buckets (id, name, public) VALUES ('assets',  'assets',  true)  ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 9. STORAGE POLICIES (per-operation — required for correct WITH CHECK behavior)
-- =============================================================================

-- DECKS bucket
DROP POLICY IF EXISTS "Authenticated users can upload to their own decks folder" ON storage.objects;
CREATE POLICY "Authenticated users can upload to their own decks folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'decks' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1] AND
    COALESCE((metadata->>'size')::bigint, 0) <=
        COALESCE((SELECT max_file_size_bytes FROM public.get_current_user_tier_limit()), 10485760)
);

DROP POLICY IF EXISTS "Authenticated users can update their own deck files" ON storage.objects;
CREATE POLICY "Authenticated users can update their own deck files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'decks' AND (select auth.uid())::text = (string_to_array(name, '/'))[1])
WITH CHECK (
    bucket_id = 'decks' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1] AND
    COALESCE((metadata->>'size')::bigint, 0) <=
        COALESCE((SELECT max_file_size_bytes FROM public.get_current_user_tier_limit()), 10485760)
);

DROP POLICY IF EXISTS "Authenticated users can delete their own deck files" ON storage.objects;
CREATE POLICY "Authenticated users can delete their own deck files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'decks' AND (select auth.uid())::text = (string_to_array(name, '/'))[1]);

DROP POLICY IF EXISTS "Owners can read their own deck files" ON storage.objects;
CREATE POLICY "Owners can read their own deck files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'decks' AND (select auth.uid())::text = (string_to_array(name, '/'))[1]);

-- ASSETS bucket
DROP POLICY IF EXISTS "Authenticated users can upload to their own assets folder" ON storage.objects;
CREATE POLICY "Authenticated users can upload to their own assets folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'assets' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1] AND
    COALESCE((metadata->>'size')::bigint, 0) <= 5242880
);

DROP POLICY IF EXISTS "Authenticated users can update their own asset files" ON storage.objects;
CREATE POLICY "Authenticated users can update their own asset files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'assets' AND (select auth.uid())::text = (string_to_array(name, '/'))[1])
WITH CHECK (
    bucket_id = 'assets' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1] AND
    COALESCE((metadata->>'size')::bigint, 0) <= 5242880
);

DROP POLICY IF EXISTS "Authenticated users can delete their own asset files" ON storage.objects;
CREATE POLICY "Authenticated users can delete their own asset files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'assets' AND (select auth.uid())::text = (string_to_array(name, '/'))[1]);

DROP POLICY IF EXISTS "Anyone can read assets bucket" ON storage.objects;
CREATE POLICY "Anyone can read assets bucket"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'assets');

-- =============================================================================
-- 10. GRANTS
-- Public reads go through SECURITY DEFINER functions; raw table access
-- is restricted to authenticated users only, with anon blocked on sensitive tables.
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- anon gets SELECT on non-sensitive tables only
GRANT SELECT ON public.tier_limits TO anon;
GRANT SELECT ON public.branding TO anon;
GRANT SELECT ON public.data_room_documents TO anon;
GRANT SELECT ON public.notifications TO anon; -- RLS enforces owner-only access

-- Explicitly block anon from sensitive tables (public reads go via SECURITY DEFINER RPCs)
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.decks FROM anon;
REVOKE SELECT ON public.data_rooms FROM anon;

-- Function grants
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tutorial_state(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_tier_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_thumbnails() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_batch_data_room_analytics(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_system_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_broadcast(uuid[], text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_broadcast_all(text, text, jsonb) TO authenticated;
-- Internal helper: explicitly NOT granted to callers
REVOKE EXECUTE ON FUNCTION public.create_notification_internal(uuid, text, text, text, jsonb) FROM anon, authenticated, PUBLIC;

-- Public RPCs (accessible without login for viewer flows)
GRANT EXECUTE ON FUNCTION public.get_profiles_public() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_decks_public() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_rooms_public() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_deck_payload(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_room_payload(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_deck_password(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_data_room_password(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_deck_visit(uuid, integer, numeric, text, text, uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_unique_visitors(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_deck_locations(uuid) TO anon, authenticated;

-- =============================================================================
-- 11. RLS POLICIES
-- =============================================================================

-- PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING ((select auth.uid()) = id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING ((select auth.uid()) = id);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- DECKS
DROP POLICY IF EXISTS "Users can manage their own decks" ON public.decks;
CREATE POLICY "Users can manage their own decks" ON public.decks
    FOR ALL USING ((select auth.uid()) = user_id);

-- BRANDING
DROP POLICY IF EXISTS "Users can manage their own branding" ON public.branding;
CREATE POLICY "Users can manage their own branding" ON public.branding
    FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Branding is viewable by everyone" ON public.branding;
CREATE POLICY "Branding is viewable by everyone" ON public.branding
    FOR SELECT USING (true);

-- DATA ROOMS
DROP POLICY IF EXISTS "Users can manage their own data rooms" ON public.data_rooms;
CREATE POLICY "Users can manage their own data rooms" ON public.data_rooms
    FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Anyone can view data rooms" ON public.data_rooms;
CREATE POLICY "Anyone can view data rooms" ON public.data_rooms
    FOR SELECT USING (true);

-- DATA ROOM DOCUMENTS
DROP POLICY IF EXISTS "Owners can manage data room documents" ON public.data_room_documents;
CREATE POLICY "Owners can manage data room documents" ON public.data_room_documents
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.data_rooms dr
        WHERE dr.id = data_room_id AND dr.user_id = (select auth.uid())
    ))
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.data_rooms dr WHERE dr.id = data_room_id AND dr.user_id = (select auth.uid()))
        AND EXISTS (SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = (select auth.uid()))
    );
DROP POLICY IF EXISTS "Anyone can view data room document lists" ON public.data_room_documents;
CREATE POLICY "Anyone can view data room document lists" ON public.data_room_documents
    FOR SELECT USING (true);

-- ANALYTICS
DROP POLICY IF EXISTS "Owners can view their page views" ON public.deck_page_views;
CREATE POLICY "Owners can view their page views" ON public.deck_page_views
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = (select auth.uid())
    ));
-- INSERT is blocked for direct callers; record_deck_visit (SECURITY DEFINER) handles all writes.

DROP POLICY IF EXISTS "Owners can manage their own stats" ON public.deck_stats;
CREATE POLICY "Owners can manage their own stats" ON public.deck_stats
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.decks d WHERE d.id = deck_id AND d.user_id = (select auth.uid())
    ));

-- ADMIN EMAILS
DROP POLICY IF EXISTS "Only admins can view admin_emails" ON public.admin_emails;
CREATE POLICY "Only admins can view admin_emails" ON public.admin_emails
    FOR SELECT USING (public.is_admin());

-- NOTIFICATIONS
DROP POLICY IF EXISTS "notifications_owner_select" ON public.notifications;
CREATE POLICY "notifications_owner_select" ON public.notifications
    FOR SELECT USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "notifications_owner_update" ON public.notifications;
CREATE POLICY "notifications_owner_update" ON public.notifications
    FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "notifications_owner_delete" ON public.notifications;
CREATE POLICY "notifications_owner_delete" ON public.notifications
    FOR DELETE USING ((select auth.uid()) = user_id);

-- INVESTOR LIBRARY
DROP POLICY IF EXISTS "Users can read library entries" ON public.investor_library;
CREATE POLICY "Users can read library entries" ON public.investor_library
    FOR SELECT USING (
        (select auth.uid()) = user_id
        OR EXISTS (SELECT 1 FROM public.decks WHERE decks.id = deck_id AND decks.user_id = (select auth.uid()))
    );
DROP POLICY IF EXISTS "Users can insert into their own library" ON public.investor_library;
CREATE POLICY "Users can insert into their own library" ON public.investor_library
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update their own library" ON public.investor_library;
CREATE POLICY "Users can update their own library" ON public.investor_library
    FOR UPDATE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete from their own library" ON public.investor_library;
CREATE POLICY "Users can delete from their own library" ON public.investor_library
    FOR DELETE USING ((select auth.uid()) = user_id);

-- INVESTOR NOTES
DROP POLICY IF EXISTS "Notes are strictly private" ON public.investor_notes;
CREATE POLICY "Notes are strictly private" ON public.investor_notes
    FOR ALL USING ((select auth.uid()) = user_id);

-- LIBRARY ORGANIZER
DROP POLICY IF EXISTS "Owner only" ON public.library_folders;
CREATE POLICY "Owner only" ON public.library_folders
    FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Owner only" ON public.library_tags;
CREATE POLICY "Owner only" ON public.library_tags
    FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Owner only" ON public.library_folder_tags;
CREATE POLICY "Owner only" ON public.library_folder_tags
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.library_folders WHERE id = folder_id AND user_id = (select auth.uid())
    ));
DROP POLICY IF EXISTS "Owner only" ON public.library_deck_tags;
CREATE POLICY "Owner only" ON public.library_deck_tags
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.investor_library WHERE id = library_id AND user_id = (select auth.uid())
    ));

-- =============================================================================
-- pg_cron scheduling notes (run manually via Supabase Dashboard → Cron Jobs):
-- SELECT cron.schedule('cleanup-notifications', '0 3 * * *',
--   $$SELECT public.cleanup_expired_notifications();$$);
-- SELECT cron.schedule('cleanup-signup-throttle', '0 4 * * *',
--   $$SELECT public.cleanup_signup_throttle();$$);
-- =============================================================================
