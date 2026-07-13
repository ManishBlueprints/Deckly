import { adminClient, applyProviderSubscription, fetchRazorpaySubscription, hmacHex, json, syncInvoicesForSubscription, timingSafeEqual, type PlanCode } from "../_shared/billing.ts";

function eventSubscription(payload: Record<string, unknown>): Record<string, unknown> | null {
  const candidate = (payload.payload as Record<string, unknown> | undefined)?.subscription as Record<string, unknown> | undefined;
  const entity = candidate?.entity;
  return entity && typeof entity === "object" ? entity as Record<string, unknown> : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const eventId = req.headers.get("x-razorpay-event-id") ?? "";
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")?.trim() || "";
  if (!secret || !signature || !eventId || !timingSafeEqual(await hmacHex(secret, raw), signature)) return json({ error: "Unauthorized" }, 401);
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
  const eventType = typeof payload.event === "string" ? payload.event : "unknown";
  const subscription = eventSubscription(payload);
  const subscriptionId = typeof subscription?.id === "string" ? subscription.id : null;
  const admin = adminClient();
  const { error: recordedError } = await admin.from("billing_events").insert({ razorpay_event_id: eventId, event_type: eventType, razorpay_subscription_id: subscriptionId, payload });
  if (recordedError?.code === "23505") {
    const { data: existing, error: existingError } = await admin
      .from("billing_events")
      .select("processed_at")
      .eq("razorpay_event_id", eventId)
      .maybeSingle();
    if (existingError) return json({ error: "Could not inspect existing event" }, 500);
    if (existing?.processed_at) return json({ duplicate: true });
    // The earlier attempt recorded the event but failed its transition. Process
    // this verified retry rather than acknowledging it as a duplicate.
  }
  if (recordedError && recordedError.code !== "23505") return json({ error: "Could not record event" }, 500);
  try {
    if (!subscriptionId || !subscription) {
      await admin.from("billing_events").update({
        processed_at: new Date().toISOString(),
        processing_error: "Ignored event without a subscription payload",
      }).eq("razorpay_event_id", eventId);
      return json({ ignored: true });
    }

    const { data: local, error: localError } = await admin
      .from("subscriptions")
      .select("id, user_id, razorpay_subscription_id, plan_code")
      .eq("razorpay_subscription_id", subscriptionId)
      .maybeSingle();
    if (localError) throw localError;
    if (!local) {
      await admin.from("billing_events").update({
        processed_at: new Date().toISOString(),
        processing_error: "Ignored event for an unknown Razorpay subscription",
      }).eq("razorpay_event_id", eventId);
      return json({ ignored: true });
    }

    // Webhooks can be duplicated, delayed, or delivered out of order. The
    // payload only identifies the subscription; Razorpay is the authority for
    // the actual transition we apply.
    const provider = await fetchRazorpaySubscription(subscriptionId);
    const applied = await applyProviderSubscription(admin, provider, {
      fallbackPlanCode: local.plan_code as PlanCode,
    });
    try {
      await syncInvoicesForSubscription(admin, { ...local, plan_code: applied.planCode });
    } catch (invoiceError) {
      console.error("Billing invoice synchronization failed", invoiceError);
    }

    await admin.from("billing_events").update({
      processed_at: new Date().toISOString(),
      processing_error: null,
    }).eq("razorpay_event_id", eventId);
    return json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("billing_events").update({ processing_error: message }).eq("razorpay_event_id", eventId);
    // Return a non-2xx response so Razorpay retries a failed transition.
    return json({ error: "Event processing failed" }, 500);
  }
});
