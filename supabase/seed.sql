-- =============================================================================
-- LOCAL DEVELOPMENT SEED DATA
-- This file is automatically run by `supabase db reset`.
-- DO NOT include production secrets or real user data here.
-- =============================================================================

-- Admin email allowlist (local development only)
INSERT INTO public.admin_emails (email, added_at)
VALUES ('test1@deckly.com', NOW())
ON CONFLICT (email) DO NOTHING;
