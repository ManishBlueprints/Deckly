import { createClient } from "@supabase/supabase-js";
import { hmacHex, timingSafeEqual } from "../_shared/billing.ts";
import { providerTaskCredits, type CloudConvertJob } from "../_shared/cloudconvert.ts";

type WebhookPayload = { event?: string; job?: CloudConvertJob };

function response(status = 204) {
  return new Response(null, { status });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("PROJECT_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("Missing Supabase server configuration");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function hasValidSignature(body: string, provided: string | null) {
  if (!provided) return false;
  const current = Deno.env.get("CLOUDCONVERT_WEBHOOK_SECRET")?.trim();
  const previous = Deno.env.get("CLOUDCONVERT_WEBHOOK_PREVIOUS_SECRET")?.trim();
  for (const secret of [current, previous]) {
    if (!secret) continue;
    if (timingSafeEqual(await hmacHex(secret, body), provided.trim())) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return response(405);
  const rawBody = await req.text();
  const signature = req.headers.get("CloudConvert-Signature") ?? req.headers.get("cloudconvert-signature");
  if (!(await hasValidSignature(rawBody, signature))) return response(401);
  const payload = JSON.parse(rawBody) as WebhookPayload;
  const providerJob = payload.job;
  if (!providerJob?.id || !["job.finished", "job.failed"].includes(payload.event ?? "")) return response();

  try {
    const admin = adminClient();
    if (payload.event === "job.finished") {
      const { error } = await admin.from("document_processing_jobs")
        .update({ status: "validating", provider_task_credits: providerTaskCredits(providerJob) })
        .eq("provider_job_id", providerJob.id)
        .in("status", ["submitting", "processing"]);
      if (error) throw error;
    } else {
      const { error } = await admin.from("document_processing_jobs")
        .update({
          status: "failed",
          provider_error_code: "provider_failed",
          provider_error_detail: "CloudConvert could not complete this document.",
          completed_at: new Date().toISOString(),
          cleanup_after: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("provider_job_id", providerJob.id)
        .in("status", ["submitting", "processing", "validating"]);
      if (error) throw error;
    }
    // Do not log payload: it may contain signed R2 URLs and watermark text.
    return response();
  } catch (error) {
    console.error("CloudConvert webhook state update failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return response(500);
  }
});
