import { createClient } from "@supabase/supabase-js";

// cleanup-temp Edge Function
// Scheduled function to delete orphaned temp PDFs older than 1 hour
// Safety net for when client crashes before cleanup
// This is a server-to-server function, NOT meant for browser calls

Deno.serve(async (req: Request) => {
  console.log("--- Cleanup Function Invoked ---");

  // Cron secret authentication - must be first, before any storage operations
  const cronSecret = Deno.env.get("CLEANUP_CRON_SECRET");
  const authHeader = req.headers.get("Authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error("[AUTH FAILED] Invalid or missing cron secret");
    return new Response(
      JSON.stringify({
        error: true,
        message: "Unauthorized",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);
    const filesToDelete: string[] = [];

    // List all users' temp directories
    // We need to list all users, then list their temp folders
    const { data: users, error: usersError } = await supabaseClient.storage
      .from("decks")
      .list("", {
        limit: 1000,
      });

    if (usersError) {
      console.error("Error listing users:", usersError.message);
      throw new Error(`Failed to list users: ${usersError.message}`);
    }

    // Warn if user list may be truncated
    if (users && users.length === 1000) {
      console.warn(
        "User list may be truncated, pagination required for full cleanup",
      );
    }

    // Batch process user directories in parallel (e.g., 20 at a time)
    const BATCH_SIZE = 20;
    const userFolders = (users || []).filter((u) => u.name && !u.name.includes("."));
    
    for (let i = 0; i < userFolders.length; i += BATCH_SIZE) {
      const batch = userFolders.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(userFolders.length / BATCH_SIZE)}...`);

      const batchResults = await Promise.all(
        batch.map(async (userFolder) => {
          const { data: tempFiles, error: tempError } = await supabaseClient.storage
            .from("decks")
            .list(`${userFolder.name}/temp`, {
              limit: 1000,
            });

          if (tempError) {
            // Folder might not exist, skip
            return [];
          }

          return (tempFiles || [])
            .filter((file) => {
              if (!file.name.endsWith(".pdf")) return false;
              const updatedAt = file.updated_at
                ? new Date(file.updated_at)
                : file.created_at
                ? new Date(file.created_at)
                : null;
              return updatedAt && updatedAt < ONE_HOUR_AGO;
            })
            .map((file) => `${userFolder.name}/temp/${file.name}`);
        })
      );

      // Collect paths to delete
      filesToDelete.push(...batchResults.flat());
    }

    // Delete old files in batch
    if (filesToDelete.length > 0) {
      console.log(`Deleting ${filesToDelete.length} orphaned temp files...`);
      const { error: deleteError } = await supabaseClient.storage
        .from("decks")
        .remove(filesToDelete);

      if (deleteError) {
        console.error("Delete error:", deleteError.message);
        throw new Error(`Failed to delete files: ${deleteError.message}`);
      }
    }

    console.log(
      `--- Cleanup Complete: ${filesToDelete.length} files deleted ---`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        deleted: filesToDelete.length,
        files: filesToDelete,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[CRITICAL ERROR]", errorMessage);

    return new Response(
      JSON.stringify({
        error: true,
        message: errorMessage,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});
