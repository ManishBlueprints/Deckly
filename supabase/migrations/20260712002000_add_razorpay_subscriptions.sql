-- Razorpay subscription ledger and the server-owned entitlement boundary.
-- Razorpay Plan IDs deliberately live in Edge Function secrets, not the database
-- or browser bundle. This keeps test/live configuration separate.

CREATE TABLE IF NOT EXISTS public.billing_plan_catalog (
  code text PRIMARY KEY CHECK (code IN ('PRO_MONTHLY', 'PRO_YEARLY', 'PRO_PLUS_MONTHLY', 'PRO_PLUS_YEARLY')),
  tier text NOT NULL CHECK (tier IN ('PRO', 'PRO_PLUS')),
  interval text NOT NULL CHECK (interval IN ('monthly', 'yearly')),
  display_amount numeric(12,2) NOT NULL CHECK (display_amount >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tier, interval)
);

INSERT INTO public.billing_plan_catalog (code, tier, interval, display_amount, currency)
VALUES
  ('PRO_MONTHLY', 'PRO', 'monthly', 9, 'USD'),
  ('PRO_YEARLY', 'PRO', 'yearly', 86, 'USD'),
  ('PRO_PLUS_MONTHLY', 'PRO_PLUS', 'monthly', 24, 'USD'),
  ('PRO_PLUS_YEARLY', 'PRO_PLUS', 'yearly', 230, 'USD')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.billing_plan_catalog(code),
  entitlement_tier text NOT NULL CHECK (entitlement_tier IN ('PRO', 'PRO_PLUS')),
  billing_interval text NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
  razorpay_subscription_id text NOT NULL UNIQUE,
  razorpay_customer_id text,
  payment_method text,
  provider_status text NOT NULL CHECK (provider_status IN ('created', 'authenticated', 'active', 'pending', 'halted', 'paused', 'cancelled', 'completed', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  pending_plan_code text REFERENCES public.billing_plan_catalog(code),
  pending_change_at timestamptz,
  checkout_verified_at timestamptz,
  provider_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_open_per_user
  ON public.subscriptions(user_id)
  WHERE provider_status IN ('created', 'authenticated', 'active', 'pending', 'halted', 'paused');
CREATE INDEX IF NOT EXISTS subscriptions_reconciliation_idx
  ON public.subscriptions(provider_status, current_period_end);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  razorpay_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  razorpay_subscription_id text,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text
);

ALTER TABLE public.billing_plan_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users may read billing plans" ON public.billing_plan_catalog FOR SELECT TO authenticated USING (active);
CREATE POLICY "Users may read their subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- The application historically lets a user update their profile. Explicitly
-- block attempts to self-upgrade while retaining existing profile edit flows.
CREATE OR REPLACE FUNCTION public.prevent_profile_billing_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.role() IN ('authenticated', 'anon') AND NEW.tier IS DISTINCT FROM OLD.tier THEN
    RAISE EXCEPTION 'Subscription tier is managed by billing.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_profile_billing_mutation ON public.profiles;
CREATE TRIGGER prevent_profile_billing_mutation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_billing_mutation();

-- Only trusted service-role Edge Functions can call this function. The caller
-- supplies a server-derived tier, never a browser input.
CREATE OR REPLACE FUNCTION public.apply_subscription_entitlement(
  p_razorpay_subscription_id text,
  p_provider_status text,
  p_customer_id text,
  p_payment_method text,
  p_current_start timestamptz,
  p_current_end timestamptz,
  p_cancel_at_period_end boolean,
  p_pending_plan_code text,
  p_pending_change_at timestamptz,
  p_snapshot jsonb,
  p_checkout_verified_at timestamptz DEFAULT NULL
)
RETURNS public.subscriptions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_subscription public.subscriptions; v_next_tier text;
BEGIN
  SELECT * INTO v_subscription FROM public.subscriptions WHERE razorpay_subscription_id = p_razorpay_subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown Razorpay subscription'; END IF;

  UPDATE public.subscriptions
  SET provider_status = p_provider_status,
      razorpay_customer_id = COALESCE(p_customer_id, razorpay_customer_id),
      payment_method = COALESCE(p_payment_method, payment_method),
      current_period_start = COALESCE(p_current_start, current_period_start),
      current_period_end = COALESCE(p_current_end, current_period_end),
      cancel_at_period_end = p_cancel_at_period_end,
      pending_plan_code = p_pending_plan_code,
      pending_change_at = p_pending_change_at,
      provider_snapshot = COALESCE(p_snapshot, provider_snapshot),
      checkout_verified_at = COALESCE(p_checkout_verified_at, checkout_verified_at),
      updated_at = now()
  WHERE id = v_subscription.id
  RETURNING * INTO v_subscription;

  v_next_tier := CASE
    WHEN p_provider_status IN ('authenticated', 'active', 'pending', 'paused')
      AND (v_subscription.current_period_end IS NULL OR v_subscription.current_period_end > now())
      THEN v_subscription.entitlement_tier
    ELSE 'FREE'
  END;
  UPDATE public.profiles SET tier = v_next_tier, updated_at = now() WHERE id = v_subscription.user_id;
  RETURN v_subscription;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_subscription_entitlement(text, text, text, text, timestamptz, timestamptz, boolean, text, timestamptz, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_subscription()
RETURNS SETOF public.subscriptions LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM public.subscriptions WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_subscription() TO authenticated;
