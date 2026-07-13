-- Checkout expiry, billing-history snapshots, and entitlement updates.
-- This is deliberately forward-only so deployed billing databases remain safe.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS checkout_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoices_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS subscriptions_checkout_expiry_idx
  ON public.subscriptions(checkout_expires_at)
  WHERE provider_status = 'created';

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  razorpay_invoice_id text NOT NULL UNIQUE,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  razorpay_subscription_id text NOT NULL,
  plan_code text NOT NULL REFERENCES public.billing_plan_catalog(code),
  invoice_number text,
  provider_status text NOT NULL CHECK (provider_status IN ('draft', 'issued', 'partially_paid', 'paid', 'expired', 'cancelled', 'deleted')),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount bigint NOT NULL DEFAULT 0,
  amount_paid bigint NOT NULL DEFAULT 0,
  amount_due bigint NOT NULL DEFAULT 0,
  hosted_url text,
  billing_start timestamptz,
  billing_end timestamptz,
  issued_at timestamptz,
  paid_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  provider_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_invoices_user_date_idx
  ON public.billing_invoices(user_id, COALESCE(paid_at, issued_at, created_at) DESC);
CREATE INDEX IF NOT EXISTS billing_invoices_subscription_idx
  ON public.billing_invoices(subscription_id);

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
-- Invoice snapshots can contain provider metadata. They are intentionally read
-- through the authenticated Edge Function, which returns only normalized fields.
DROP POLICY IF EXISTS "Users may read their billing invoices" ON public.billing_invoices;

-- The Edge Functions use a server-derived plan code in the provider snapshot.
-- It keeps provider status, effective tier, checkout lifecycle, and profile tier
-- aligned in one locked transaction.
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
