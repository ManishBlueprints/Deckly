-- Fix location analytics fallbacks to uniformly use 'XX' instead of 'US' for missing ISO country codes.
-- This aligns historical data and server-side RPCs with the client-side geo fallback strategy.

-- 1. Backfill legacy null values in deck_page_views
UPDATE public.deck_page_views
SET country_code = 'XX'
WHERE country_code IS NULL;

-- 2. Update get_deck_locations RPC
CREATE OR REPLACE FUNCTION public.get_deck_locations(p_deck_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
    RETURN jsonb_build_object(
        'countries', COALESCE((
            SELECT jsonb_agg(t) FROM (
                SELECT COALESCE(country, 'Unknown') as name,
                       COALESCE(country_code, 'XX') as code,
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
END;
$$;

-- 3. Update get_data_room_locations RPC
CREATE OR REPLACE FUNCTION public.get_data_room_locations(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN jsonb_build_object(
    'countries', COALESCE((
      SELECT jsonb_agg(t)
      FROM (
        SELECT
          COALESCE(dpv.country, 'Unknown') AS name,
          COALESCE(dpv.country_code, 'XX') AS code,
          COUNT(*)::integer AS count
        FROM public.deck_page_views dpv
        JOIN public.data_rooms dr
          ON dr.id = dpv.data_room_id
        WHERE dpv.data_room_id = p_room_id
          AND dr.user_id = auth.uid()
        GROUP BY dpv.country, dpv.country_code
        ORDER BY count DESC
      ) t
    ), '[]'::jsonb),
    'cities', COALESCE((
      SELECT jsonb_agg(t)
      FROM (
        SELECT
          COALESCE(dpv.city, 'Unknown City') AS name,
          COALESCE(dpv.country, 'Unknown') AS country,
          COUNT(*)::integer AS count
        FROM public.deck_page_views dpv
        JOIN public.data_rooms dr
          ON dr.id = dpv.data_room_id
        WHERE dpv.data_room_id = p_room_id
          AND dr.user_id = auth.uid()
        GROUP BY dpv.city, dpv.country
        ORDER BY count DESC
      ) t
    ), '[]'::jsonb)
  );
END;
$$;
