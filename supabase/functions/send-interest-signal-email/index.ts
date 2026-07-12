import { createClient } from "@supabase/supabase-js";

const MAX_ATTEMPTS = 5;

type InterestSignalEmailEvent = {
  id: string;
  recipient_email: string;
  deck_id: string;
  deck_title: string;
  deck_slug: string | null;
  viewer_email: string | null;
  signal_label: string;
  total_visits: number;
  total_time_seconds: number;
  distinct_days: number;
  deep_slides: number;
  days_between_first_and_last: number | null;
  status: "pending" | "sending" | "sent" | "failed";
  attempt_count: number;
  last_attempt_at: string | null;
};

type DatabaseWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: { id?: string } | null;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const cleanHeaderText = (value: string) =>
  value.replace(/[\r\n]/g, " ").trim().slice(0, 120);

const formatSeconds = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0
    ? `${minutes}m ${remainingSeconds}s`
    : `${minutes}m`;
};

const getErrorMessage = (value: unknown) => {
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return typeof value === "string" ? value : JSON.stringify(value);
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("PROJECT_SECRET_KEY") ??
    "";
  const webhookSecret = Deno.env.get("EMAIL_WEBHOOK_SECRET")?.trim() ?? "";
  const providedWebhookSecret = request.headers.get("x-email-webhook-secret") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    console.error("[send-interest-signal-email] Missing Supabase server configuration");
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  // This function is invoked by a database webhook with verify_jwt disabled.
  // Never accept a project service-role/secret key from request headers: those
  // credentials are for server-side Supabase access, not webhook authentication.
  if (providedWebhookSecret !== webhookSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const fromAddress = Deno.env.get("EMAIL_FROM") ?? "";
  const replyTo = Deno.env.get("EMAIL_REPLY_TO") ?? "";
  const appBaseUrl = (Deno.env.get("APP_BASE_URL") ?? "https://deckly.space").replace(/\/+$/, "");

  if (!resendApiKey || !fromAddress) {
    console.error("[send-interest-signal-email] Missing RESEND_API_KEY or EMAIL_FROM");
    return jsonResponse({ error: "Email provider is not configured" }, 500);
  }

  let payload: DatabaseWebhookPayload;
  try {
    payload = await request.json() as DatabaseWebhookPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const eventId = payload.record?.id;
  if (!eventId || payload.table !== "interest_signal_email_events") {
    return jsonResponse({ error: "Invalid database webhook payload" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: event, error: fetchError } = await admin
    .from("interest_signal_email_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle<InterestSignalEmailEvent>();

  if (fetchError) {
    console.error("[send-interest-signal-email] Failed to load event:", fetchError.message);
    return jsonResponse({ error: "Failed to load email event" }, 500);
  }

  if (!event) return jsonResponse({ skipped: true, reason: "Event not found" });
  if (event.status === "sent") return jsonResponse({ skipped: true, reason: "Already sent" });
  if (event.attempt_count >= MAX_ATTEMPTS) {
    return jsonResponse({ skipped: true, reason: "Maximum attempts reached" });
  }

  // Recover events left in `sending` if a function invocation was interrupted
  // after claiming the row but before it could record the Resend result.
  const leaseExpired =
    event.status === "sending" &&
    !!event.last_attempt_at &&
    Date.parse(event.last_attempt_at) < Date.now() - 10 * 60 * 1000;
  if (event.status === "sending" && !leaseExpired) {
    return jsonResponse({ skipped: true, reason: "Already processing" });
  }
  if (leaseExpired) {
    await admin
      .from("interest_signal_email_events")
      .update({
        status: "failed",
        last_error: "Previous email attempt timed out",
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.id)
      .eq("status", "sending");
  }

  const now = new Date().toISOString();
  const { data: claimedEvent, error: claimError } = await admin
    .from("interest_signal_email_events")
    .update({
      status: "sending",
      attempt_count: event.attempt_count + 1,
      last_attempt_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq("id", event.id)
    .in("status", ["pending", "failed"])
    .lt("attempt_count", MAX_ATTEMPTS)
    .select("*")
    .maybeSingle<InterestSignalEmailEvent>();

  if (claimError) {
    console.error("[send-interest-signal-email] Failed to claim event:", claimError.message);
    return jsonResponse({ error: "Failed to claim email event" }, 500);
  }

  // Another webhook delivery may already be processing this event.
  if (!claimedEvent) return jsonResponse({ skipped: true, reason: "Already claimed" });

  const viewerLabel = claimedEvent.viewer_email || "An identified viewer";
  const analyticsUrl = `${appBaseUrl}/analytics/${encodeURIComponent(claimedEvent.deck_id)}`;
  const subject = `New interest signal: ${cleanHeaderText(claimedEvent.deck_title)}`;
  const safeDeckTitle = escapeHtml(claimedEvent.deck_title);
  const safeSignal = escapeHtml(claimedEvent.signal_label);
  const safeViewer = escapeHtml(viewerLabel);
  const safeAnalyticsUrl = escapeHtml(analyticsUrl);
  const metrics = `${claimedEvent.total_visits} slide views · ${formatSeconds(claimedEvent.total_time_seconds)} total viewing · ${claimedEvent.distinct_days} day${claimedEvent.distinct_days === 1 ? "" : "s"}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033;max-width:600px">
      <h2 style="margin:0 0 16px">New investor interest signal</h2>
      <p style="margin:0 0 16px">A viewer has triggered a new signal on <strong>${safeDeckTitle}</strong>.</p>
      <div style="border:1px solid #dbe3ee;border-radius:10px;padding:16px;margin:0 0 20px">
        <p style="margin:0 0 8px"><strong>Signal:</strong> ${safeSignal}</p>
        <p style="margin:0 0 8px"><strong>Viewer:</strong> ${safeViewer}</p>
        <p style="margin:0;color:#526173">${escapeHtml(metrics)}</p>
      </div>
      <a href="${safeAnalyticsUrl}" style="display:inline-block;background:#22c55e;color:#07130a;text-decoration:none;padding:10px 16px;border-radius:7px;font-weight:700">Open analytics</a>
    </div>
  `;
  const text = [
    "New investor interest signal",
    "",
    `Deck: ${claimedEvent.deck_title}`,
    `Signal: ${claimedEvent.signal_label}`,
    `Viewer: ${viewerLabel}`,
    `Activity: ${metrics}`,
    "",
    `Open analytics: ${analyticsUrl}`,
  ].join("\n");

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [claimedEvent.recipient_email],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    const resendBody = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      const message = getErrorMessage(resendBody) || `Resend returned ${resendResponse.status}`;
      const { error: markFailedError } = await admin
        .from("interest_signal_email_events")
        .update({ status: "failed", last_error: message, updated_at: new Date().toISOString() })
        .eq("id", event.id);
      if (markFailedError) console.error("[send-interest-signal-email] Failed to persist error:", markFailedError.message);
      console.error("[send-interest-signal-email] Resend failed:", message);
      return jsonResponse({ error: "Email delivery failed", detail: message }, 502);
    }

    const resendMessageId =
      resendBody && typeof resendBody === "object" && "id" in resendBody
        ? (resendBody as { id?: unknown }).id
        : null;

    const { error: markSentError } = await admin
      .from("interest_signal_email_events")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_message_id: typeof resendMessageId === "string" ? resendMessageId : null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.id);
    if (markSentError) {
      console.error("[send-interest-signal-email] Failed to mark event sent:", markSentError.message);
      return jsonResponse({ error: "Email status update failed" }, 500);
    }

    return jsonResponse({ sent: true, event_id: event.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin
      .from("interest_signal_email_events")
      .update({ status: "failed", last_error: message, updated_at: new Date().toISOString() })
      .eq("id", event.id);
    console.error("[send-interest-signal-email] Unexpected error:", message);
    return jsonResponse({ error: "Email delivery failed" }, 502);
  }
});
