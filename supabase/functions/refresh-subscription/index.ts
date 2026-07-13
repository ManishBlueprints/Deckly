import { adminClient, applyProviderSubscription, fetchRazorpaySubscription, json, requireUser, type PlanCode } from "../_shared/billing.ts";

// This is a customer-safe recovery path for the narrow window where Checkout
// completes but its browser callback or Razorpay webhook is lost. It only
// reconciles the caller's locally-created subscriptions; it never accepts a
// provider state from the browser.
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireUser(req);
    const admin = adminClient();
    const { data: subscriptions, error } = await admin
      .from("subscriptions")
      .select("id, razorpay_subscription_id, plan_code, provider_status")
      .eq("user_id", user.id)
      .eq("provider_status", "created");
    if (error) throw error;

    let reconciled = 0;
    for (const local of subscriptions ?? []) {
      const provider = await fetchRazorpaySubscription(local.razorpay_subscription_id);
      if (provider.status === "created") continue;

      await applyProviderSubscription(admin, provider, {
        fallbackPlanCode: local.plan_code as PlanCode,
      });
      reconciled += 1;
    }

    return json({ reconciled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to refresh subscription.";
    return json({ error: message }, message === "Unauthorized" ? 401 : 500);
  }
});
