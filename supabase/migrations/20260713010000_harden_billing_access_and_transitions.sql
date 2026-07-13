-- Billing hardening: raw provider snapshots remain server-only and browser
-- callers receive a deliberately normalized subscription shape.

DROP POLICY IF EXISTS "Users may read their subscriptions" ON public.subscriptions;

-- The old function returned SETOF public.subscriptions, which included the raw
-- Razorpay snapshot. It has no dependants and is replaced with a safe shape.
DROP FUNCTION IF EXISTS public.get_my_subscription();

CREATE FUNCTION public.get_my_subscription()
RETURNS TABLE (
  id uuid,
  plan_code text,
  entitlement_tier text,
  billing_interval text,
  razorpay_subscription_id text,
  provider_status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  pending_plan_code text,
  pending_change_at timestamptz,
  checkout_expires_at timestamptz,
  checkout_dismissed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.plan_code,
    s.entitlement_tier,
    s.billing_interval,
    s.razorpay_subscription_id,
    s.provider_status,
    s.current_period_end,
    s.cancel_at_period_end,
    s.pending_plan_code,
    s.pending_change_at,
    s.checkout_expires_at,
    s.checkout_dismissed_at
  FROM public.subscriptions AS s
  WHERE s.user_id = auth.uid()
  ORDER BY CASE s.provider_status
    WHEN 'active' THEN 0
    WHEN 'authenticated' THEN 1
    WHEN 'pending' THEN 2
    WHEN 'halted' THEN 3
    WHEN 'paused' THEN 4
    WHEN 'created' THEN 5
    ELSE 6
  END, s.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_subscription() TO authenticated;

-- Invoice history can contain hundreds of rows across a long-lived
-- subscription. Merge a provider page in one statement, while preserving the
-- original plan code of invoices issued before a later plan change.
CREATE OR REPLACE FUNCTION public.merge_billing_invoice_snapshots(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Invoice snapshot rows must be a JSON array';
  END IF;

  INSERT INTO public.billing_invoices (
    razorpay_invoice_id,
    subscription_id,
    user_id,
    razorpay_subscription_id,
    plan_code,
    invoice_number,
    provider_status,
    currency,
    amount,
    amount_paid,
    amount_due,
    hosted_url,
    billing_start,
    billing_end,
    issued_at,
    paid_at,
    expired_at,
    cancelled_at,
    provider_snapshot,
    updated_at
  )
  SELECT
    row.razorpay_invoice_id,
    row.subscription_id,
    row.user_id,
    row.razorpay_subscription_id,
    row.plan_code,
    row.invoice_number,
    row.provider_status,
    row.currency,
    row.amount,
    row.amount_paid,
    row.amount_due,
    row.hosted_url,
    row.billing_start,
    row.billing_end,
    row.issued_at,
    row.paid_at,
    row.expired_at,
    row.cancelled_at,
    row.provider_snapshot,
    row.updated_at
  FROM jsonb_to_recordset(p_rows) AS row(
    razorpay_invoice_id text,
    subscription_id uuid,
    user_id uuid,
    razorpay_subscription_id text,
    plan_code text,
    invoice_number text,
    provider_status text,
    currency text,
    amount bigint,
    amount_paid bigint,
    amount_due bigint,
    hosted_url text,
    billing_start timestamptz,
    billing_end timestamptz,
    issued_at timestamptz,
    paid_at timestamptz,
    expired_at timestamptz,
    cancelled_at timestamptz,
    provider_snapshot jsonb,
    updated_at timestamptz
  )
  ON CONFLICT (razorpay_invoice_id) DO UPDATE
  SET subscription_id = EXCLUDED.subscription_id,
      user_id = EXCLUDED.user_id,
      razorpay_subscription_id = EXCLUDED.razorpay_subscription_id,
      invoice_number = EXCLUDED.invoice_number,
      provider_status = EXCLUDED.provider_status,
      currency = EXCLUDED.currency,
      amount = EXCLUDED.amount,
      amount_paid = EXCLUDED.amount_paid,
      amount_due = EXCLUDED.amount_due,
      hosted_url = EXCLUDED.hosted_url,
      billing_start = EXCLUDED.billing_start,
      billing_end = EXCLUDED.billing_end,
      issued_at = EXCLUDED.issued_at,
      paid_at = EXCLUDED.paid_at,
      expired_at = EXCLUDED.expired_at,
      cancelled_at = EXCLUDED.cancelled_at,
      provider_snapshot = EXCLUDED.provider_snapshot,
      updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_billing_invoice_snapshots(jsonb) FROM PUBLIC, anon, authenticated;
