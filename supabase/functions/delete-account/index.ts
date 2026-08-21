import { createClient } from "@supabase/supabase-js";
import { deleteObjects, listAllObjects } from "../_shared/r2.ts";
import { CloudConvertError, deleteCloudConvertJob, findCloudConvertJobsByTag } from "../_shared/cloudconvert.ts";
import { ACTIVE_DOCUMENT_PROCESSING_STATUSES } from "../_shared/document-processing.ts";
import { mapWithConcurrency } from "../_shared/concurrency.ts";

const PROVIDER_LOOKUP_CONCURRENCY = 5;

// delete-account Edge Function
// Verifies the caller's JWT, purges all storage objects, then deletes the
// auth.users row which cascades to profiles, branding, decks, data_rooms, etc.

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseSecretKey =
    Deno.env.get("PROJECT_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabasePublishableKey =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !supabaseSecretKey || !supabasePublishableKey) {
    return new Response(
      JSON.stringify({ error: "Missing server environment variables" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const accessToken = authHeader.replace("Bearer ", "").trim();

  const userClient = createClient(supabaseUrl, supabasePublishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = user.id;
  const adminClient = createClient(supabaseUrl, supabaseSecretKey);
  let deletionMarked = false;

  const clearDeletionPending = async () => {
    const { error } = await adminClient
      .rpc("clear_account_deletion_pending", { p_user_id: userId });
    if (error) throw error;
    deletionMarked = false;
  };

  const cancelDocumentProcessingJobs = async () => {
    const activeOrUncertainStatuses = [...ACTIVE_DOCUMENT_PROCESSING_STATUSES, "superseded", "cancelled", "timed_out"];
    const { data: jobs, error: jobsError } = await adminClient
      .from("document_processing_jobs")
      .select("id, provider_job_id")
      .eq("user_id", userId)
      .in("status", activeOrUncertainStatuses);
    if (jobsError) throw jobsError;

    const { error: cancelError } = await adminClient
      .from("document_processing_jobs")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("status", ACTIVE_DOCUMENT_PROCESSING_STATUSES);
    if (cancelError) throw cancelError;

    const providerJobIds = new Set<string>();
    const jobsMissingProviderId = (jobs ?? []).filter((job) => {
      if (typeof job.provider_job_id === "string") {
        providerJobIds.add(job.provider_job_id);
        return false;
      }
      return true;
    });
    const taggedJobGroups = await mapWithConcurrency(
      jobsMissingProviderId,
      PROVIDER_LOOKUP_CONCURRENCY,
      async (job) => {
        try {
          return await findCloudConvertJobsByTag(`deckly-processing:${job.id}`);
        } catch (error) {
          console.error("[delete-account] Provider tag lookup failed", {
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
        if (!(error instanceof CloudConvertError) || error.status !== 404) throw error;
      }
    }
  };

  try {
    const { data: deletionCanBegin, error: beginDeletionError } = await adminClient
      .rpc("begin_account_deletion", { p_user_id: userId });
    if (beginDeletionError) throw beginDeletionError;
    if (!deletionCanBegin) {
      return new Response(JSON.stringify({ error: "Cancel your active subscription before deleting your account." }), {
        status: 409, headers: { "Content-Type": "application/json" },
      });
    }
    deletionMarked = true;

    const { data: deletionCanComplete, error: confirmDeletionError } = await adminClient
      .rpc("confirm_account_deletion", { p_user_id: userId });
    if (confirmDeletionError) throw confirmDeletionError;
    if (!deletionCanComplete) {
      await clearDeletionPending();
      return new Response(JSON.stringify({ error: "A subscription change was detected. Cancel it before deleting your account." }), {
        status: 409, headers: { "Content-Type": "application/json" },
      });
    }

    // Cancel every active or ambiguous provider job before listing R2. A
    // CloudConvert job otherwise retains a valid presigned PUT URL and can
    // recreate an artifact after this account's bucket prefix is purged.
    await cancelDocumentProcessingJobs();

    const filePaths = (await listAllObjects("decks", userId)).map((item) => item.name);

    if (filePaths.length > 0) {
      console.log(`[delete-account] Removing ${filePaths.length} storage objects for user ${userId}`);
      const BATCH = 100;
      for (let i = 0; i < filePaths.length; i += BATCH) {
        const chunk = filePaths.slice(i, i + BATCH);
        try {
          await deleteObjects("decks", chunk);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[delete-account] Storage remove error:`, message);
        }
      }
    }

    const { error: analyticsErasureError } = await adminClient
      .rpc("erase_deck_download_events_for_account", { p_user_id: userId });
    if (analyticsErasureError) throw analyticsErasureError;

    console.log(`[delete-account] Deleting auth.users row for ${userId}`);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("[delete-account] Failed to delete user:", deleteError.message);
      throw deleteError;
    }

    console.log(`[delete-account] Successfully deleted user ${userId}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (deletionMarked) {
      const { error: clearError } = await adminClient
        .rpc("clear_account_deletion_pending", { p_user_id: userId });
      if (clearError) {
        console.error("[delete-account] Failed to clear deletion-pending state:", clearError.message);
      } else {
        deletionMarked = false;
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[delete-account] Critical error:", message);
    return new Response(JSON.stringify({ error: "Failed to delete account" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
