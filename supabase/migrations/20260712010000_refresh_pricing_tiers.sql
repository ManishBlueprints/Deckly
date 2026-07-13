-- Customer-facing pricing: Free / Share / Founder / Raise.
-- PRO and PRO_PLUS remain persisted IDs for Share and Founder so existing
-- accounts continue working without a destructive profile migration.

ALTER TABLE public.billing_plan_catalog
  DROP CONSTRAINT IF EXISTS billing_plan_catalog_code_check;
ALTER TABLE public.billing_plan_catalog
  ADD CONSTRAINT billing_plan_catalog_code_check
  CHECK (code IN ('PRO_MONTHLY', 'PRO_YEARLY', 'PRO_PLUS_MONTHLY', 'PRO_PLUS_YEARLY', 'SHARE_MONTHLY', 'SHARE_YEARLY', 'FOUNDER_MONTHLY', 'FOUNDER_YEARLY', 'RAISE_MONTHLY', 'RAISE_YEARLY'));

ALTER TABLE public.billing_plan_catalog
  DROP CONSTRAINT IF EXISTS billing_plan_catalog_tier_check;
ALTER TABLE public.billing_plan_catalog
  ADD CONSTRAINT billing_plan_catalog_tier_check
  CHECK (tier IN ('PRO', 'PRO_PLUS', 'RAISE'));

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_entitlement_tier_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_entitlement_tier_check
  CHECK (entitlement_tier IN ('PRO', 'PRO_PLUS', 'RAISE'));

-- The original catalogue already contains the PRO / PRO_PLUS rows for these
-- tier-and-interval pairs. Rename those immutable codes rather than inserting
-- a second row, as (tier, interval) is intentionally unique. Cascade the
-- rename through existing subscriptions so this migration is safe for data
-- created before the customer-facing names changed.
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_code_fkey;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_code_fkey
  FOREIGN KEY (plan_code) REFERENCES public.billing_plan_catalog(code) ON UPDATE CASCADE;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_pending_plan_code_fkey;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_pending_plan_code_fkey
  FOREIGN KEY (pending_plan_code) REFERENCES public.billing_plan_catalog(code) ON UPDATE CASCADE;

UPDATE public.billing_plan_catalog
SET code = CASE code
  WHEN 'PRO_MONTHLY' THEN 'SHARE_MONTHLY'
  WHEN 'PRO_YEARLY' THEN 'SHARE_YEARLY'
  WHEN 'PRO_PLUS_MONTHLY' THEN 'FOUNDER_MONTHLY'
  WHEN 'PRO_PLUS_YEARLY' THEN 'FOUNDER_YEARLY'
  ELSE code
END
WHERE code IN ('PRO_MONTHLY', 'PRO_YEARLY', 'PRO_PLUS_MONTHLY', 'PRO_PLUS_YEARLY');

INSERT INTO public.billing_plan_catalog (code, tier, interval, display_amount, currency)
VALUES
  ('SHARE_MONTHLY', 'PRO', 'monthly', 9, 'USD'),
  ('SHARE_YEARLY', 'PRO', 'yearly', 86.4, 'USD'),
  ('FOUNDER_MONTHLY', 'PRO_PLUS', 'monthly', 15, 'USD'),
  ('FOUNDER_YEARLY', 'PRO_PLUS', 'yearly', 144, 'USD'),
  ('RAISE_MONTHLY', 'RAISE', 'monthly', 45, 'USD'),
  ('RAISE_YEARLY', 'RAISE', 'yearly', 432, 'USD')
ON CONFLICT (code) DO UPDATE SET
  tier = EXCLUDED.tier,
  interval = EXCLUDED.interval,
  display_amount = EXCLUDED.display_amount,
  currency = EXCLUDED.currency,
  active = true,
  updated_at = now();

INSERT INTO public.tier_limits (tier, max_file_size_bytes, max_decks, max_decks_per_day, max_decks_per_room)
VALUES
  ('FREE', 104857600, 5, 30, 5),
  ('PRO', 524288000, 25, 30, 25),
  ('PRO_PLUS', 3221225472, 150, 30, 150),
  ('RAISE', 16106127360, 1000, 30, 1000)
ON CONFLICT (tier) DO UPDATE SET
  max_file_size_bytes = EXCLUDED.max_file_size_bytes,
  max_decks = EXCLUDED.max_decks,
  max_decks_per_day = EXCLUDED.max_decks_per_day,
  max_decks_per_room = EXCLUDED.max_decks_per_room,
  updated_at = now();

-- A previous cancelled checkout must not mask an active subscription when the
-- profile reloads. Prefer live states, then the most recently created record.
CREATE OR REPLACE FUNCTION public.get_my_subscription()
RETURNS SETOF public.subscriptions LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT *
  FROM public.subscriptions
  WHERE user_id = auth.uid()
  ORDER BY CASE provider_status
    WHEN 'active' THEN 0
    WHEN 'authenticated' THEN 1
    WHEN 'pending' THEN 2
    WHEN 'halted' THEN 3
    WHEN 'paused' THEN 4
    WHEN 'created' THEN 5
    ELSE 6
  END, created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_subscription() TO authenticated;

-- Provider updates can change a plan immediately. The Edge Functions attach a
-- server-derived `_deckly_plan_code` to the provider snapshot, which lets this
-- existing privileged transaction update the subscription record and effective
-- tier atomically after Razorpay confirms the change.
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
DECLARE
  v_subscription public.subscriptions;
  v_next_tier text;
  v_provider_plan_code text;
  v_provider_tier text;
BEGIN
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE razorpay_subscription_id = p_razorpay_subscription_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown Razorpay subscription'; END IF;

  v_provider_plan_code := NULLIF(p_snapshot ->> '_deckly_plan_code', '');
  IF v_provider_plan_code IS NOT NULL THEN
    SELECT tier INTO v_provider_tier
    FROM public.billing_plan_catalog
    WHERE code = v_provider_plan_code AND active;
    IF v_provider_tier IS NULL THEN
      RAISE EXCEPTION 'Unknown billing plan code';
    END IF;
  END IF;

  UPDATE public.subscriptions
  SET provider_status = p_provider_status,
      plan_code = COALESCE(v_provider_plan_code, plan_code),
      entitlement_tier = COALESCE(v_provider_tier, entitlement_tier),
      razorpay_customer_id = COALESCE(p_customer_id, razorpay_customer_id),
      payment_method = COALESCE(p_payment_method, payment_method),
      current_period_start = COALESCE(p_current_start, current_period_start),
      current_period_end = COALESCE(p_current_end, current_period_end),
      cancel_at_period_end = p_cancel_at_period_end,
      pending_plan_code = CASE
        WHEN COALESCE((p_snapshot ->> '_deckly_preserve_pending_plan')::boolean, false)
          THEN pending_plan_code
        ELSE p_pending_plan_code
      END,
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
  UPDATE public.profiles
  SET tier = v_next_tier, updated_at = now()
  WHERE id = v_subscription.user_id;

  RETURN v_subscription;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_subscription_entitlement(text, text, text, text, timestamptz, timestamptz, boolean, text, timestamptz, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
