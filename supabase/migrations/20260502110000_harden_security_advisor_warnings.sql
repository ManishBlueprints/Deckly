BEGIN;

-- Public asset URLs do not require a broad SELECT policy, and removing it
-- prevents anonymous clients from listing every object in the public bucket.
DROP POLICY IF EXISTS "Anyone can read assets bucket" ON storage.objects;

-- Lock function resolution to trusted schemas.
ALTER FUNCTION public.set_data_room_folder_audit_fields() SET search_path = public, extensions;
ALTER FUNCTION public.update_tutorial_state(jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.get_current_user_tier_limit() SET search_path = public, extensions;
ALTER FUNCTION public.count_unique_visitors(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.get_deck_locations(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.get_data_room_locations(uuid) SET search_path = public, extensions;

-- These functions do not need SECURITY DEFINER privileges.
ALTER FUNCTION public.update_tutorial_state(jsonb) SECURITY INVOKER;
ALTER FUNCTION public.get_current_user_tier_limit() SECURITY INVOKER;
ALTER FUNCTION public.count_unique_visitors(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_deck_locations(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_data_room_locations(uuid) SECURITY INVOKER;

-- Remove implicit/default public execution from authenticated-only RPCs.
REVOKE EXECUTE ON FUNCTION public.update_tutorial_state(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_current_user_tier_limit() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.count_unique_visitors(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_deck_locations(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_data_room_locations(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_batch_data_room_analytics(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_data_room_folder(uuid, text, text, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reorder_data_room_folders(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_admin_broadcast(uuid[], text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_admin_broadcast_all(text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_total_system_users() FROM PUBLIC, anon;

-- These helpers should never be callable from client RPC endpoints.
REVOKE EXECUTE ON FUNCTION public.set_data_room_folder_audit_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_failed_attempt(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_rate_limit(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_signup_throttle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_deck_save() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_signal_threshold() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_deck_update() FROM PUBLIC, anon, authenticated;

-- Re-assert intended grants explicitly.
GRANT EXECUTE ON FUNCTION public.update_tutorial_state(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_tier_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_unique_visitors(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_deck_locations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_room_locations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_batch_data_room_analytics(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_data_room_folder(uuid, text, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_data_room_folders(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_broadcast(uuid[], text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_broadcast_all(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_total_system_users() TO authenticated;

COMMIT;
