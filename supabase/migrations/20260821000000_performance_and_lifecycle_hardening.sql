-- Forward-only performance hardening for schemas already deployed to production.
-- Do not backport these changes into earlier migration files.

CREATE INDEX IF NOT EXISTS idx_page_views_deck_time
  ON public.deck_page_views (deck_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_views_room_time
  ON public.deck_page_views (data_room_id, viewed_at DESC)
  WHERE data_room_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_processing_jobs_reconcile_idx
  ON public.document_processing_jobs (status, updated_at)
  WHERE public.is_document_processing_active(status) OR status = 'superseded';

CREATE INDEX IF NOT EXISTS document_processing_jobs_cleanup_idx
  ON public.document_processing_jobs (cleanup_after)
  WHERE cleanup_after IS NOT NULL
    AND status IN ('completed', 'failed', 'cancelled', 'superseded', 'timed_out');

CREATE OR REPLACE FUNCTION public.reorder_data_room_documents(
  p_room_id UUID,
  p_ordered_deck_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_current_count INTEGER;
  v_requested_count INTEGER;
  v_distinct_requested_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.data_rooms
    WHERE id = p_room_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_current_count
  FROM public.data_room_documents
  WHERE data_room_id = p_room_id;

  SELECT COUNT(*)::INTEGER, COUNT(DISTINCT deck_id)::INTEGER
  INTO v_requested_count, v_distinct_requested_count
  FROM unnest(COALESCE(p_ordered_deck_ids, ARRAY[]::UUID[])) AS requested(deck_id);

  IF v_current_count <> v_requested_count
     OR v_requested_count <> v_distinct_requested_count
     OR EXISTS (
       SELECT 1
       FROM public.data_room_documents current_document
       WHERE current_document.data_room_id = p_room_id
         AND NOT (current_document.deck_id = ANY(COALESCE(p_ordered_deck_ids, ARRAY[]::UUID[])))
     ) THEN
    RAISE EXCEPTION 'The document order does not match the current room documents.';
  END IF;

  UPDATE public.data_room_documents document
  SET display_order = requested.ordinality - 1
  FROM unnest(p_ordered_deck_ids) WITH ORDINALITY AS requested(deck_id, ordinality)
  WHERE document.data_room_id = p_room_id
    AND document.deck_id = requested.deck_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_data_room_documents(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_data_room_documents(UUID, UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_admin_broadcast(
  p_user_ids UUID[],
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) = 0 THEN
    RAISE EXCEPTION 'p_user_ids must contain at least one user';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT DISTINCT recipient.user_id,
         'admin_message',
         p_title,
         p_message,
         COALESCE(p_metadata, '{}'::JSONB)
  FROM unnest(p_user_ids) AS recipient(user_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_deck_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status = 'CONVERTING'
     AND NEW.status = 'PROCESSED' THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    SELECT DISTINCT investor.user_id,
           'deck_update',
           'Deck Updated 📄',
           '"' || NEW.title || '" has been updated by the founder. Tap to view the latest version.',
           jsonb_build_object('deck_id', NEW.id, 'deck_slug', NEW.slug)
    FROM public.investor_library investor
    WHERE investor.deck_id = NEW.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications existing
        WHERE existing.user_id = investor.user_id
          AND existing.type = 'deck_update'
          AND existing.title = 'Deck Updated 📄'
          AND existing.read_at IS NULL
          AND existing.created_at > NOW() - INTERVAL '10 minutes'
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_data_room_analytics_bundle(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_retention INTEGER;
  v_result JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.data_rooms room
    WHERE room.id = p_room_id AND room.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT analytics_retention_days
  INTO v_retention
  FROM public.get_current_user_tier_limit();

  WITH retained_views AS MATERIALIZED (
    SELECT page_view.*
    FROM public.deck_page_views page_view
    WHERE page_view.data_room_id = p_room_id
      AND (v_retention = -1 OR page_view.viewed_at >= NOW() - make_interval(days => v_retention))
  ),
  room_documents AS MATERIALIZED (
    SELECT document.deck_id, COALESCE(deck.title, 'Untitled') AS title
    FROM public.data_room_documents document
    JOIN public.decks deck ON deck.id = document.deck_id
    WHERE document.data_room_id = p_room_id
  ),
  visitor_summaries AS MATERIALIZED (
    SELECT page_view.visitor_id,
           (array_agg(page_view.viewer_email ORDER BY page_view.viewed_at)
             FILTER (WHERE page_view.viewer_email IS NOT NULL))[1] AS viewer_email,
           COUNT(*)::INTEGER AS total_visits,
           COALESCE(SUM(page_view.time_spent), 0)::BIGINT AS total_time,
           COUNT(DISTINCT page_view.viewed_at::DATE)::INTEGER AS distinct_days,
           COUNT(DISTINCT (page_view.deck_id, page_view.page_number))
             FILTER (WHERE COALESCE(page_view.time_spent, 0) >= 20)::INTEGER AS deep_slides,
           CASE WHEN COUNT(*) >= 2
             THEN ROUND(EXTRACT(EPOCH FROM (MAX(page_view.viewed_at) - MIN(page_view.viewed_at))) / 86400)::INTEGER
             ELSE NULL
           END AS days_between_first_and_last
    FROM retained_views page_view
    GROUP BY page_view.visitor_id
  ),
  visitor_deck_summaries AS MATERIALIZED (
    SELECT page_view.visitor_id,
           page_view.deck_id,
           COUNT(*)::INTEGER AS total_visits,
           COALESCE(SUM(page_view.time_spent), 0)::BIGINT AS total_time
    FROM retained_views page_view
    GROUP BY page_view.visitor_id, page_view.deck_id
  ),
  visitor_deck_breakdowns AS MATERIALIZED (
    SELECT summary.visitor_id,
           jsonb_agg(jsonb_build_object(
             'deckId', summary.deck_id,
             'totalVisits', summary.total_visits,
             'totalTime', summary.total_time
           ) ORDER BY summary.total_visits DESC, summary.total_time DESC) AS breakdown
    FROM visitor_deck_summaries summary
    GROUP BY summary.visitor_id
  )
  SELECT jsonb_build_object(
    'analytics', jsonb_build_object(
      'totalVisitors', (SELECT COUNT(DISTINCT visitor_id)::INTEGER FROM retained_views),
      'perDeck', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'deckId', document.deck_id,
          'title', document.title,
          'visitors', document.visitors
        ) ORDER BY document.title)
        FROM (
          SELECT room_document.deck_id,
                 room_document.title,
                 COUNT(DISTINCT retained_view.visitor_id)::INTEGER AS visitors
          FROM room_documents room_document
          LEFT JOIN retained_views retained_view ON retained_view.deck_id = room_document.deck_id
          GROUP BY room_document.deck_id, room_document.title
        ) document
      ), '[]'::JSONB)
    ),
    'documentStats', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'deckId', document.deck_id,
        'title', document.title,
        'totalViews', document.total_views,
        'totalTimeSeconds', document.total_time_seconds,
        'uniqueVisitors', document.unique_visitors
      ) ORDER BY document.total_views DESC, document.total_time_seconds DESC)
      FROM (
        SELECT room_document.deck_id,
               room_document.title,
               COUNT(retained_view.id)::INTEGER AS total_views,
               COALESCE(SUM(retained_view.time_spent), 0)::BIGINT AS total_time_seconds,
               COUNT(DISTINCT retained_view.visitor_id)::INTEGER AS unique_visitors
        FROM room_documents room_document
        LEFT JOIN retained_views retained_view ON retained_view.deck_id = room_document.deck_id
        GROUP BY room_document.deck_id, room_document.title
      ) document
    ), '[]'::JSONB),
    'visitorMetrics', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'visitorId', summary.visitor_id,
        'viewerEmail', summary.viewer_email,
        'totalVisits', summary.total_visits,
        'totalTime', summary.total_time,
        'distinctDays', summary.distinct_days,
        'deepSlides', summary.deep_slides,
        'daysBetweenFirstAndLast', summary.days_between_first_and_last,
        'deckBreakdown', COALESCE(breakdown.breakdown, '[]'::JSONB)
      ) ORDER BY summary.total_time DESC)
      FROM visitor_summaries summary
      LEFT JOIN visitor_deck_breakdowns breakdown ON breakdown.visitor_id = summary.visitor_id
    ), '[]'::JSONB),
    'locations', jsonb_build_object(
      'countries', COALESCE((
        SELECT jsonb_agg(country ORDER BY country.count DESC)
        FROM (
          SELECT COALESCE(page_view.country, 'Unknown') AS name,
                 COALESCE(page_view.country_code, 'XX') AS code,
                 COUNT(*)::INTEGER AS count
          FROM retained_views page_view
          GROUP BY 1, 2
        ) country
      ), '[]'::JSONB),
      'cities', COALESCE((
        SELECT jsonb_agg(city ORDER BY city.count DESC)
        FROM (
          SELECT COALESCE(page_view.city, 'Unknown City') AS name,
                 COALESCE(page_view.country, 'Unknown') AS country,
                 COUNT(*)::INTEGER AS count
          FROM retained_views page_view
          GROUP BY 1, 2
        ) city
      ), '[]'::JSONB)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_data_room_analytics_bundle(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_data_room_analytics_bundle(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_total_stats(p_deck_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  WITH owned_decks AS MATERIALIZED (
    SELECT deck.id
    FROM public.decks deck
    WHERE deck.user_id = auth.uid()
      AND deck.status <> 'DELETED'
      AND (p_deck_id IS NULL OR deck.id = p_deck_id)
  )
  SELECT jsonb_build_object(
    'totalViews', COALESCE((
      SELECT COUNT(DISTINCT (page_view.deck_id, page_view.visitor_id))::INTEGER
      FROM public.deck_page_views page_view
      JOIN owned_decks deck ON deck.id = page_view.deck_id
    ), 0),
    'totalTimeSeconds', COALESCE((
      SELECT SUM(stat.total_time_seconds)::BIGINT
      FROM public.deck_stats stat
      JOIN owned_decks deck ON deck.id = stat.deck_id
    ), 0),
    'totalSaves', COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.investor_library saved
      JOIN owned_decks deck ON deck.id = saved.deck_id
    ), 0),
    'deckCount', (SELECT COUNT(*)::INTEGER FROM owned_decks)
  );
$$;

REVOKE ALL ON FUNCTION public.get_user_total_stats(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_total_stats(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_daily_metrics(
  p_deck_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE(metric_date DATE, visits INTEGER, time_spent BIGINT, bookmarks INTEGER)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  WITH requested_days AS (
    SELECT LEAST(GREATEST(COALESCE(p_days, 7), 1), 31) AS count
  ),
  dates AS (
    SELECT generated::DATE AS metric_date
    FROM requested_days,
      generate_series(
        CURRENT_DATE - (requested_days.count - 1),
        CURRENT_DATE,
        INTERVAL '1 day'
      ) generated
  ),
  owned_decks AS MATERIALIZED (
    SELECT deck.id
    FROM public.decks deck
    WHERE deck.user_id = auth.uid()
      AND deck.status <> 'DELETED'
      AND (p_deck_id IS NULL OR deck.id = p_deck_id)
  ),
  view_metrics AS (
    SELECT page_view.viewed_at::DATE AS metric_date,
           COUNT(DISTINCT (page_view.deck_id, page_view.visitor_id))::INTEGER AS visits,
           COALESCE(SUM(page_view.time_spent), 0)::BIGINT AS time_spent
    FROM public.deck_page_views page_view
    JOIN owned_decks deck ON deck.id = page_view.deck_id
    CROSS JOIN requested_days
    WHERE page_view.viewed_at >= CURRENT_DATE - (requested_days.count - 1)
    GROUP BY page_view.viewed_at::DATE
  ),
  save_metrics AS (
    SELECT saved.created_at::DATE AS metric_date,
           COUNT(*)::INTEGER AS bookmarks
    FROM public.investor_library saved
    JOIN owned_decks deck ON deck.id = saved.deck_id
    CROSS JOIN requested_days
    WHERE saved.created_at >= CURRENT_DATE - (requested_days.count - 1)
    GROUP BY saved.created_at::DATE
  )
  SELECT metric_day.metric_date,
         COALESCE(view_stat.visits, 0),
         COALESCE(view_stat.time_spent, 0),
         COALESCE(saved.bookmarks, 0)
  FROM dates metric_day
  LEFT JOIN view_metrics view_stat USING (metric_date)
  LEFT JOIN save_metrics saved USING (metric_date)
  ORDER BY metric_day.metric_date;
$$;

REVOKE ALL ON FUNCTION public.get_user_daily_metrics(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_daily_metrics(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_deck_list_analytics(p_deck_ids UUID[])
RETURNS TABLE(
  deck_id UUID,
  save_count INTEGER,
  active_link_count INTEGER,
  total_link_count INTEGER,
  last_viewed_at TIMESTAMPTZ,
  total_time_seconds BIGINT,
  tags JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  WITH owned_decks AS MATERIALIZED (
    SELECT deck.id
    FROM public.decks deck
    WHERE deck.user_id = auth.uid()
      AND deck.id = ANY(COALESCE(p_deck_ids, ARRAY[]::UUID[]))
      AND deck.status <> 'DELETED'
  ),
  save_stats AS (
    SELECT saved.deck_id, COUNT(*)::INTEGER AS save_count
    FROM public.investor_library saved
    JOIN owned_decks deck ON deck.id = saved.deck_id
    GROUP BY saved.deck_id
  ),
  link_stats AS (
    SELECT link.deck_id,
           COUNT(*)::INTEGER AS total_link_count,
           COUNT(*) FILTER (WHERE link.is_enabled)::INTEGER AS active_link_count
    FROM public.deck_links link
    JOIN owned_decks deck ON deck.id = link.deck_id
    GROUP BY link.deck_id
  ),
  attention_stats AS (
    SELECT stat.deck_id,
           MAX(stat.updated_at) AS last_viewed_at,
           COALESCE(SUM(stat.total_time_seconds), 0)::BIGINT AS total_time_seconds
    FROM public.deck_stats stat
    JOIN owned_decks deck ON deck.id = stat.deck_id
    GROUP BY stat.deck_id
  ),
  tag_stats AS (
    SELECT link.deck_id,
           jsonb_agg(jsonb_build_object(
             'id', tag.id,
             'name', tag.name,
             'color', tag.color,
             'deleted_at', tag.deleted_at
           ) ORDER BY tag.name) FILTER (WHERE tag.deleted_at IS NULL) AS tags
    FROM public.deck_tags link
    JOIN owned_decks deck ON deck.id = link.deck_id
    JOIN public.global_tags tag ON tag.id = link.tag_id
    GROUP BY link.deck_id
  )
  SELECT deck.id,
         COALESCE(saved.save_count, 0),
         COALESCE(link.active_link_count, 0),
         COALESCE(link.total_link_count, 0),
         attention.last_viewed_at,
         COALESCE(attention.total_time_seconds, 0),
         COALESCE(tag.tags, '[]'::JSONB)
  FROM owned_decks deck
  LEFT JOIN save_stats saved ON saved.deck_id = deck.id
  LEFT JOIN link_stats link ON link.deck_id = deck.id
  LEFT JOIN attention_stats attention ON attention.deck_id = deck.id
  LEFT JOIN tag_stats tag ON tag.deck_id = deck.id;
$$;

REVOKE ALL ON FUNCTION public.get_deck_list_analytics(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_deck_list_analytics(UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
