import { adminClient, json, requireUser, syncInvoicesForSubscription } from "../_shared/billing.ts";

const MAX_PAGE_SIZE = 50;
const SYNC_STALE_AFTER_MS = 5 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireUser(req);
    const input = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(input?.limit) || 20));
    const offset = Math.max(0, Number(input?.offset) || 0);
    const admin = adminClient();
    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("subscriptions")
      .select("id, user_id, razorpay_subscription_id, plan_code, invoices_synced_at")
      .eq("user_id", user.id);
    if (subscriptionsError) throw subscriptionsError;

    const staleBefore = Date.now() - SYNC_STALE_AFTER_MS;
    let stale = false;
    for (const subscription of subscriptions ?? []) {
      const syncedAt = subscription.invoices_synced_at ? new Date(subscription.invoices_synced_at).getTime() : 0;
      if (!syncedAt || syncedAt < staleBefore) {
        try {
          await syncInvoicesForSubscription(admin, subscription);
        } catch {
          // A cached history is still more useful than a provider outage page.
          stale = true;
        }
      }
    }

    const { data: invoices, error: invoicesError, count } = await admin
      .from("billing_invoices")
      .select("razorpay_invoice_id, razorpay_subscription_id, plan_code, invoice_number, provider_status, currency, amount, amount_paid, amount_due, hosted_url, billing_start, billing_end, issued_at, paid_at, expired_at, cancelled_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("paid_at", { ascending: false, nullsFirst: false })
      .order("issued_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (invoicesError) throw invoicesError;

    return json({
      items: invoices ?? [],
      total: count ?? 0,
      next_offset: offset + (invoices?.length ?? 0) < (count ?? 0) ? offset + (invoices?.length ?? 0) : null,
      stale,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to load billing history." }, error instanceof Error && error.message === "Unauthorized" ? 401 : 500);
  }
});
