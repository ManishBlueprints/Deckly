import { createClient } from "@supabase/supabase-js";

/**
 * sign-deck-url
 *
 * Called AFTER get_deck_payload has already passed password + expiry checks.
 * Accepts the storage_path returned by get_deck_payload and returns a
 * short-lived signed URL for the private decks bucket.
 *
 * The caller must pass the same slug + password they used with get_deck_payload
 * so this function can re-verify authorization before signing.
 *
 * Request body: { slug: string, password?: string, storage_path: string }
 * Response:     { signed_url: string, expires_in: number }
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { slug, password, storage_path, image_paths = [] } = await req.json();

    if (!slug || !storage_path) {
      return new Response(
        JSON.stringify({ error: "slug and storage_path are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Use the anon client to call get_deck_payload — this re-validates
    // the slug/password/expiry before we issue a signed URL.
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data: rpcData, error: rpcError } = await anonClient.rpc("get_deck_payload", {
      p_slug: slug,
      p_password: password ?? null,
    });

    if (rpcError || !rpcData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    interface DeckPayload {
      storage_path?: string;
      pages?: Array<{ image_url: string } | string>;
    }
    const payload = rpcData as DeckPayload;
    const canonicalPath = payload.storage_path;
    
    // Create a set of valid storage paths for this deck based on the DB record.
    // This includes the main PDF and all processed slide images.
    const validPaths = new Set<string>();
    if (canonicalPath) validPaths.add(canonicalPath);
    
    const pages = Array.isArray(payload.pages) ? payload.pages : [];
    pages.forEach(page => {
      // The DB stores image_url (the public URL). We need to extract the storage path
      // to verify it. Since we don't have the extractStoragePath helper here, 
      // we'll use a simple marker search.
      const url = typeof page === 'string' ? page : page.image_url;
      if (url && typeof url === 'string') {
        const marker = "/storage/v1/object/public/decks/";
        const idx = url.indexOf(marker);
        if (idx !== -1) {
          validPaths.add(url.substring(idx + marker.length));
        }
      }
    });

    if (!canonicalPath) {
      return new Response(
        JSON.stringify({ error: "No storage path returned by RPC" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Reject if any requested path (main or image) is not authorized for this deck.
    const requestedPaths = [storage_path, ...image_paths];
    for (const path of requestedPaths) {
      if (!validPaths.has(path)) {
         return new Response(
          JSON.stringify({ error: `Forbidden: path mismatch for ${path}` }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Auth passed — use service_role to generate signs for ALL requested paths.
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const EXPIRES_IN_SECONDS = 3600; // 1 hour

    // Using plural createSignedUrls for better efficiency
    const { data: signedData, error: signError } = await adminClient.storage
      .from("decks")
      .createSignedUrls(requestedPaths, EXPIRES_IN_SECONDS);

    if (signError || !signedData) {
      console.error("Failed to create signed URLs", signError);
      return new Response(
        JSON.stringify({ error: "Failed to generate signed URLs" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Map result: storage_path is always at index 0, images follow.
    const signedMain = signedData.find(d => d.path === storage_path)?.signedUrl;
    const signedImages = (image_paths as string[]).map((path: string) => {
      return signedData.find(d => d.path === path)?.signedUrl || null;
    });

    return new Response(
      JSON.stringify({
        signed_url: signedMain,
        signed_pages: signedImages,
        expires_in: EXPIRES_IN_SECONDS,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("sign-deck-url error", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
