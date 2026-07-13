import { adminClient, applyProviderSubscription, corsPreflight, fetchRazorpaySubscription, hmacHex, json, requireUser, syncInvoicesForSubscription, timingSafeEqual, type PlanCode } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(req);
    const input = await req.json();
    const subscriptionId = typeof input?.subscription_id === "string" ? input.subscription_id : "";
    const paymentId = typeof input?.payment_id === "string" ? input.payment_id : "";
    const signature = typeof input?.signature === "string" ? input.signature : "";
    if (!subscriptionId || !paymentId || !signature) return json({ error: "Incomplete payment verification data." }, 400);
    const admin = adminClient();
    const { data: local, error } = await admin.from("subscriptions").select("*").eq("razorpay_subscription_id", subscriptionId).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!local) return json({ error: "Subscription does not belong to this account." }, 404);
    const secret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim() || "";
    if (!secret || !timingSafeEqual(await hmacHex(secret, `${paymentId}|${subscriptionId}`), signature)) return json({ error: "Payment verification failed." }, 400);
    const provider = await fetchRazorpaySubscription(subscriptionId);
    const applied = await applyProviderSubscription(admin, provider, {
      fallbackPlanCode: local.plan_code as PlanCode,
      checkoutVerifiedAt: new Date().toISOString(),
    });
    try {
      await syncInvoicesForSubscription(admin, {
        id: local.id,
        user_id: user.id,
        razorpay_subscription_id: subscriptionId,
        plan_code: applied.planCode,
      });
    } catch (invoiceError) {
      console.error("Billing invoice synchronization failed", invoiceError);
    }
    return json({ verified: true, status: provider.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify payment";
    return json({ error: message }, message === "Unauthorized" ? 401 : 500);
  }
});
