import { deleteObjects, listAllObjects } from "../_shared/r2.ts";

// cleanup-temp Edge Function
// Scheduled function to delete orphaned temp PDFs older than 1 hour
// Safety net for when client crashes before cleanup
// This is a server-to-server function, NOT meant for browser calls

Deno.serve(async (req: Request) => {
  console.log("--- Cleanup Function Invoked ---");

  const cronSecret = Deno.env.get("CRON_SECRET");
  const cronHeader = req.headers.get("x-cron-secret");

  if (!cronSecret || cronHeader !== cronSecret) {
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
    const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);
    const filesToDelete = (await listAllObjects("decks", ""))
      .filter((file) => file.name.includes("/temp/") && file.name.endsWith(".pdf"))
      .filter((file) => {
        const updatedAt = file.updated_at
          ? new Date(file.updated_at)
          : file.created_at
          ? new Date(file.created_at)
          : null;
        return updatedAt && updatedAt < ONE_HOUR_AGO;
      })
      .map((file) => file.name);

    if (filesToDelete.length > 0) {
      console.log(`Deleting ${filesToDelete.length} orphaned temp files in batches...`);
      const BATCH_SIZE = 100;
      const failedBatches: Array<{ chunk: string[]; error: string }> = [];

      for (let i = 0; i < filesToDelete.length; i += BATCH_SIZE) {
        const chunk = filesToDelete.slice(i, i + BATCH_SIZE);
        try {
          await deleteObjects("decks", chunk);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Delete error for chunk ${Math.floor(i / BATCH_SIZE) + 1}:`, message);
          failedBatches.push({ chunk, error: message });
        }
      }

      if (failedBatches.length > 0) {
        throw new Error(`Failed to delete ${failedBatches.length} batches. First error: ${failedBatches[0].error}`);
      }
    }

    console.log(`--- Cleanup Complete: ${filesToDelete.length} files deleted ---`);

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
        message: "Internal server error",
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
