-- Data room location analytics RPC

DROP FUNCTION IF EXISTS public.get_data_room_locations(uuid);

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
          COALESCE(dpv.country_code, 'US') AS code,
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

GRANT EXECUTE ON FUNCTION public.get_data_room_locations(uuid) TO anon, authenticated;
