import { createClient } from "@supabase/supabase-js";
import {
  CLOUDCONVERT_IO_URL_TTL_SECONDS,
  CloudConvertError,
  createOfficeConversionJob,
  createWatermarkJob,
  deleteCloudConvertJob,
} from "../_shared/cloudconvert.ts";
import { presignGetUrl, presignPutUrl } from "../_shared/r2.ts";
import { timingSafeEqual } from "../_shared/billing.ts";

const BATCH_SIZE = 10;
const ACTIVE_STATUSES = ["submitting", "processing"];
const OFFICE_FORMATS = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx"]);

type ProcessingJob = {
  id: string;
  user_id: string;
  operation: "office_publish" | "watermark_publish";
  source_path: string | null;
  source_filename: string | null;
  source_file_type: string | null;
  requested_watermark_enabled: boolean;
  requested_watermark_text: string | null;
  deadline_at: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("PROJECT_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("Missing Supabase server configuration");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function processingPrefix(job: ProcessingJob) {
  return `${job.user_id}/processing/${job.id}`;
}

async function submitJob(job: ProcessingJob) {
  if (!job.source_path || !job.deadline_at || new Date(job.deadline_at) <= new Date()) {
    throw new CloudConvertError("The processing source is unavailable.", 422, "invalid_source");
  }
  const sourceUrl = await presignGetUrl("decks", job.source_path, CLOUDCONVERT_IO_URL_TTL_SECONDS);
  const prefix = processingPrefix(job);
  const tag = `deckly-processing:${job.id}`;

  if (job.operation === "office_publish") {
    const sourceFormat = job.source_file_type?.toLowerCase();
    if (!sourceFormat || !OFFICE_FORMATS.has(sourceFormat)) {
      throw new CloudConvertError("The document format is not supported.", 422, "unsupported_format");
    }
    const watermark = job.requested_watermark_enabled
      ? {
        text: job.requested_watermark_text?.trim() ?? "",
        outputUrl: await presignPutUrl("decks", `${prefix}/watermark.pdf`, CLOUDCONVERT_IO_URL_TTL_SECONDS),
      }
      : undefined;
    if (watermark && !watermark.text) {
      throw new CloudConvertError("Watermark text is required.", 422, "invalid_watermark");
    }
    return createOfficeConversionJob({
      tag,
      sourceUrl,
      sourceFilename: job.source_filename || `document.${sourceFormat}`,
      sourceFormat: sourceFormat as "doc" | "docx" | "ppt" | "pptx" | "xls" | "xlsx",
      outputPdfUrl: await presignPutUrl("decks", `${prefix}/document.pdf`, CLOUDCONVERT_IO_URL_TTL_SECONDS),
      outputThumbnailUrl: await presignPutUrl("decks", `${prefix}/thumbnail.webp`, CLOUDCONVERT_IO_URL_TTL_SECONDS),
      watermark,
    });
  }

  if (!job.requested_watermark_enabled || !job.requested_watermark_text?.trim()) {
    throw new CloudConvertError("Watermark text is required.", 422, "invalid_watermark");
  }
  return createWatermarkJob({
    tag,
    sourceUrl,
    outputUrl: await presignPutUrl("decks", `${prefix}/watermark.pdf`, CLOUDCONVERT_IO_URL_TTL_SECONDS),
    text: job.requested_watermark_text.trim(),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const expectedSecret = Deno.env.get("CRON_SECRET")?.trim() ?? "";
  const suppliedSecret = req.headers.get("x-cron-secret")?.trim() ?? "";
  if (!expectedSecret || !suppliedSecret || !timingSafeEqual(suppliedSecret, expectedSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const admin = adminClient();
    const { data, error } = await admin.rpc("claim_document_processing_jobs", { p_limit: BATCH_SIZE });
    if (error) throw error;

    let submitted = 0;
    let failed = 0;
    let uncertain = 0;
    for (const job of (data ?? []) as ProcessingJob[]) {
      try {
        const providerJob = await submitJob(job);
        const { data: accepted, error: acceptedError } = await admin.rpc("mark_document_processing_submitted", {
          p_job_id: job.id,
          p_provider_job_id: providerJob.id,
        });
        if (acceptedError) throw acceptedError;
        if (accepted) {
          submitted += 1;
        } else {
          // A cancellation/supersession won the race after CloudConvert had
          // accepted the job.  Delete it promptly so it cannot incur more work.
          await deleteCloudConvertJob(providerJob.id).catch(() => undefined);
        }
      } catch (error) {
        const isAmbiguousProviderFailure = error instanceof CloudConvertError && (
          error.code === "request_timeout"
          || [408, 425, 502, 503, 504].includes(error.status)
        );
        if (error instanceof CloudConvertError && !isAmbiguousProviderFailure) {
          failed += 1;
          await admin.from("document_processing_jobs")
            .update({
              status: "failed",
              provider_error_code: error.code ?? `http_${error.status}`,
              provider_error_detail: error.message.slice(0, 500),
              completed_at: new Date().toISOString(),
              cleanup_after: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("id", job.id)
            .in("status", ACTIVE_STATUSES);
        } else {
          uncertain += 1;
          // A transport failure may have happened after POST reached the
          // provider.  Reconciliation searches the immutable tag instead of
          // issuing a potentially duplicate paid job.
          await admin.rpc("mark_document_processing_submission_uncertain", { p_job_id: job.id });
        }
      }
    }
    return json({ submitted, failed, uncertain, has_more: (data?.length ?? 0) === BATCH_SIZE });
  } catch (error) {
    console.error("Document processing dispatch failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Document processing dispatch failed" }, 500);
  }
});
