-- Forward-only hardening for databases that already applied the initial
-- subscription migrations. Do not edit those deployed migrations.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_pending_at timestamptz;

-- Authenticated profile edits must not set the server-owned deletion marker.
-- The privileged deletion functions opt in with a transaction-local setting.
CREATE OR REPLACE FUNCTION public.prevent_profile_billing_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.role() IN ('authenticated', 'anon')
    AND current_setting('app.account_deletion_in_progress', true) IS DISTINCT FROM 'true'
    AND (
      NEW.tier IS DISTINCT FROM OLD.tier
      OR NEW.deletion_pending_at IS DISTINCT FROM OLD.deletion_pending_at
    ) THEN
    RAISE EXCEPTION 'Subscription and account-deletion state are managed by the server.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_account_deletion(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE user_id = p_user_id
      AND provider_status IN ('created', 'authenticated', 'active', 'pending', 'halted', 'paused')
  ) THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.account_deletion_in_progress', 'true', true);
  UPDATE public.profiles
  SET deletion_pending_at = now(), updated_at = now()
  WHERE id = p_user_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_account_deletion(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1
  FROM public.profiles
  WHERE id = p_user_id AND deletion_pending_at IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE user_id = p_user_id
      AND provider_status IN ('created', 'authenticated', 'active', 'pending', 'halted', 'paused')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_account_deletion_pending(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.account_deletion_in_progress', 'true', true);
  UPDATE public.profiles
  SET deletion_pending_at = NULL, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_subscription_for_deletion_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.user_id AND deletion_pending_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Account deletion is in progress.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_subscription_for_deletion_pending ON public.subscriptions;
CREATE TRIGGER prevent_subscription_for_deletion_pending
  BEFORE INSERT ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_subscription_for_deletion_pending();

REVOKE ALL ON FUNCTION public.begin_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_account_deletion_pending(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_account_deletion(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_account_deletion(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_account_deletion_pending(uuid) TO service_role;

-- Keep a scheduled plan code and its effective timestamp as one contract.
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

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_subscription.user_id AND deletion_pending_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Account deletion is in progress.' USING ERRCODE = '55000';
  END IF;

  v_provider_plan_code := NULLIF(p_snapshot ->> '_deckly_plan_code', '');
  IF v_provider_plan_code IS NOT NULL THEN
    SELECT tier INTO v_provider_tier
    FROM public.billing_plan_catalog
    WHERE code = v_provider_plan_code;
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
      pending_change_at = CASE
        WHEN COALESCE((p_snapshot ->> '_deckly_preserve_pending_plan')::boolean, false)
          THEN pending_change_at
        ELSE p_pending_change_at
      END,
      checkout_expires_at = CASE
        WHEN p_provider_status <> 'created' THEN NULL
        WHEN p_snapshot ? '_deckly_checkout_expires_at'
          THEN NULLIF(p_snapshot ->> '_deckly_checkout_expires_at', '')::timestamptz
        ELSE checkout_expires_at
      END,
      checkout_dismissed_at = CASE
        WHEN p_snapshot ? '_deckly_checkout_dismissed_at'
          THEN NULLIF(p_snapshot ->> '_deckly_checkout_dismissed_at', '')::timestamptz
        ELSE checkout_dismissed_at
      END,
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
GRANT EXECUTE ON FUNCTION public.apply_subscription_entitlement(text, text, text, text, timestamptz, timestamptz, boolean, text, timestamptz, jsonb, timestamptz) TO service_role;
