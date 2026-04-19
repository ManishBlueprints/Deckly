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
    const { slug, password, storage_path, image_paths = [], room_slug } = await req.json();

    if ((!slug && !room_slug)) {
      return new Response(
        JSON.stringify({ error: "slug or room_slug is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing environment variables: SUPABASE_URL or SUPABASE_ANON_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Use the anon client to call get_deck_payload — this re-validates
    // the slug/password/expiry before we issue a signed URL.
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);

    const validPaths = new Set<string>();

    interface DeckPayload {
      storage_path?: string;
      pages?: Array<{ image_url: string } | string>;
    }

    if (room_slug) {
      // Data room mode
      const { data: rpcData, error: rpcError } = await anonClient.rpc("get_data_room_payload", {
        p_slug: room_slug,
        p_password: password ?? null,
      });

      if (rpcError || !rpcData) {
        return new Response(JSON.stringify({ error: "Unauthorized Data Room" }), { status: 403, headers: { "Content-Type": "application/json" } });
      }

      const payloads = rpcData as DeckPayload[];
      payloads.forEach(payload => {
        if (payload.storage_path) validPaths.add(payload.storage_path);
        (Array.isArray(payload.pages) ? payload.pages : []).forEach(page => {
          const url = typeof page === 'string' ? page : page.image_url;
          if (url && typeof url === 'string') {
            const marker = "/storage/v1/object/public/decks/";
            const idx = url.indexOf(marker);
            if (idx !== -1) validPaths.add(url.substring(idx + marker.length));
          }
        });
      });
    } else {
      // Individual deck mode
      const { data: rpcData, error: rpcError } = await anonClient.rpc("get_deck_payload", {
        p_slug: slug,
        p_password: password ?? null,
      });

      if (rpcError || !rpcData) {
        return new Response(JSON.stringify({ error: "Unauthorized Deck" }), { status: 403, headers: { "Content-Type": "application/json" } });
      }

      const payload = rpcData as DeckPayload;
      if (payload.storage_path) validPaths.add(payload.storage_path);
      (Array.isArray(payload.pages) ? payload.pages : []).forEach(page => {
        const url = typeof page === 'string' ? page : page.image_url;
        if (url && typeof url === 'string') {
          const marker = "/storage/v1/object/public/decks/";
          const idx = url.indexOf(marker);
          if (idx !== -1) validPaths.add(url.substring(idx + marker.length));
        }
      });
    }

    // Reject if any requested path (main or image) is not authorized for this session.
    const requestedPaths = [];
    if (storage_path) requestedPaths.push(storage_path);
    requestedPaths.push(...image_paths);

    for (const path of requestedPaths) {
      if (path && !validPaths.has(path)) {
         return new Response(
          JSON.stringify({ error: `Forbidden: path mismatch for ${path}` }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Auth passed — use service_role to generate signs for ALL requested paths.
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseServiceKey) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

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

    const transformUrl = (url: string | null | undefined) => {
      if (!url) return url;
      try {
        const urlObj = new URL(url);
        const isInternalHost = urlObj.hostname === "kong" || 
                              urlObj.hostname.includes("supabase_") || 
                              urlObj.hostname.includes("storage");

        if (isInternalHost || supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost") || supabaseUrl.includes("kong")) {
          const original = url;
          urlObj.protocol = "http:";
          urlObj.hostname = "localhost";
          urlObj.port = "54321";
          const transformed = urlObj.toString();
          console.log(`[Local Rewrite] ${original} -> ${transformed}`);
          return transformed;
        }
      } catch (e) {
        console.error("Failed to parse signed URL:", e);
      }
      return url;
    };

    const signedMain = storage_path ? transformUrl(signedData.find(d => d.path === storage_path)?.signedUrl) : null;
    const signedImages = (image_paths as string[]).map((path: string) => ({
      path,
      signedUrl: transformUrl(signedData.find(d => d.path === path)?.signedUrl) || null,
    }));

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
