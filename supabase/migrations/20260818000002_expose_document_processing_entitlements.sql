-- Expose the separate viewer-processing limits without changing storage limits.
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
        'tier', tl.tier, 'label', tl.display_name, 'rank', tl.tier_rank,
        'limits', jsonb_build_object(
          'maxDataRooms', tl.max_data_rooms, 'maxDocuments', tl.max_decks,
          'maxDocumentsPerRoom', tl.max_decks_per_room, 'storageLimitBytes', tl.storage_limit_bytes,
          'maxFileSizeBytes', tl.max_file_size_bytes,
          'maxViewableDocumentSizeBytes', tl.max_viewable_document_size_bytes,
          'maxDocumentPages', tl.max_document_pages,
          'analyticsRetentionDays', tl.analytics_retention_days,
          'aiCreditsPerDay', tl.ai_credits_per_day, 'plannedTeamMembers', tl.planned_team_members
        ),
        'prices', jsonb_build_object(
          'monthly', COALESCE((SELECT display_amount FROM public.billing_plan_catalog p WHERE p.tier = tl.tier AND p.interval = 'monthly' AND p.active LIMIT 1), 0),
          'yearly', COALESCE((SELECT display_amount FROM public.billing_plan_catalog p WHERE p.tier = tl.tier AND p.interval = 'yearly' AND p.active LIMIT 1), 0),
          'currency', COALESCE((SELECT currency FROM public.billing_plan_catalog p WHERE p.tier = tl.tier AND p.active LIMIT 1), 'USD')
        ),
        'features', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'key', feature.key, 'label', feature.label, 'description', feature.description,
            'availability', feature.availability, 'requiredTier', feature.required_tier, 'included', tf.included
          ) ORDER BY feature.display_order)
          FROM public.billing_feature_catalog feature
          JOIN public.billing_tier_features tf ON tf.feature_key = feature.key
          WHERE tf.tier = tl.tier
        ), '[]'::jsonb)
      ) ORDER BY tl.tier_rank
    ), '[]'::jsonb)
  ) FROM public.tier_limits tl
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
    SELECT tl.* FROM public.tier_limits tl
    JOIN public.profiles p ON p.tier = tl.tier WHERE p.id = auth.uid()
  )
  SELECT jsonb_build_object(
    'tier', ct.tier, 'label', ct.display_name,
    'limits', jsonb_build_object(
      'maxDataRooms', ct.max_data_rooms, 'maxDocuments', ct.max_decks,
      'maxDocumentsPerRoom', ct.max_decks_per_room, 'storageLimitBytes', ct.storage_limit_bytes,
      'maxFileSizeBytes', ct.max_file_size_bytes,
      'maxViewableDocumentSizeBytes', ct.max_viewable_document_size_bytes,
      'maxDocumentPages', ct.max_document_pages,
      'analyticsRetentionDays', ct.analytics_retention_days,
      'aiCreditsPerDay', ct.ai_credits_per_day, 'plannedTeamMembers', ct.planned_team_members
    ),
    'storageUsedBytes', COALESCE((SELECT SUM(d.file_size) FROM public.decks d WHERE d.user_id = auth.uid() AND d.status <> 'DELETED'), 0),
    'features', COALESCE((
      SELECT jsonb_agg(feature.key ORDER BY feature.display_order)
      FROM public.billing_tier_features tf
      JOIN public.billing_feature_catalog feature ON feature.key = tf.feature_key
      WHERE tf.tier = ct.tier AND tf.included AND feature.availability = 'live'
    ), '[]'::jsonb)
  ) FROM current_tier ct;
$$;

NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.get_owner_thumbnails()
RETURNS TABLE (deck_id uuid, storage_path text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
  RETURN QUERY
  SELECT d.id,
    COALESCE(
      NULLIF(d.thumbnail_url, ''),
      NULLIF(regexp_replace(d.pages->0->>'image_url', '^.*/storage/v1/object/(public|sign|authenticated)/decks/', ''), ''),
      NULLIF(regexp_replace(d.pages->0->>'url', '^.*/storage/v1/object/(public|sign|authenticated)/decks/', ''), '')
    )
  FROM public.decks d
  WHERE d.user_id = auth.uid() AND d.status = 'PROCESSED';
END;
$$;
