import { adminClient, applyProviderSubscription, asProviderSubscription, fetchRazorpaySubscription, json, planFor, razorpay, razorpayPlanId, requireUser, type PlanCode } from "../_shared/billing.ts";

const OPEN_STATUSES = ["created", "authenticated", "active", "pending", "halted", "paused"];
const CHECKOUT_EXPIRY_MS = 30 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const plan = planFor(body?.tier, body?.interval);
    if (!plan) return json({ error: "Choose a paid plan and billing interval." }, 400);
    const razorpayPlan = razorpayPlanId(plan.code);
    const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim() || "";
    if (!razorpayPlan || !keyId) return json({ error: "Billing is not configured yet." }, 503);

    const admin = adminClient();
    const { data: existing, error: existingError } = await admin
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("provider_status", OPEN_STATUSES)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      if (existing.provider_status !== "created") {
        return json({ error: "You already have an open subscription. Manage it before starting another." }, 409);
      }

      // An abandoned Checkout is never resumed. Reconcile it first; cancel it
      // only if Razorpay still confirms that no authorisation took place.
      let provider = await fetchRazorpaySubscription(existing.razorpay_subscription_id);
      if (provider.status === "created") {
        try {
          provider = asProviderSubscription(await razorpay(`/subscriptions/${encodeURIComponent(existing.razorpay_subscription_id)}/cancel`, {
            method: "POST",
            body: JSON.stringify({ cancel_at_cycle_end: false }),
          }));
        } catch {
          provider = await fetchRazorpaySubscription(existing.razorpay_subscription_id);
        }
      }
      await applyProviderSubscription(admin, provider, {
        fallbackPlanCode: existing.plan_code as PlanCode,
      });
      if (OPEN_STATUSES.includes(String(provider.status))) {
        return json({ error: "Your previous checkout is still being verified. Please refresh in a moment." }, 409);
      }
    }

    const checkoutExpiresAt = new Date(Date.now() + CHECKOUT_EXPIRY_MS);
    const subscription = asProviderSubscription(await razorpay("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        plan_id: razorpayPlan,
        // Razorpay caps a subscription at 100 years. Monthly plans can have
        // 1,200 cycles; yearly plans must be limited to 100 cycles.
        total_count: plan.interval === "yearly" ? 100 : 1200,
        customer_notify: true,
        expire_by: Math.floor(checkoutExpiresAt.getTime() / 1000),
        notes: { deckly_user_id: user.id, plan_code: plan.code },
      }),
    }));
    const { error: insertError } = await admin.from("subscriptions").insert({
      user_id: user.id,
      plan_code: plan.code,
      entitlement_tier: plan.tier,
      billing_interval: plan.interval,
      razorpay_subscription_id: subscription.id,
      provider_status: subscription.status,
      current_period_start: subscription.current_start ? new Date(Number(subscription.current_start) * 1000).toISOString() : null,
      current_period_end: subscription.current_end ? new Date(Number(subscription.current_end) * 1000).toISOString() : null,
      checkout_expires_at: checkoutExpiresAt.toISOString(),
      provider_snapshot: subscription,
    });
    if (insertError) {
      // Reconciliation only sees local rows, so compensate for a failed local
      // write rather than leaving a customer-facing orphan in Razorpay.
      if (subscription.status === "created") {
        try {
          await razorpay(`/subscriptions/${encodeURIComponent(subscription.id)}/cancel`, {
            method: "POST",
            body: JSON.stringify({ cancel_at_cycle_end: false }),
          });
        } catch (cancelError) {
          console.error("Could not cancel orphaned Razorpay subscription", {
            subscriptionId: subscription.id,
            message: cancelError instanceof Error ? cancelError.message : "Unknown error",
          });
        }
      }
      throw insertError;
    }
    return json({ key_id: keyId, subscription_id: subscription.id, checkout_expires_at: checkoutExpiresAt.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start subscription";
    console.error("create-subscription failed", { message });
    return json({ error: message }, message === "Unauthorized" ? 401 : 500);
  }
});
