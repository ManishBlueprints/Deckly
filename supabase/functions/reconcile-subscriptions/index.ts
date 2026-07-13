import { adminClient, applyProviderSubscription, fetchRazorpaySubscription, json, syncInvoicesForSubscription, type PlanCode } from "../_shared/billing.ts";

const BATCH_SIZE = 50;
const RECONCILABLE_STATUSES = ["created", "authenticated", "active", "pending", "halted", "paused", "cancelled", "completed", "expired"];

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const cronSecret = Deno.env.get("CRON_SECRET")?.trim() || "";
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) return json({ error: "Unauthorized" }, 401);

  try {
    const admin = adminClient();
    const { data: subscriptions, error } = await admin
      .from("subscriptions")
      .select("id, user_id, razorpay_subscription_id, plan_code")
      .in("provider_status", RECONCILABLE_STATUSES)
      .order("updated_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;

    let reconciled = 0;
    let failures = 0;
    for (const local of subscriptions ?? []) {
      try {
        const provider = await fetchRazorpaySubscription(local.razorpay_subscription_id);
        const applied = await applyProviderSubscription(admin, provider, {
          fallbackPlanCode: local.plan_code as PlanCode,
        });
        try {
          await syncInvoicesForSubscription(admin, { ...local, plan_code: applied.planCode });
        } catch (invoiceError) {
          // The subscription state has been repaired; the next run can retry
          // its invoice cache independently.
          console.error("Billing invoice synchronization failed", {
            subscriptionId: local.razorpay_subscription_id,
            message: invoiceError instanceof Error ? invoiceError.message : "Unknown error",
          });
        }
        reconciled += 1;
      } catch (error) {
        failures += 1;
        console.error("Subscription reconciliation failed", {
          subscriptionId: local.razorpay_subscription_id,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return json({
      reconciled,
      failures,
      has_more: (subscriptions?.length ?? 0) === BATCH_SIZE,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Reconciliation failed" }, 500);
  }
});
