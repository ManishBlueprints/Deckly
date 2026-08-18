import { createClient } from "@supabase/supabase-js";
import { deleteCloudConvertJob, findCloudConvertJobsByTag } from "../_shared/cloudconvert.ts";
import { deleteObject, deleteObjects, listAllObjects } from "../_shared/r2.ts";
import { timingSafeEqual } from "../_shared/billing.ts";

const BATCH_SIZE = 50;

type Job = {
  id: string;
  deck_id: string;
  user_id: string;
  operation: "office_publish" | "watermark_publish";
  status: string;
  source_path: string | null;
  previous_file_url: string | null;
  previous_thumbnail_url: string | null;
  previous_watermarked_file_path: string | null;
  provider_job_id: string | null;
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

function isStorageKey(value: string | null): value is string {
  return !!value && !/^https?:\/\//i.test(value);
}

async function deleteProcessingPrefix(job: Job) {
  const prefix = `${job.user_id}/processing/${job.id}/`;
  const objects = await listAllObjects("decks", prefix);
  await deleteObjects("decks", objects.map((object) => object.name).filter((path) => path.startsWith(prefix)));
}

async function cleanupJob(admin: ReturnType<typeof adminClient>, job: Job) {
  const { data: deck } = await admin.from("decks")
    .select("id, status, file_url, thumbnail_url, watermarked_file_path")
    .eq("id", job.deck_id).maybeSingle();

  if (job.status === "completed" && deck) {
    // Old replacement artifacts are deleted only after the new bundle is
    // published and confirmed as the live source.
    const candidates = [
      [job.previous_file_url, deck.file_url],
      [job.previous_thumbnail_url, deck.thumbnail_url],
      [job.previous_watermarked_file_path, deck.watermarked_file_path],
    ] as const;
    for (const [oldPath, currentPath] of candidates) {
      if (isStorageKey(oldPath) && oldPath !== currentPath) {
        await deleteObject("decks", oldPath).catch(() => undefined);
      }
    }
  }

  if (job.status !== "completed" && deck?.status === "PENDING" && deck.file_url === job.source_path) {
    // A new failed draft is owner-visible and retryable for seven days. Once
    // its retention window ends, make it non-counting/non-shareable.
    await admin.from("decks").update({ status: "DELETED" }).eq("id", job.deck_id).eq("status", "PENDING");
  }

  await deleteProcessingPrefix(job);
  const providerJobIds = new Set<string>();
  if (job.provider_job_id) providerJobIds.add(job.provider_job_id);
  if (job.status === "superseded") {
    const taggedJobs = await findCloudConvertJobsByTag(`deckly-processing:${job.id}`).catch(() => []);
    taggedJobs.forEach((providerJob) => providerJobIds.add(providerJob.id));
  }
  await Promise.all([...providerJobIds].map((providerJobId) =>
    deleteCloudConvertJob(providerJobId).catch(() => undefined)
  ));
  await admin.from("document_processing_jobs")
    .update({ cleanup_after: null })
    .eq("id", job.id);
}

async function cleanupExpiredDirectPdfVerifications(admin: ReturnType<typeof adminClient>) {
  const { data, error } = await admin.from("direct_pdf_verifications")
    .select("user_id, storage_path")
    .lte("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) throw error;

  let cleaned = 0;
  for (const verification of data ?? []) {
    const { data: liveDeck, error: deckError } = await admin.from("decks")
      .select("id")
      .eq("user_id", verification.user_id)
      .eq("file_url", verification.storage_path)
      .neq("status", "DELETED")
      .maybeSingle();
    if (deckError) throw deckError;
    if (!liveDeck) {
      await deleteObject("decks", verification.storage_path).catch(() => undefined);
    }
    const { error: deleteError } = await admin.from("direct_pdf_verifications")
      .delete()
      .eq("user_id", verification.user_id)
      .eq("storage_path", verification.storage_path);
    if (deleteError) throw deleteError;
    cleaned += 1;
  }
  return { cleaned, hasMore: (data?.length ?? 0) === BATCH_SIZE };
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
      .in("status", ["completed", "failed", "cancelled", "superseded", "timed_out"])
      .not("cleanup_after", "is", null)
      .lte("cleanup_after", new Date().toISOString())
      .order("cleanup_after", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;
    let cleaned = 0;
    for (const job of (data ?? []) as Job[]) {
      try {
        await cleanupJob(admin, job);
        cleaned += 1;
      } catch (error) {
        console.error("Document processing cleanup failed", {
          jobId: job.id,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    const directPdfCleanup = await cleanupExpiredDirectPdfVerifications(admin);
    return json({
      cleaned: cleaned + directPdfCleanup.cleaned,
      has_more: (data?.length ?? 0) === BATCH_SIZE || directPdfCleanup.hasMore,
    });
  } catch (error) {
    console.error("Document processing cleanup failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Document processing cleanup failed" }, 500);
  }
});
