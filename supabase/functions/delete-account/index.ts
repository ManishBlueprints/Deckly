import { createClient } from "@supabase/supabase-js";

// delete-account Edge Function
// Verifies the caller's JWT, purges all storage objects, then deletes the
// auth.users row which cascades to profiles, branding, decks, data_rooms, etc.

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing server environment variables" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // Extract Bearer token from Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const accessToken = authHeader.replace("Bearer ", "").trim();

  // Create a USER-scoped client to verify the JWT
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
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

  // Create admin client to perform privileged operations
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    // --- Step 1: Purge all storage objects owned by this user ---
    // Files are stored under `decks/{userId}/...` paths
    const { data: userFolder, error: listError } = await adminClient.storage
      .from("decks")
      .list(userId, { limit: 1000 });

    if (!listError && userFolder && userFolder.length > 0) {
      // Recursively collect all file paths under the user's folder
      const filePaths: string[] = [];

      for (const item of userFolder) {
        if (item.id) {
          // It's a file
          filePaths.push(`${userId}/${item.name}`);
        } else {
          // It's a subfolder — list its contents
          const { data: subFiles } = await adminClient.storage
            .from("decks")
            .list(`${userId}/${item.name}`, { limit: 1000 });

          if (subFiles) {
            for (const subFile of subFiles) {
              if (subFile.id) {
                filePaths.push(`${userId}/${item.name}/${subFile.name}`);
              }
            }
          }
        }
      }

      if (filePaths.length > 0) {
        console.log(`[delete-account] Removing ${filePaths.length} storage objects for user ${userId}`);
        // Delete in batches of 100 (Supabase limit)
        const BATCH = 100;
        for (let i = 0; i < filePaths.length; i += BATCH) {
          const chunk = filePaths.slice(i, i + BATCH);
          const { error: removeError } = await adminClient.storage.from("decks").remove(chunk);
          if (removeError) {
            console.error(`[delete-account] Storage remove error:`, removeError.message);
            // Non-fatal: continue with account deletion
          }
        }
      }
    }

    // --- Step 2: Delete the auth user (cascades to all DB tables) ---
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
    const message = err instanceof Error ? err.message : String(err);
    console.error("[delete-account] Critical error:", message);
    return new Response(JSON.stringify({ error: "Failed to delete account", detail: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
