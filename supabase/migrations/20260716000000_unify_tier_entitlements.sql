-- One authoritative, database-owned entitlement catalogue for pricing, UI and enforcement.

ALTER TABLE public.tier_limits
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS tier_rank INTEGER,
  ADD COLUMN IF NOT EXISTS max_data_rooms INTEGER,
  ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS analytics_retention_days INTEGER,
  ADD COLUMN IF NOT EXISTS ai_credits_per_day INTEGER,
  ADD COLUMN IF NOT EXISTS planned_team_members INTEGER;

UPDATE public.tier_limits
SET
  display_name = CASE tier
    WHEN 'FREE' THEN 'Free'
    WHEN 'PRO' THEN 'Share'
    WHEN 'PRO_PLUS' THEN 'Founder'
    WHEN 'RAISE' THEN 'Raise'
  END,
  tier_rank = CASE tier
    WHEN 'FREE' THEN 0
    WHEN 'PRO' THEN 1
    WHEN 'PRO_PLUS' THEN 2
    WHEN 'RAISE' THEN 3
  END,
  max_data_rooms = CASE tier
    WHEN 'FREE' THEN 1
    WHEN 'PRO' THEN 1
    WHEN 'PRO_PLUS' THEN 5
    WHEN 'RAISE' THEN 20
  END,
  storage_limit_bytes = CASE tier
    WHEN 'FREE' THEN 104857600
    WHEN 'PRO' THEN 524288000
    WHEN 'PRO_PLUS' THEN 3221225472
    WHEN 'RAISE' THEN 16106127360
  END,
  analytics_retention_days = CASE tier
    WHEN 'FREE' THEN 7
    WHEN 'PRO' THEN 30
    WHEN 'PRO_PLUS' THEN -1
    WHEN 'RAISE' THEN -1
  END,
  ai_credits_per_day = CASE tier
    WHEN 'FREE' THEN 2
    WHEN 'PRO' THEN 20
    WHEN 'PRO_PLUS' THEN 200
    WHEN 'RAISE' THEN 500
  END,
  planned_team_members = CASE tier
    WHEN 'FREE' THEN 1
    WHEN 'PRO' THEN 1
    WHEN 'PRO_PLUS' THEN 2
    WHEN 'RAISE' THEN 5
  END,
  max_file_size_bytes = CASE tier
    WHEN 'FREE' THEN 104857600
    WHEN 'PRO' THEN 524288000
    WHEN 'PRO_PLUS' THEN 3221225472
    WHEN 'RAISE' THEN 16106127360
  END,
  max_decks = CASE tier
    WHEN 'FREE' THEN 5
    WHEN 'PRO' THEN 25
    WHEN 'PRO_PLUS' THEN 150
    WHEN 'RAISE' THEN 1000
  END,
  max_decks_per_room = CASE tier
    WHEN 'FREE' THEN 5
    WHEN 'PRO' THEN 25
    WHEN 'PRO_PLUS' THEN 150
    WHEN 'RAISE' THEN 1000
  END,
  updated_at = NOW()
WHERE tier IN ('FREE', 'PRO', 'PRO_PLUS', 'RAISE');

ALTER TABLE public.tier_limits
  ALTER COLUMN display_name SET NOT NULL,
  ALTER COLUMN tier_rank SET NOT NULL,
  ALTER COLUMN max_data_rooms SET NOT NULL,
  ALTER COLUMN storage_limit_bytes SET NOT NULL,
  ALTER COLUMN analytics_retention_days SET NOT NULL,
  ALTER COLUMN ai_credits_per_day SET NOT NULL,
  ALTER COLUMN planned_team_members SET NOT NULL;

ALTER TABLE public.tier_limits
  DROP CONSTRAINT IF EXISTS tier_limits_tier_rank_check,
  ADD CONSTRAINT tier_limits_tier_rank_check CHECK (tier_rank BETWEEN 0 AND 3),
  DROP CONSTRAINT IF EXISTS tier_limits_storage_limit_check,
  ADD CONSTRAINT tier_limits_storage_limit_check CHECK (storage_limit_bytes > 0),
  DROP CONSTRAINT IF EXISTS tier_limits_analytics_retention_check,
  ADD CONSTRAINT tier_limits_analytics_retention_check CHECK (analytics_retention_days = -1 OR analytics_retention_days > 0);

CREATE TABLE IF NOT EXISTS public.billing_feature_catalog (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  availability TEXT NOT NULL CHECK (availability IN ('live', 'coming_soon')),
  required_tier TEXT NOT NULL REFERENCES public.tier_limits(tier),
  display_order INTEGER NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.billing_tier_features (
  tier TEXT NOT NULL REFERENCES public.tier_limits(tier) ON DELETE CASCADE,
  feature_key TEXT NOT NULL REFERENCES public.billing_feature_catalog(key) ON DELETE CASCADE,
  included BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (tier, feature_key)
);

ALTER TABLE public.billing_feature_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_tier_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read billing feature catalogue" ON public.billing_feature_catalog;
CREATE POLICY "Authenticated users can read billing feature catalogue"
  ON public.billing_feature_catalog FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read tier feature mapping" ON public.billing_tier_features;
CREATE POLICY "Authenticated users can read tier feature mapping"
  ON public.billing_tier_features FOR SELECT TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.billing_feature_catalog FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.billing_tier_features FROM anon, authenticated;

INSERT INTO public.billing_feature_catalog (key, label, description, availability, required_tier, display_order)
VALUES
  ('unlimited_viewers', 'Unlimited viewers', 'Share with any number of viewers.', 'live', 'FREE', 10),
  ('link_analytics', 'Link analytics', 'See link performance within your plan retention window.', 'live', 'FREE', 20),
  ('page_analytics', 'Page-level and drop-off analytics', 'Understand page engagement and viewer drop-off.', 'live', 'PRO', 30),
  ('visitor_signals', 'Visitor alerts and engagement signals', 'Surface high-intent viewing behaviour.', 'live', 'PRO', 40),
  ('access_controls', 'Email capture, password and expiry', 'Control access to shared decks and rooms.', 'live', 'PRO', 50),
  ('deck_downloads', 'Download controls', 'Enable or disable deck downloads.', 'live', 'PRO', 60),
  ('custom_logo', 'Custom logo', 'Use your own logo in your workspace.', 'live', 'PRO_PLUS', 70),
  ('team_collaboration', 'Team collaboration', 'Invite additional workspace members.', 'coming_soon', 'PRO_PLUS', 80),
  ('custom_colours', 'Custom colours', 'Apply your own workspace colour palette.', 'coming_soon', 'PRO_PLUS', 90),
  ('analytics_export', 'Analytics export', 'Export analytics data.', 'coming_soon', 'RAISE', 100),
  ('granular_downloads', 'Granular downloads', 'Set download rules per room and folder.', 'coming_soon', 'RAISE', 110),
  ('white_label_domain', 'White-label and custom domain', 'Remove Deckly branding and use a custom domain.', 'coming_soon', 'RAISE', 120),
  ('diligence_controls', 'Diligence controls', 'NDA gates, watermarking, access groups and audit trail.', 'coming_soon', 'RAISE', 130)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  availability = EXCLUDED.availability,
  required_tier = EXCLUDED.required_tier,
  display_order = EXCLUDED.display_order;

INSERT INTO public.billing_tier_features (tier, feature_key, included)
SELECT tier.tier, feature.key, tier.tier_rank >= required.tier_rank
FROM public.tier_limits AS tier
CROSS JOIN public.billing_feature_catalog AS feature
JOIN public.tier_limits AS required ON required.tier = feature.required_tier
WHERE tier.tier IN ('FREE', 'PRO', 'PRO_PLUS', 'RAISE')
ON CONFLICT (tier, feature_key) DO UPDATE SET included = EXCLUDED.included;

CREATE OR REPLACE FUNCTION public.get_tier_limit_for_user(p_user_id UUID)
RETURNS public.tier_limits
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  SELECT tl.*
  FROM public.tier_limits tl
  JOIN public.profiles p ON p.tier = tl.tier
  WHERE p.id = p_user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_live_feature_for_user(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.billing_tier_features tf ON tf.tier = p.tier
    JOIN public.billing_feature_catalog feature ON feature.key = tf.feature_key
    WHERE p.id = p_user_id
      AND feature.key = p_feature_key
      AND tf.included
      AND feature.availability = 'live'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_tier_limit_for_user(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_live_feature_for_user(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tier_limit_for_user(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_live_feature_for_user(UUID, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_pricing_catalog()
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'tiers', COALESCE(jsonb_agg(
      jsonb_build_object(
        'tier', tl.tier,
        'label', tl.display_name,
        'rank', tl.tier_rank,
        'limits', jsonb_build_object(
          'maxDataRooms', tl.max_data_rooms,
          'maxDocuments', tl.max_decks,
          'maxDocumentsPerRoom', tl.max_decks_per_room,
          'storageLimitBytes', tl.storage_limit_bytes,
          'maxFileSizeBytes', tl.max_file_size_bytes,
          'analyticsRetentionDays', tl.analytics_retention_days,
          'aiCreditsPerDay', tl.ai_credits_per_day,
          'plannedTeamMembers', tl.planned_team_members
        ),
        'prices', jsonb_build_object(
          'monthly', COALESCE((SELECT display_amount FROM public.billing_plan_catalog p WHERE p.tier = tl.tier AND p.interval = 'monthly' AND p.active LIMIT 1), 0),
          'yearly', COALESCE((SELECT display_amount FROM public.billing_plan_catalog p WHERE p.tier = tl.tier AND p.interval = 'yearly' AND p.active LIMIT 1), 0),
          'currency', COALESCE((SELECT currency FROM public.billing_plan_catalog p WHERE p.tier = tl.tier AND p.active LIMIT 1), 'USD')
        ),
        'features', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'key', feature.key,
            'label', feature.label,
            'description', feature.description,
            'availability', feature.availability,
            'requiredTier', feature.required_tier,
            'included', tf.included
          ) ORDER BY feature.display_order)
          FROM public.billing_feature_catalog feature
          JOIN public.billing_tier_features tf ON tf.feature_key = feature.key
          WHERE tf.tier = tl.tier
        ), '[]'::jsonb)
      ) ORDER BY tl.tier_rank
    ), '[]'::jsonb)
  )
  FROM public.tier_limits tl
  WHERE tl.tier IN ('FREE', 'PRO', 'PRO_PLUS', 'RAISE');
$$;

CREATE OR REPLACE FUNCTION public.get_my_entitlements()
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, extensions
AS $$
  WITH current_tier AS (
    SELECT tl.*
    FROM public.tier_limits tl
    JOIN public.profiles p ON p.tier = tl.tier
    WHERE p.id = auth.uid()
  )
  SELECT jsonb_build_object(
    'tier', ct.tier,
    'label', ct.display_name,
    'limits', jsonb_build_object(
      'maxDataRooms', ct.max_data_rooms,
      'maxDocuments', ct.max_decks,
      'maxDocumentsPerRoom', ct.max_decks_per_room,
      'storageLimitBytes', ct.storage_limit_bytes,
      'maxFileSizeBytes', ct.max_file_size_bytes,
      'analyticsRetentionDays', ct.analytics_retention_days,
      'aiCreditsPerDay', ct.ai_credits_per_day,
      'plannedTeamMembers', ct.planned_team_members
    ),
    'storageUsedBytes', COALESCE((SELECT SUM(d.file_size) FROM public.decks d WHERE d.user_id = auth.uid() AND d.status <> 'DELETED'), 0),
    'features', COALESCE((
      SELECT jsonb_agg(feature.key ORDER BY feature.display_order)
      FROM public.billing_tier_features tf
      JOIN public.billing_feature_catalog feature ON feature.key = tf.feature_key
      WHERE tf.tier = ct.tier AND tf.included AND feature.availability = 'live'
    ), '[]'::jsonb)
  )
  FROM current_tier ct;
$$;

REVOKE EXECUTE ON FUNCTION public.get_pricing_catalog() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_entitlements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pricing_catalog() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_entitlements() TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_deck_creation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_config public.tier_limits;
  v_daily_count INTEGER;
  v_total_count INTEGER;
  v_storage_used BIGINT;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;
  v_config := public.get_tier_limit_for_user(NEW.user_id);
  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Unable to determine tier limits';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT count(*)::INTEGER INTO v_daily_count
    FROM public.decks
    WHERE user_id = NEW.user_id AND created_at > NOW() - INTERVAL '24 hours';
    IF v_daily_count >= v_config.max_decks_per_day THEN
      RAISE EXCEPTION 'Daily document creation limit reached (%/day)', v_config.max_decks_per_day;
    END IF;
  END IF;

  SELECT count(*)::INTEGER, COALESCE(sum(file_size), 0)::BIGINT
  INTO v_total_count, v_storage_used
  FROM public.decks
  WHERE user_id = NEW.user_id
    AND status <> 'DELETED'
    AND (TG_OP = 'INSERT' OR id <> OLD.id);

  IF NEW.status <> 'DELETED' THEN
    v_total_count := v_total_count + 1;
    v_storage_used := v_storage_used + COALESCE(NEW.file_size, 0);
  END IF;

  IF v_total_count > v_config.max_decks THEN
    RAISE EXCEPTION 'Document limit reached (% documents)', v_config.max_decks;
  END IF;

  IF v_storage_used > v_config.storage_limit_bytes THEN
    RAISE EXCEPTION 'Storage limit reached (% bytes)', v_config.storage_limit_bytes;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_deck_limit ON public.decks;
CREATE TRIGGER tr_enforce_deck_limit
  BEFORE INSERT OR UPDATE OF user_id, file_size, status ON public.decks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_deck_creation_limit();

CREATE OR REPLACE FUNCTION public.enforce_data_room_creation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_config public.tier_limits;
  v_count INTEGER;
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;
  v_config := public.get_tier_limit_for_user(NEW.user_id);
  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Unable to determine tier limits';
  END IF;

  SELECT count(*)::INTEGER INTO v_count FROM public.data_rooms WHERE user_id = NEW.user_id;
  IF v_count >= v_config.max_data_rooms THEN
    RAISE EXCEPTION 'Active data room limit reached (% rooms)', v_config.max_data_rooms;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_data_room_creation_limit ON public.data_rooms;
CREATE TRIGGER tr_enforce_data_room_creation_limit
  BEFORE INSERT ON public.data_rooms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_data_room_creation_limit();

CREATE OR REPLACE FUNCTION public.enforce_data_room_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_config public.tier_limits;
  v_count INTEGER;
  v_owner UUID;
BEGIN
  SELECT user_id INTO v_owner FROM public.data_rooms WHERE id = NEW.data_room_id FOR UPDATE;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Data room not found';
  END IF;
  v_config := public.get_tier_limit_for_user(v_owner);
  SELECT count(*)::INTEGER INTO v_count FROM public.data_room_documents WHERE data_room_id = NEW.data_room_id;
  IF v_count >= v_config.max_decks_per_room THEN
    RAISE EXCEPTION 'Data room document limit reached (% documents)', v_config.max_decks_per_room;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_deck_feature_entitlements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_access_allowed BOOLEAN := public.has_live_feature_for_user(NEW.user_id, 'access_controls');
  v_download_allowed BOOLEAN := public.has_live_feature_for_user(NEW.user_id, 'deck_downloads');
BEGIN
  IF NOT v_access_allowed AND (
    (TG_OP = 'INSERT' AND (NEW.require_email OR NEW.require_password OR NEW.expires_at IS NOT NULL))
    OR (TG_OP = 'UPDATE' AND (
      (NEW.require_email AND NOT OLD.require_email)
      OR (NEW.require_password AND NOT OLD.require_password)
      OR (NEW.expires_at IS NOT NULL AND NEW.expires_at IS DISTINCT FROM OLD.expires_at)
      OR (NEW.require_password AND NEW.view_password IS DISTINCT FROM OLD.view_password)
    ))
  ) THEN
    RAISE EXCEPTION 'Email capture, password protection and expiry require Share or higher';
  END IF;

  IF NOT v_download_allowed AND (
    (TG_OP = 'INSERT' AND NEW.allow_download)
    OR (TG_OP = 'UPDATE' AND NEW.allow_download AND NOT OLD.allow_download)
  ) THEN
    RAISE EXCEPTION 'Download controls require Share or higher';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_deck_feature_entitlements ON public.decks;
CREATE TRIGGER tr_enforce_deck_feature_entitlements
  BEFORE INSERT OR UPDATE OF require_email, require_password, view_password, expires_at, allow_download ON public.decks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_deck_feature_entitlements();

CREATE OR REPLACE FUNCTION public.enforce_data_room_feature_entitlements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_access_allowed BOOLEAN := public.has_live_feature_for_user(NEW.user_id, 'access_controls');
BEGIN
  IF NOT v_access_allowed AND (
    (TG_OP = 'INSERT' AND (NEW.require_email OR NEW.require_password OR NEW.expires_at IS NOT NULL))
    OR (TG_OP = 'UPDATE' AND (
      (NEW.require_email AND NOT OLD.require_email)
      OR (NEW.require_password AND NOT OLD.require_password)
      OR (NEW.expires_at IS NOT NULL AND NEW.expires_at IS DISTINCT FROM OLD.expires_at)
      OR (NEW.require_password AND NEW.view_password IS DISTINCT FROM OLD.view_password)
    ))
  ) THEN
    RAISE EXCEPTION 'Email capture, password protection and expiry require Share or higher';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_data_room_feature_entitlements ON public.data_rooms;
CREATE TRIGGER tr_enforce_data_room_feature_entitlements
  BEFORE INSERT OR UPDATE OF require_email, require_password, view_password, expires_at ON public.data_rooms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_data_room_feature_entitlements();

CREATE OR REPLACE FUNCTION public.enforce_branding_feature_entitlements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_logo_allowed BOOLEAN := public.has_live_feature_for_user(NEW.user_id, 'custom_logo');
BEGIN
  IF NOT v_logo_allowed AND (
    (TG_OP = 'INSERT' AND NEW.logo_url IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND NEW.logo_url IS NOT NULL AND NEW.logo_url IS DISTINCT FROM OLD.logo_url)
  ) THEN
    RAISE EXCEPTION 'Custom logos require Founder or higher';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_branding_feature_entitlements ON public.branding;
CREATE TRIGGER tr_enforce_branding_feature_entitlements
  BEFORE INSERT OR UPDATE OF logo_url ON public.branding
  FOR EACH ROW EXECUTE FUNCTION public.enforce_branding_feature_entitlements();

CREATE OR REPLACE FUNCTION public.get_entitled_deck_page_stats(p_deck_id UUID)
RETURNS TABLE (page_number INTEGER, total_views BIGINT, total_time_seconds BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_retention INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.decks WHERE id = p_deck_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT analytics_retention_days INTO v_retention FROM public.get_current_user_tier_limit();
  IF NOT public.has_live_feature_for_user(auth.uid(), 'page_analytics') THEN
    RAISE EXCEPTION 'Page-level analytics require Share or higher';
  END IF;
  RETURN QUERY
  SELECT dpv.page_number, COUNT(DISTINCT dpv.visitor_id || '_' || dpv.viewed_at::DATE), COALESCE(SUM(dpv.time_spent), 0)::BIGINT
  FROM public.deck_page_views dpv
  WHERE dpv.deck_id = p_deck_id
    AND (v_retention = -1 OR dpv.viewed_at >= NOW() - make_interval(days => v_retention))
  GROUP BY dpv.page_number
  ORDER BY dpv.page_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_entitled_deck_page_stats(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_entitled_deck_page_stats(UUID) TO authenticated;

DROP POLICY IF EXISTS "Owners can view their page views" ON public.deck_page_views;
DROP POLICY IF EXISTS "Owners can view entitled page views" ON public.deck_page_views;
CREATE POLICY "Owners can view entitled page views" ON public.deck_page_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.decks d
      WHERE d.id = deck_id AND d.user_id = auth.uid()
    )
    AND public.has_live_feature_for_user(auth.uid(), 'visitor_signals')
    AND (
      (SELECT analytics_retention_days FROM public.get_current_user_tier_limit()) = -1
      OR viewed_at >= NOW() - make_interval(days => (SELECT analytics_retention_days FROM public.get_current_user_tier_limit()))
    )
  );

CREATE OR REPLACE FUNCTION public.get_deck_link_stats(p_deck_id UUID)
RETURNS TABLE (
  link_id UUID,
  link_name TEXT,
  link_alias TEXT,
  is_primary BOOLEAN,
  is_enabled BOOLEAN,
  total_views INTEGER,
  unique_visitors INTEGER,
  total_time_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_retention INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.decks d WHERE d.id = p_deck_id AND d.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT analytics_retention_days INTO v_retention FROM public.get_current_user_tier_limit();
  RETURN QUERY
  SELECT
    dl.id,
    dl.link_name,
    dl.link_alias,
    dl.is_primary,
    dl.is_enabled,
    COALESCE(COUNT(DISTINCT dpv.visitor_id || '_' || dpv.viewed_at::DATE)::INTEGER, 0),
    COALESCE(COUNT(DISTINCT dpv.visitor_id)::INTEGER, 0),
    COALESCE(SUM(dpv.time_spent)::INTEGER, 0)
  FROM public.deck_links dl
  LEFT JOIN public.deck_page_views dpv
    ON dpv.deck_link_id = dl.id
    AND dpv.deck_id = dl.deck_id
    AND (v_retention = -1 OR dpv.viewed_at >= NOW() - make_interval(days => v_retention))
  WHERE dl.deck_id = p_deck_id
  GROUP BY dl.id, dl.link_name, dl.link_alias, dl.is_primary, dl.is_enabled, dl.created_at
  ORDER BY total_views DESC, dl.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_unique_visitors(p_deck_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_retention INTEGER;
  v_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.decks d WHERE d.id = p_deck_id AND d.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT analytics_retention_days INTO v_retention FROM public.get_current_user_tier_limit();
  SELECT COUNT(DISTINCT visitor_id)::INTEGER INTO v_count
  FROM public.deck_page_views
  WHERE deck_id = p_deck_id
    AND (v_retention = -1 OR viewed_at >= NOW() - make_interval(days => v_retention));
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_deck_locations(p_deck_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_retention INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.decks d WHERE d.id = p_deck_id AND d.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT public.has_live_feature_for_user(auth.uid(), 'page_analytics') THEN
    RAISE EXCEPTION 'Page-level analytics require Share or higher';
  END IF;
  SELECT analytics_retention_days INTO v_retention FROM public.get_current_user_tier_limit();
  RETURN jsonb_build_object(
    'countries', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.count DESC) FROM (
        SELECT COALESCE(country, 'Unknown') AS name, COALESCE(country_code, 'XX') AS code, COUNT(*)::INTEGER AS count
        FROM public.deck_page_views
        WHERE deck_id = p_deck_id AND (v_retention = -1 OR viewed_at >= NOW() - make_interval(days => v_retention))
        GROUP BY 1, 2
      ) t
    ), '[]'::jsonb),
    'cities', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.count DESC) FROM (
        SELECT COALESCE(city, 'Unknown City') AS name, COALESCE(country, 'Unknown') AS country, COUNT(*)::INTEGER AS count
        FROM public.deck_page_views
        WHERE deck_id = p_deck_id AND (v_retention = -1 OR viewed_at >= NOW() - make_interval(days => v_retention))
        GROUP BY 1, 2
      ) t
    ), '[]'::jsonb)
  );
END;
$$;
