import { createClient } from "@supabase/supabase-js";
import { corsPreflight, json, requireUser } from "../_shared/billing.ts";
import {
  CLOUDCONVERT_IO_URL_TTL_SECONDS,
  CloudConvertError,
  deleteCloudConvertJob,
  findCloudConvertJobsByTag,
} from "../_shared/cloudconvert.ts";
import { copyObject, deleteObject, deleteObjects, headObject, listAllObjects, presignPutUrl } from "../_shared/r2.ts";
import { ACTIVE_DOCUMENT_PROCESSING_STATUSES } from "../_shared/document-processing.ts";
import { mapWithConcurrency } from "../_shared/concurrency.ts";

const OFFICE_FORMATS = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx"]);
const TERMINAL_STATUSES = new Set(["failed", "cancelled", "timed_out"]);
const CLIENT_ERROR_MESSAGES = new Set([
  "Processing job not found",
  "A supported Office file and size are required.",
  "Watermark text is required.",
  "A title and slug are required.",
  "Unable to prepare document processing.",
  "This upload is not awaiting completion.",
  "The uploaded document was not found.",
  "A pending PDF upload is required.",
  "The verified PDF was not found.",
  "Document exceeds the viewable document size limit.",
  "This document cannot be retried.",
  "The original upload has expired. Upload the document again.",
  "Watermark processing is not available yet.",
  "Watermark processing could not be queued.",
  "No document conversion is available to retry.",
  "Disable the watermark before cleanup.",
  "A processing job is required.",
  "A deck is required.",
]);

type RequestBody = Record<string, unknown>;

function isClientErrorMessage(message: string): boolean {
  return CLIENT_ERROR_MESSAGES.has(message) || /^Viewable documents are limited to \d+ pages\.$/.test(message);
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("PROJECT_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("Missing Supabase server configuration");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function stringValue(body: RequestBody, key: string, maxLength = 500): string | null {
  const value = body[key];
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength
    ? value.trim()
    : null;
}

function booleanValue(body: RequestBody, key: string, fallback = false) {
  return typeof body[key] === "boolean" ? body[key] : fallback;
}

function numberValue(body: RequestBody, key: string): number | null {
  const value = body[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function sanitiseStatus(job: Record<string, unknown>) {
  return {
    id: job.id,
    deck_id: job.deck_id,
    operation: job.operation,
    status: job.status,
    attempt_number: job.attempt_number,
    deadline_at: job.deadline_at,
    created_at: job.created_at,
    updated_at: job.updated_at,
    completed_at: job.completed_at,
    error_code: job.provider_error_code,
  };
}

async function getOwnedJob(admin: ReturnType<typeof adminClient>, userId: string, jobId: string) {
  const { data, error } = await admin.from("document_processing_jobs").select("*")
    .eq("id", jobId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Processing job not found");
  return data as Record<string, unknown>;
}

async function prepareOfficeUpload(admin: ReturnType<typeof adminClient>, userId: string, body: RequestBody) {
  const sourceFilename = stringValue(body, "sourceFilename", 240);
  const sourceFileType = stringValue(body, "sourceFileType", 10)?.toLowerCase();
  const sourceSizeBytes = numberValue(body, "sourceSizeBytes");
  const watermarkEnabled = booleanValue(body, "watermarkEnabled");
  const watermarkText = watermarkEnabled ? stringValue(body, "watermarkText", 80) : null;
  if (!sourceFilename || !sourceFileType || !OFFICE_FORMATS.has(sourceFileType) || !sourceSizeBytes) {
    throw new Error("A supported Office file and size are required.");
  }
  if (watermarkEnabled && !watermarkText) throw new Error("Watermark text is required.");

  const replacementDeckId = stringValue(body, "replacementDeckId", 80);
  const activeProviderJobs = replacementDeckId
    ? await admin.from("document_processing_jobs")
      .select("provider_job_id")
      .eq("deck_id", replacementDeckId)
      .eq("user_id", userId)
      .in("status", ACTIVE_DOCUMENT_PROCESSING_STATUSES)
    : { data: [], error: null };
  if (activeProviderJobs.error) throw activeProviderJobs.error;
  const rpcName = replacementDeckId ? "prepare_office_processing_replacement" : "prepare_office_processing_draft";
  const rpcArgs = replacementDeckId
    ? {
      p_user_id: userId,
      p_deck_id: replacementDeckId,
      p_source_filename: sourceFilename,
      p_source_file_type: sourceFileType,
      p_source_size_bytes: sourceSizeBytes,
      p_title: stringValue(body, "title", 160),
      p_description: typeof body.description === "string" ? body.description.slice(0, 2000) : null,
      p_require_email: booleanValue(body, "requireEmail"),
      p_require_password: booleanValue(body, "requirePassword"),
      p_view_password: typeof body.viewPassword === "string" ? body.viewPassword : null,
      p_expires_at: typeof body.expiresAt === "string" ? body.expiresAt : null,
      p_allow_download: booleanValue(body, "allowDownload"),
      p_watermark_enabled: watermarkEnabled,
      p_watermark_text: watermarkText,
    }
    : {
      p_user_id: userId,
      p_title: stringValue(body, "title", 160),
      p_slug: stringValue(body, "slug", 160),
      p_description: typeof body.description === "string" ? body.description.slice(0, 2000) : null,
      p_source_filename: sourceFilename,
      p_source_file_type: sourceFileType,
      p_source_size_bytes: sourceSizeBytes,
      p_require_email: booleanValue(body, "requireEmail"),
      p_require_password: booleanValue(body, "requirePassword"),
      p_view_password: typeof body.viewPassword === "string" ? body.viewPassword : null,
      p_expires_at: typeof body.expiresAt === "string" ? body.expiresAt : null,
      p_allow_download: booleanValue(body, "allowDownload"),
      p_watermark_enabled: watermarkEnabled,
      p_watermark_text: watermarkText,
    };
  if (!replacementDeckId && (!(rpcArgs as { p_title: string | null }).p_title || !(rpcArgs as { p_slug: string | null }).p_slug)) {
    throw new Error("A title and slug are required.");
  }
  const { data, error } = await admin.rpc(rpcName, rpcArgs);
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.job_id !== "string" || typeof result.source_path !== "string") {
    throw new Error("Unable to prepare document processing.");
  }
  await Promise.all((activeProviderJobs.data ?? []).map((job) =>
    typeof job.provider_job_id === "string"
      ? deleteCloudConvertJob(job.provider_job_id).catch(() => undefined)
      : Promise.resolve()
  ));
  return {
    jobId: result.job_id,
    deckId: typeof result.deck_id === "string" ? result.deck_id : replacementDeckId,
    sourcePath: result.source_path,
    uploadUrl: await presignPutUrl("decks", result.source_path, CLOUDCONVERT_IO_URL_TTL_SECONDS),
  };
}

async function completeUpload(admin: ReturnType<typeof adminClient>, userId: string, jobId: string) {
  const job = await getOwnedJob(admin, userId, jobId);
  if (job.status !== "awaiting_upload" || typeof job.source_path !== "string") {
    throw new Error("This upload is not awaiting completion.");
  }
  const object = await headObject("decks", job.source_path);
  if (!object || object.size <= 0) throw new Error("The uploaded document was not found.");
  const { data, error } = await admin.rpc("complete_document_processing_upload", {
    p_job_id: jobId,
    p_actual_size_bytes: object.size,
  });
  if (error) throw error;
  return sanitiseStatus((data ?? job) as Record<string, unknown>);
}

async function retryJob(admin: ReturnType<typeof adminClient>, userId: string, jobId: string) {
  const original = await getOwnedJob(admin, userId, jobId);
  if (!TERMINAL_STATUSES.has(String(original.status))) {
    throw new Error("This document cannot be retried.");
  }
  if (typeof original.source_path !== "string" || !(await headObject("decks", original.source_path))) {
    throw new Error("The original upload has expired. Upload the document again.");
  }
  const sourceFileType = typeof original.source_file_type === "string" ? original.source_file_type : null;
  if (!sourceFileType) throw new Error("The original upload has expired. Upload the document again.");
  const retryJobId = crypto.randomUUID();
  const retrySourcePath = `${userId}/processing/${retryJobId}/source.${sourceFileType}`;

  await copyObject("decks", original.source_path, retrySourcePath);
  try {
    const { data, error } = await admin.rpc("retry_document_processing_job", {
      p_user_id: userId,
      p_job_id: jobId,
      p_new_job_id: retryJobId,
    });
    if (error) throw error;
    return sanitiseStatus(data as Record<string, unknown>);
  } catch (error) {
    await deleteObject("decks", retrySourcePath).catch(() => undefined);
    throw error;
  }
}

async function retryLatestWatermark(admin: ReturnType<typeof adminClient>, userId: string, deckId: string) {
  const { data, error } = await admin.from("document_processing_jobs")
    .select("id")
    .eq("deck_id", deckId)
    .eq("user_id", userId)
    .eq("operation", "watermark_publish")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    const { data: queued, error: queueError } = await admin.rpc("queue_deck_watermark_processing_job", {
      p_deck_id: deckId,
      p_user_id: userId,
    });
    if (queueError) throw queueError;
    if (!queued) {
      const { data: deck, error: deckError } = await admin.from("decks")
        .select("watermark_error")
        .eq("id", deckId).eq("user_id", userId).maybeSingle();
      if (deckError) throw deckError;
      throw new Error(deck?.watermark_error || "Watermark processing is not available yet.");
    }
    const { data: queuedJob, error: queuedJobError } = await admin.from("document_processing_jobs")
      .select("*")
      .eq("deck_id", deckId).eq("user_id", userId).eq("operation", "watermark_publish")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (queuedJobError) throw queuedJobError;
    if (!queuedJob) throw new Error("Watermark processing could not be queued.");
    return sanitiseStatus(queuedJob as Record<string, unknown>);
  }
  return retryJob(admin, userId, data.id);
}

async function retryLatestOfficeJob(admin: ReturnType<typeof adminClient>, userId: string, deckId: string) {
  const { data, error } = await admin.from("document_processing_jobs")
    .select("id")
    .eq("deck_id", deckId)
    .eq("user_id", userId)
    .eq("operation", "office_publish")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("No document conversion is available to retry.");
  return retryJob(admin, userId, data.id);
}

async function cleanupDisabledWatermark(admin: ReturnType<typeof adminClient>, userId: string, deckId: string) {
  const { data: deck, error } = await admin.from("decks")
    .select("id, watermark_enabled")
    .eq("id", deckId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!deck || deck.watermark_enabled) throw new Error("Disable the watermark before cleanup.");
  const { data: jobs, error: jobsError } = await admin.from("document_processing_jobs")
    .select("id, provider_job_id")
    .eq("deck_id", deckId).eq("user_id", userId).eq("operation", "watermark_publish")
    .in("status", ACTIVE_DOCUMENT_PROCESSING_STATUSES);
  if (jobsError) throw jobsError;
  const { error: cancelError } = await admin.from("document_processing_jobs")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
      cleanup_after: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    .eq("deck_id", deckId).eq("user_id", userId).eq("operation", "watermark_publish")
    .in("status", ACTIVE_DOCUMENT_PROCESSING_STATUSES);
  if (cancelError) throw cancelError;
  await cancelProviderJobs(jobs ?? []);
  const prefix = `${userId}/watermarks/${deckId}/`;
  const artifacts = await listAllObjects("decks", prefix);
  await deleteObjects("decks", artifacts.map((artifact) => artifact.name).filter((path) => path.startsWith(prefix)));
  return { cleaned: true };
}

type CancellableJob = { id: string; provider_job_id: string | null };

async function cancelProviderJobs(
  jobs: CancellableJob[],
  options: { bestEffort?: boolean } = {},
) {
  const bestEffort = options.bestEffort ?? false;
  const providerJobIds = new Set<string>();
  const jobsMissingProviderId = jobs.filter((job) => {
    if (job.provider_job_id) {
      providerJobIds.add(job.provider_job_id);
      return false;
    }
    return true;
  });
  const taggedJobGroups = await mapWithConcurrency(
    jobsMissingProviderId,
    5,
    async (job) => {
      try {
        return await findCloudConvertJobsByTag(`deckly-processing:${job.id}`);
      } catch (error) {
        if (!bestEffort) throw error;
        console.error("Provider tag lookup failed during deck deletion", {
          jobId: job.id,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        return [];
      }
    },
  );
  taggedJobGroups.flat().forEach((providerJob) => providerJobIds.add(providerJob.id));
  for (const providerJobId of providerJobIds) {
    try {
      await deleteCloudConvertJob(providerJobId);
    } catch (error) {
      if (error instanceof CloudConvertError && error.status === 404) continue;
      if (!bestEffort) throw error;
      console.error("Provider cancellation failed during deck deletion", {
        providerJobId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

async function deleteOwnedDeckArtifacts(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  deckId: string,
  jobs: CancellableJob[],
) {
  const { data: deck, error: deckError } = await admin.from("decks")
    .select("id, slug, file_url")
    .eq("id", deckId)
    .eq("user_id", userId)
    .maybeSingle();
  if (deckError) throw deckError;
  if (!deck) throw new Error("Deck not found");

  const safeSlug = typeof deck.slug === "string"
    ? deck.slug.replace(/[^a-z0-9-]/gi, "_")
    : "";
  const prefixes = [
    `${userId}/watermarks/${deckId}/`,
    `${userId}/decks/${deckId}/`,
    ...(safeSlug ? [`${userId}/deck-images/${safeSlug}/`] : []),
    ...jobs.map((job) => `${userId}/processing/${job.id}/`),
  ];
  const artifactGroups = await Promise.all(
    prefixes.map((prefix) => listAllObjects("decks", prefix)),
  );
  const artifactPaths = new Set(
    artifactGroups.flatMap((artifacts, index) =>
      artifacts.map((artifact) => artifact.name).filter((path) => path.startsWith(prefixes[index]))
    ),
  );
  if (
    typeof deck.file_url === "string"
    && deck.file_url.startsWith(`${userId}/`)
    && !/^https?:\/\//i.test(deck.file_url)
  ) {
    artifactPaths.add(deck.file_url);
  }
  await deleteObjects("decks", [...artifactPaths]);
  return artifactPaths.size;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const user = await requireUser(req);
    const parsed: unknown = await req.json();
    const body = parsed && typeof parsed === "object" ? parsed as RequestBody : {};
    const action = stringValue(body, "action", 40);
    const admin = adminClient();

    if (action === "prepare-office-upload") return json(await prepareOfficeUpload(admin, user.id, body));
    if (action === "complete-upload") {
      const jobId = stringValue(body, "jobId", 80);
      if (!jobId) throw new Error("A processing job is required.");
      return json(await completeUpload(admin, user.id, jobId));
    }
    if (action === "status") {
      const jobId = stringValue(body, "jobId", 80);
      if (!jobId) throw new Error("A processing job is required.");
      return json(sanitiseStatus(await getOwnedJob(admin, user.id, jobId)));
    }
    if (action === "retry") {
      const jobId = stringValue(body, "jobId", 80);
      if (!jobId) throw new Error("A processing job is required.");
      return json(await retryJob(admin, user.id, jobId));
    }
    if (action === "retry-watermark") {
      const deckId = stringValue(body, "deckId", 80);
      if (!deckId) throw new Error("A deck is required.");
      return json(await retryLatestWatermark(admin, user.id, deckId));
    }
    if (action === "retry-office") {
      const deckId = stringValue(body, "deckId", 80);
      if (!deckId) throw new Error("A deck is required.");
      return json(await retryLatestOfficeJob(admin, user.id, deckId));
    }
    if (action === "cleanup-watermark") {
      const deckId = stringValue(body, "deckId", 80);
      if (!deckId) throw new Error("A deck is required.");
      return json(await cleanupDisabledWatermark(admin, user.id, deckId));
    }
    if (action === "delete-deck-artifacts") {
      const deckId = stringValue(body, "deckId", 80);
      if (!deckId) throw new Error("A deck is required.");
      const { data: jobs, error } = await admin.from("document_processing_jobs")
        .select("id, provider_job_id")
        .eq("deck_id", deckId).eq("user_id", user.id)
        .in("status", ACTIVE_DOCUMENT_PROCESSING_STATUSES);
      if (error) throw error;
      const { error: cancelError } = await admin.from("document_processing_jobs")
        .update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
          cleanup_after: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .eq("deck_id", deckId).eq("user_id", user.id)
        .in("status", ACTIVE_DOCUMENT_PROCESSING_STATUSES);
      if (cancelError) throw cancelError;
      await cancelProviderJobs(
        (jobs ?? []) as CancellableJob[],
        { bestEffort: true },
      );
      const artifactsDeleted = await deleteOwnedDeckArtifacts(
        admin,
        user.id,
        deckId,
        (jobs ?? []) as CancellableJob[],
      );
      return json({ cancelled: jobs?.length ?? 0, artifactsDeleted });
    }
    if (action === "cancel") {
      const jobId = stringValue(body, "jobId", 80);
      if (!jobId) throw new Error("A processing job is required.");
      const job = await getOwnedJob(admin, user.id, jobId);
      if (
        typeof job.status !== "string"
        || !ACTIVE_DOCUMENT_PROCESSING_STATUSES.includes(job.status)
      ) {
        return json({ cancelled: false });
      }
      const { error } = await admin.from("document_processing_jobs")
        .update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
          // A cancelled draft remains retryable until its normal source-retention window expires.
          cleanup_after: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", jobId)
        .in("status", ACTIVE_DOCUMENT_PROCESSING_STATUSES);
      if (error) throw error;
      await cancelProviderJobs([job as CancellableJob]);
      return json({ cancelled: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("Document processing request failed", error);
    if (message === "Unauthorized") return json({ error: message }, 401);
    if (isClientErrorMessage(message)) return json({ error: message }, 400);
    return json({ error: "Document processing is temporarily unavailable. Please try again." }, 500);
  }
});
