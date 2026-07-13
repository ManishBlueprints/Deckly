# Billing operations

## Reconciliation schedule

Deploy `reconcile-subscriptions` as an unauthenticated Edge Function and invoke
it every 15 minutes from a scheduler (Supabase Cron, GitHub Actions, or the
hosting platform's scheduler):

```sh
curl --fail-with-body --request POST "$SUPABASE_URL/functions/v1/reconcile-subscriptions" \
  --header "x-cron-secret: $CRON_SECRET"
```

`CRON_SECRET` must be distinct from Razorpay credentials and the webhook secret.
The function works in bounded batches and is safe to run again when a preceding
run fails. Alert when the response has `failures > 0`; invoke it again while
`has_more` is true if the account has more than one batch of subscriptions.

## Required secrets

- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- All six environment-specific `RAZORPAY_PLAN_*` IDs
- `CRON_SECRET`

The deployed webhook URL is:

```text
https://<project-ref>.supabase.co/functions/v1/razorpay-webhook
```

Never place a secret or a Razorpay plan ID in a `VITE_*` variable. Use separate
Test and Live plans and secrets.

## Before deployment

Apply database migrations with the Supabase CLI, then deploy every billing
function together. Do not mark a migration as applied until the SQL has actually
been run against that database. The `20260713010000` migration removes direct
browser access to raw Razorpay subscription payloads and is required before this
refactor is deployed.
