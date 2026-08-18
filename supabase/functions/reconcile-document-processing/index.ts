import { createClient } from "@supabase/supabase-js";
import {
  deleteCloudConvertJob,
  findCloudConvertJobsByTag,
  getCloudConvertJob,
  providerTaskCredits,
  type CloudConvertJob,
} from "../_shared/cloudconvert.ts";
import { copyObject, deleteObject, headObject, readObjectRange } from "../_shared/r2.ts";
import { timingSafeEqual } from "../_shared/billing.ts";
import { ACTIVE_DOCUMENT_PROCESSING_STATUSES } from "../_shared/document-processing.ts";

const BATCH_SIZE = 20;
const SUBMISSION_GRACE_MS = 5 * 60 * 1000;
const PUBLISH_LEASE_MS = 5 * 60 * 1000;
const PUBLISH_LEASE_RENEWAL_MS = Math.floor(PUBLISH_LEASE_MS / 3);

type ProcessingJob = {
  id: string;
  deck_id: string;
  user_id: string;
  operation: "office_publish" | "watermark_publish";
  status: string;
  source_content_revision: string;
  watermark_revision: string | null;
  requested_watermark_enabled: boolean;
  provider_job_id: string | null;
  submission_uncertain_at: string | null;
  publish_claim_token: string | null;
  deadline_at: string;
  updated_at: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("PROJECT_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("Missing Supabase server configuration");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const jobTag = (job: ProcessingJob) => `deckly-processing:${job.id}`;
const processingPrefix = (job: ProcessingJob) => `${job.user_id}/processing/${job.id}`;
const canonicalPrefix = (job: ProcessingJob) => `${job.user_id}/decks/${job.deck_id}/revisions/${job.source_content_revision}`;

function task(job: CloudConvertJob, name: string) {
  return job.tasks.find((candidate) => candidate.name === name) ?? null;
}

function asPageCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function extractPageCount(providerJob: CloudConvertJob): number | null {
  const result = task(providerJob, "read-metadata")?.result;
  if (!result) return null;
  const queue: unknown[] = [result];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    for (const [key, value] of Object.entries(current)) {
      if (key.replace(/[_-]/g, "").toLowerCase() === "pagecount") {
        const pageCount = asPageCount(value);
        if (pageCount !== null) return pageCount;
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return null;
}

function engineDetails(providerJob: CloudConvertJob) {
  const conversionTask = task(providerJob, "convert-pdf") ?? task(providerJob, "apply-watermark");
  return { engine: conversionTask?.engine ?? null, engineVersion: conversionTask?.engine_version ?? null };
}

function hasPdfSignature(bytes: Uint8Array | null) {
  return !!bytes && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}

function hasWebpSignature(bytes: Uint8Array | null) {
  return !!bytes && bytes.length >= 12
    && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF"
    && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
}

class PublishingLeaseLostError extends Error {
  constructor() {
    super("Publishing lease was lost.");
  }
}

async function failJob(
  admin: ReturnType<typeof adminClient>,
  job: ProcessingJob,
  code: string,
  detail: string,
  publishClaimToken?: string,
) {
  let query = admin.from("document_processing_jobs")
    .update({
      status: "failed",
      provider_error_code: code,
      provider_error_detail: detail.slice(0, 500),
      completed_at: new Date().toISOString(),
      cleanup_after: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", job.id)
    .in("status", ["submitting", "processing", "validating", "publishing"]);
  if (publishClaimToken) query = query.eq("publish_claim_token", publishClaimToken);
  const { error } = await query;
  if (error) throw error;
}

async function resolveUncertainSubmission(admin: ReturnType<typeof adminClient>, job: ProcessingJob) {
  if (!job.submission_uncertain_at) return false;
  const candidates = await findCloudConvertJobsByTag(jobTag(job));
  if (candidates.length === 1) {
    await admin.from("document_processing_jobs")
      .update({ status: "processing", provider_job_id: candidates[0].id, submission_uncertain_at: null })
      .eq("id", job.id)
      .eq("status", "submitting")
      .is("provider_job_id", null);
    return true;
  }
  if (candidates.length > 1) {
    await Promise.all(candidates.slice(1).map((candidate) => deleteCloudConvertJob(candidate.id).catch(() => undefined)));
    await admin.from("document_processing_jobs")
      .update({ status: "processing", provider_job_id: candidates[0].id, submission_uncertain_at: null })
      .eq("id", job.id)
      .eq("status", "submitting")
      .is("provider_job_id", null);
    return true;
  }
  if (Date.now() - new Date(job.submission_uncertain_at).getTime() >= SUBMISSION_GRACE_MS) {
    await failJob(admin, job, "submission_not_found", "CloudConvert did not confirm the submitted job.");
  }
  return false;
}

async function cancelSupersededProviderJob(job: ProcessingJob) {
  const providerJobIds = new Set<string>();
  if (job.provider_job_id) providerJobIds.add(job.provider_job_id);
  const taggedJobs = await findCloudConvertJobsByTag(jobTag(job));
  taggedJobs.forEach((providerJob) => providerJobIds.add(providerJob.id));
  await Promise.all([...providerJobIds].map((providerJobId) =>
    deleteCloudConvertJob(providerJobId).catch(() => undefined)
  ));
}

async function claimForPublish(admin: ReturnType<typeof adminClient>, job: ProcessingJob): Promise<ProcessingJob | null> {
  const staleBefore = new Date(Date.now() - PUBLISH_LEASE_MS).toISOString();
  const claimToken = crypto.randomUUID();
  const query = admin.from("document_processing_jobs")
    .update({ status: "publishing", publish_claim_token: claimToken })
    .eq("id", job.id);
  const claimedQuery = job.status === "validating"
    ? query.eq("status", "validating")
    : query.eq("status", "publishing").lt("updated_at", staleBefore);
  const { data, error } = await claimedQuery.select("*").maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const claimed = data as ProcessingJob;
  if (claimed.publish_claim_token !== claimToken) throw new PublishingLeaseLostError();
  return claimed;
}

function startPublishLeaseRenewal(
  admin: ReturnType<typeof adminClient>,
  job: ProcessingJob,
  claimToken: string,
) {
  let stopped = false;
  let failure: unknown = null;
  let pending = Promise.resolve();

  const renew = () => {
    if (stopped || failure) return;
    pending = pending.then(async () => {
      const { data, error } = await admin.from("document_processing_jobs")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("status", "publishing")
        .eq("publish_claim_token", claimToken)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new PublishingLeaseLostError();
    }).catch((error) => {
      failure = error;
    });
  };

  const interval = setInterval(renew, PUBLISH_LEASE_RENEWAL_MS);
  return {
    async stop() {
      stopped = true;
      clearInterval(interval);
      await pending;
      if (failure) throw failure;
    },
  };
}

async function validateAndPublish(admin: ReturnType<typeof adminClient>, job: ProcessingJob, providerJob: CloudConvertJob) {
  const claimed = await claimForPublish(admin, job);
  if (!claimed) return false;
  if (!claimed.publish_claim_token) throw new PublishingLeaseLostError();
  const publishLease = startPublishLeaseRenewal(admin, claimed, claimed.publish_claim_token);
  const prefix = processingPrefix(claimed);
  const documentStagePath = `${prefix}/document.pdf`;
  const thumbnailStagePath = `${prefix}/thumbnail.webp`;
  const watermarkStagePath = `${prefix}/watermark.pdf`;
  const canonical = canonicalPrefix(claimed);
  const documentPath = `${canonical}/document.pdf`;
  const thumbnailPath = `${canonical}/thumbnail.webp`;
  const watermarkPath = claimed.watermark_revision
    ? `${claimed.user_id}/watermarks/${claimed.deck_id}/${claimed.watermark_revision}.pdf`
    : null;
  const { engine, engineVersion } = engineDetails(providerJob);
  const credits = providerTaskCredits(providerJob);

  try {
    if (claimed.operation === "office_publish") {
      const [documentMetadata, thumbnailMetadata, documentBytes, thumbnailBytes] = await Promise.all([
        headObject("decks", documentStagePath),
        headObject("decks", thumbnailStagePath),
        readObjectRange("decks", documentStagePath, 15),
        readObjectRange("decks", thumbnailStagePath, 15),
      ]);
      const pageCount = extractPageCount(providerJob);
      if (!documentMetadata || !thumbnailMetadata || !hasPdfSignature(documentBytes) || !hasWebpSignature(thumbnailBytes)) {
        throw new Error("CloudConvert output did not contain a valid PDF and WebP thumbnail.");
      }
      if (!pageCount || pageCount > 500) throw new Error("The converted document exceeds the 500-page limit.");

      await copyObject("decks", documentStagePath, documentPath);
      await copyObject("decks", thumbnailStagePath, thumbnailPath);
      if (claimed.requested_watermark_enabled) {
        if (!watermarkPath) throw new Error("Watermark revision is unavailable.");
        const [watermarkMetadata, watermarkBytes] = await Promise.all([
          headObject("decks", watermarkStagePath),
          readObjectRange("decks", watermarkStagePath, 15),
        ]);
        if (!watermarkMetadata || !hasPdfSignature(watermarkBytes)) {
          throw new Error("CloudConvert output did not contain a valid watermark PDF.");
        }
        await copyObject("decks", watermarkStagePath, watermarkPath);
      }

      await publishLease.stop();
      const { data, error } = await admin.rpc("publish_document_processing_job", {
        p_job_id: claimed.id,
        p_publish_claim_token: claimed.publish_claim_token,
        p_document_path: documentPath,
        p_thumbnail_path: thumbnailPath,
        p_document_size_bytes: documentMetadata.size,
        p_page_count: pageCount,
        p_watermark_path: claimed.requested_watermark_enabled ? watermarkPath : null,
        p_provider_engine: engine,
        p_provider_engine_version: engineVersion,
        p_provider_task_credits: credits,
      });
      if (error) throw error;
      if (!data) throw new PublishingLeaseLostError();
    } else {
      if (!watermarkPath) throw new Error("Watermark revision is unavailable.");
      const [watermarkMetadata, watermarkBytes] = await Promise.all([
        headObject("decks", watermarkStagePath),
        readObjectRange("decks", watermarkStagePath, 15),
      ]);
      if (!watermarkMetadata || !hasPdfSignature(watermarkBytes)) {
        throw new Error("CloudConvert output did not contain a valid watermark PDF.");
      }
      await copyObject("decks", watermarkStagePath, watermarkPath);
      await publishLease.stop();
      const { data, error } = await admin.rpc("publish_watermark_processing_job", {
        p_job_id: claimed.id,
        p_publish_claim_token: claimed.publish_claim_token,
        p_watermark_path: watermarkPath,
        p_provider_engine: engine,
        p_provider_engine_version: engineVersion,
        p_provider_task_credits: credits,
      });
      if (error) throw error;
      if (!data) throw new PublishingLeaseLostError();
    }
    if (claimed.provider_job_id) await deleteCloudConvertJob(claimed.provider_job_id).catch(() => undefined);
    return true;
  } catch (error) {
    await publishLease.stop().catch(() => undefined);
    if (error instanceof PublishingLeaseLostError) return false;
    // Copies happen before the DB swap.  Remove only the immutable artifacts
    // from this attempt. A successful publish can race a lost response or
    // lease takeover, so never remove a path the live deck now references.
    const { data: liveDeck, error: liveDeckError } = await admin.from("decks")
      .select("file_url, thumbnail_url, watermarked_file_path")
      .eq("id", claimed.deck_id)
      .maybeSingle();
    if (liveDeckError) {
      console.error("Skipping publish artifact cleanup because the deck could not be read", {
        jobId: claimed.id,
        message: liveDeckError.message,
      });
    } else {
      const referencedPaths = new Set([
        liveDeck?.file_url,
        liveDeck?.thumbnail_url,
        liveDeck?.watermarked_file_path,
      ]);
      await Promise.all([
        documentPath,
        thumbnailPath,
        watermarkPath,
      ].filter((path): path is string => !!path && !referencedPaths.has(path))
        .map((path) => deleteObject("decks", path).catch(() => undefined)));
    }
    await failJob(
      admin,
      claimed,
      "validation_or_publish_failed",
      error instanceof Error ? error.message : "Output validation failed",
      claimed.publish_claim_token,
    );
    return false;
  }
}

async function reconcileJob(admin: ReturnType<typeof adminClient>, job: ProcessingJob) {
  if (job.status === "superseded") {
    await cancelSupersededProviderJob(job);
    return "superseded";
  }
  if (new Date(job.deadline_at) <= new Date()) {
    await admin.from("document_processing_jobs")
      .update({
        status: "timed_out",
        provider_error_code: "deadline_exceeded",
        provider_error_detail: "Processing exceeded the 60-minute limit.",
        completed_at: new Date().toISOString(),
        cleanup_after: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", job.id)
      .in("status", ACTIVE_DOCUMENT_PROCESSING_STATUSES);
    if (job.provider_job_id) await deleteCloudConvertJob(job.provider_job_id).catch(() => undefined);
    return "timed_out";
  }
  if (job.status === "submitting" && !job.provider_job_id) {
    await resolveUncertainSubmission(admin, job);
    return "reconciled";
  }
  if (!job.provider_job_id) return "waiting";

  const providerJob = await getCloudConvertJob(job.provider_job_id);
  if (providerJob.status === "finished") {
    if (job.status !== "validating" && job.status !== "publishing") {
      await admin.from("document_processing_jobs")
        .update({ status: "validating", provider_task_credits: providerTaskCredits(providerJob) })
        .eq("id", job.id)
        .in("status", ["submitting", "processing"]);
      job.status = "validating";
    }
    return await validateAndPublish(admin, job, providerJob) ? "published" : "failed";
  }
  if (["error", "cancelled"].includes(providerJob.status)) {
    await failJob(admin, job, `provider_${providerJob.status}`, "CloudConvert could not complete this document.");
    return "failed";
  }
  return "waiting";
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
    const { data, error } = await admin.from("document_processing_jobs")
      .select("*")
      .in("status", [...ACTIVE_DOCUMENT_PROCESSING_STATUSES, "superseded"])
      .order("updated_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;
    const outcomes: Record<string, number> = {};
    for (const job of (data ?? []) as ProcessingJob[]) {
      try {
        const outcome = await reconcileJob(admin, job);
        outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
      } catch (error) {
        // Network/R2/database failures are retryable. Preserve the job's
        // current state so the next scheduled reconciliation can try again.
        console.error("Document processing reconciliation will retry", {
          jobId: job.id,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        outcomes.retrying = (outcomes.retrying ?? 0) + 1;
      }
    }
    return json({ ...outcomes, has_more: (data?.length ?? 0) === BATCH_SIZE });
  } catch (error) {
    console.error("Document processing reconciliation failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Document processing reconciliation failed" }, 500);
  }
});
