import { adminClient, applyProviderSubscription, asProviderSubscription, fetchRazorpaySubscription, json, planFor, razorpay, razorpayPlanId, requireUser, syncInvoicesForSubscription, tierRank, unixTime, type PlanCode } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(req);
    const input = await req.json().catch(() => ({}));
    const action = input?.action;
    const admin = adminClient();

    if (action === "abandon_checkout") {
      const subscriptionId = typeof input?.subscription_id === "string" ? input.subscription_id : "";
      if (!subscriptionId) return json({ error: "Missing checkout subscription." }, 400);
      const { data: checkout, error: checkoutError } = await admin
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("razorpay_subscription_id", subscriptionId)
        .eq("provider_status", "created")
        .maybeSingle();
      if (checkoutError) throw checkoutError;
      if (!checkout) return json({ abandoned: false });

      let provider = await fetchRazorpaySubscription(checkout.razorpay_subscription_id);
      if (provider.status === "created") {
        try {
          provider = asProviderSubscription(await razorpay(`/subscriptions/${encodeURIComponent(checkout.razorpay_subscription_id)}/cancel`, {
            method: "POST",
            body: JSON.stringify({ cancel_at_cycle_end: false }),
          }));
        } catch {
          provider = await fetchRazorpaySubscription(checkout.razorpay_subscription_id);
        }
      }
      await applyProviderSubscription(admin, provider, {
        fallbackPlanCode: checkout.plan_code as PlanCode,
        checkoutDismissedAt: provider.status === "cancelled" || provider.status === "expired" ? new Date().toISOString() : undefined,
      });
      return json({ abandoned: provider.status === "cancelled" || provider.status === "expired", status: provider.status });
    }

    const { data: local, error } = await admin
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("provider_status", ["created", "authenticated", "active", "pending", "halted", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!local) return json({ error: "No subscription found." }, 404);
    if (action === "cancel") {
      const provider = asProviderSubscription(await razorpay(`/subscriptions/${encodeURIComponent(local.razorpay_subscription_id)}/cancel`, { method: "POST", body: JSON.stringify({ cancel_at_cycle_end: true }) }));
      await applyProviderSubscription(admin, provider, {
        fallbackPlanCode: local.plan_code as PlanCode,
        pendingPlanCode: null,
        preservePendingPlan: false,
      });
      return json({ status: provider.status, cancel_at_period_end: true });
    }
    if (action === "change") {
      const plan = planFor(input?.tier, input?.interval);
      const targetPlanId = plan ? razorpayPlanId(plan.code) : "";
      if (!plan || !targetPlanId) return json({ error: "That plan is unavailable." }, 400);
      if (!['active', 'authenticated'].includes(local.provider_status)) return json({ error: "Your subscription cannot be changed in its current state." }, 409);
      if (local.payment_method && !['card'].includes(local.payment_method)) return json({ error: "Plan changes for this payment method need a new subscription. Please contact support." }, 409);
      const applyImmediately = tierRank(plan.tier) > tierRank(local.entitlement_tier);
      const updateStartedAt = Math.floor(Date.now() / 1000);
      const provider = asProviderSubscription(await razorpay(`/subscriptions/${encodeURIComponent(local.razorpay_subscription_id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          plan_id: targetPlanId,
          schedule_change_at: applyImmediately ? "now" : "cycle_end",
          customer_notify: true,
        }),
      }));
      const applied = await applyProviderSubscription(admin, provider, {
        fallbackPlanCode: local.plan_code as PlanCode,
        planCode: applyImmediately ? plan.code : null,
        pendingPlanCode: applyImmediately ? null : plan.code,
        pendingChangeAt: applyImmediately ? null : unixTime(provider.change_scheduled_at),
        preservePendingPlan: false,
      });
      const invoices = applyImmediately
        ? await syncInvoicesForSubscription(admin, { ...local, plan_code: applied.planCode })
        : [];
      const immediateCharge = invoices
        .filter((invoice) => invoice.amount > 0 && invoice.issued_at !== null && invoice.issued_at >= updateStartedAt - 5)
        .sort((left, right) => (right.issued_at ?? 0) - (left.issued_at ?? 0))[0] ?? null;
      return json({
        status: provider.status,
        pending_plan_code: applyImmediately ? null : plan.code,
        applied_immediately: applyImmediately,
        immediate_charge: immediateCharge
          ? { amount: immediateCharge.amount, currency: immediateCharge.currency, status: immediateCharge.provider_status }
          : null,
      });
    }
    if (action === "cancel_change") {
      const provider = asProviderSubscription(await razorpay(`/subscriptions/${encodeURIComponent(local.razorpay_subscription_id)}/cancel_scheduled_changes`, { method: "POST" }));
      await applyProviderSubscription(admin, provider, {
        fallbackPlanCode: local.plan_code as PlanCode,
        pendingPlanCode: null,
        pendingChangeAt: null,
        preservePendingPlan: false,
      });
      return json({ status: provider.status });
    }
    return json({ error: "Unknown subscription action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to manage subscription";
    return json({ error: message }, message === "Unauthorized" ? 401 : 500);
  }
});
