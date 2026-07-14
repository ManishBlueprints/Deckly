import { createClient } from "@supabase/supabase-js";
import { extractStoragePath } from "../../../src/services/storagePaths.ts";
import { createSignedUrls, presignDownloadUrl } from "../_shared/r2.ts";

/**
 * sign-deck-url
 *
 * Called AFTER get_deck_payload has already passed password + expiry checks.
 * Accepts the storage_path returned by get_deck_payload and returns a
 * short-lived signed URL for the private decks bucket.
 *
 * The caller must pass the same handle + slug/alias + password they used
 * with get_deck_payload so this function can re-verify authorization before signing.
 *
 * Request body: { handle?: string, slug: string, password?: string, storage_path: string }
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
    const {
      handle,
      slug,
      password,
      storage_path,
      image_paths: rawImagePaths,
      room_slug,
      intent: rawIntent,
      deck_id: rawDeckId,
    } = await req.json();
    const intent = rawIntent === undefined ? "view" : rawIntent;
    const deckSlug = typeof slug === "string" ? slug : null;
    const roomSlug = typeof room_slug === "string" ? room_slug : null;
    const storagePath = typeof storage_path === "string" ? storage_path : null;
    const image_paths: string[] = Array.isArray(rawImagePaths)
      ? rawImagePaths.filter((p): p is string => typeof p === "string")
      : [];
    const deckId = typeof rawDeckId === "string" ? rawDeckId : null;

    if (intent !== "view" && intent !== "download") {
      return new Response(JSON.stringify({ error: "Invalid request intent" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (slug !== undefined && slug !== null && deckSlug === null) {
      return new Response(
        JSON.stringify({ error: "Invalid request: slug must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (room_slug !== undefined && room_slug !== null && roomSlug === null) {
      return new Response(
        JSON.stringify({ error: "Invalid request: room_slug must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (storage_path !== undefined && storage_path !== null && storagePath === null) {
      return new Response(
        JSON.stringify({ error: "Invalid request: storage_path must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabasePublishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl || !supabasePublishableKey) {
      console.error("Missing environment variables: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Use the publishable client to call get_deck_payload — this re-validates
    // the slug/password/expiry before we issue a signed URL.
    const authHeader = req.headers.get("Authorization");
    const anonClient = createClient(supabaseUrl, supabasePublishableKey, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    });

    const validPaths = new Set<string>();
    let downloadTarget: { path: string; title: string; fileType: string; allowed: boolean } | null = null;

    interface DeckPayload {
      id?: string;
      storage_path?: string;
      title?: string;
      file_type?: string;
      allow_download?: boolean;
      pages?: Array<{ image_url: string } | string>;
    }

    if (roomSlug) {
      // Data room mode
      const { data: rpcData, error: rpcError } = await anonClient.rpc("get_data_room_payload", {
        p_handle: typeof handle === "string" ? handle : null,
        p_slug: roomSlug,
        p_password: password ?? null,
      });

      if (rpcError) {
        console.error("[sign-deck-url] get_data_room_payload RPC failed:", {
          message: rpcError.message,
          hint: rpcError.hint,
          details: rpcError.details,
          code: rpcError.code
        });
        return new Response(
          JSON.stringify({ 
            error: "Unauthorized Data Room",
            message: rpcError.message 
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      if (rpcData) {
        const payloads = rpcData as DeckPayload[];
        payloads.forEach(payload => {
          if (payload.storage_path) validPaths.add(payload.storage_path);
          if (intent === "download" && payload.id === deckId && payload.storage_path) {
            downloadTarget = {
              path: payload.storage_path,
              title: typeof payload.title === "string" ? payload.title : "pitch-deck",
              fileType: typeof payload.file_type === "string" ? payload.file_type : "pdf",
              allowed: payload.allow_download === true,
            };
          }
          (Array.isArray(payload.pages) ? payload.pages : []).forEach(page => {
            const url = typeof page === 'string' ? page : page.image_url;
            if (url && typeof url === 'string') {
              const path = extractStoragePath(url, "decks");
              if (path) validPaths.add(path);
            }
          });
        });
      }
    } else if (deckSlug) {
      // Individual deck mode
      const { data: rpcData, error: rpcError } = await anonClient.rpc("get_deck_payload", {
        p_handle: typeof handle === "string" ? handle : null,
        p_slug_or_alias: deckSlug,
        p_password: password ?? null,
      });

      if (rpcError) {
        console.error("[sign-deck-url] get_deck_payload RPC failed:", {
          message: rpcError.message,
          hint: rpcError.hint,
          details: rpcError.details,
          code: rpcError.code
        });
        return new Response(
          JSON.stringify({ 
            error: "Unauthorized Deck",
            message: rpcError.message 
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      if (rpcData) {
        const payload = rpcData as DeckPayload;
        if (payload.storage_path) validPaths.add(payload.storage_path);
        if (intent === "download" && payload.storage_path) {
          downloadTarget = {
            path: payload.storage_path,
            title: typeof payload.title === "string" ? payload.title : "pitch-deck",
            fileType: typeof payload.file_type === "string" ? payload.file_type : "pdf",
            allowed: payload.allow_download === true,
          };
        }
        (Array.isArray(payload.pages) ? payload.pages : []).forEach(page => {
          const url = typeof page === 'string' ? page : page.image_url;
          if (url && typeof url === 'string') {
            const path = extractStoragePath(url, "decks");
            if (path) validPaths.add(path);
          }
        });
      }
    }

    // Reject if any requested path (main or image) is not authorized for this session.
    // 2. OWNER MODE: If an auth token is provided, verify it.
    // If verified, the owner can sign any path starting with their userId/ without further checks.
    let ownerId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
      if (!userError && user) {
        ownerId = user.id;
        console.log("[sign-deck-url] Owner verified.");
      }
    }

    if (intent === "download") {
      if (!downloadTarget || !downloadTarget.allowed) {
        return new Response(JSON.stringify({ error: "Downloads are not permitted for this deck" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const safeTitle = downloadTarget.title
        .replace(/[\\/:*?"<>|\r\n]+/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "pitch-deck";
      const safeExtension = /^[a-z0-9]{1,10}$/i.test(downloadTarget.fileType)
        ? downloadTarget.fileType.toLowerCase()
        : "pdf";
      const filename = `${safeTitle}.${safeExtension}`;
      const downloadUrl = await presignDownloadUrl("decks", downloadTarget.path, filename, 60);
      return new Response(JSON.stringify({ download_url: downloadUrl, filename, expires_in: 60 }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const requestedPaths = [];
    if (storagePath) requestedPaths.push(storagePath);
    requestedPaths.push(...image_paths);

    // Reject if any requested path is not authorized through either mode
    // Empty strings are treated as invalid and will trigger 403.
    const finalRequestedPaths = requestedPaths.filter(path => {
      if (path === "") return false;
      if (validPaths.has(path)) return true;
      if (ownerId && path.startsWith(`${ownerId}/`)) return true;
      return false;
    });

    if (finalRequestedPaths.length < requestedPaths.length) {
       const missing = requestedPaths.find(p => (p === "" || !validPaths.has(p)) && (!ownerId || p === "" || !p.startsWith(`${ownerId}/`)));
       if (missing) {
         console.warn("[sign-deck-url] Blocked path access attempt: unauthorized path requested.");
         return new Response(
          JSON.stringify({ error: `Forbidden: path not authorized` }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
       }
    }

    if (finalRequestedPaths.length === 0) {
      return new Response(JSON.stringify({ error: "No valid paths to sign" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const EXPIRES_IN_SECONDS = 21600; // 6 hours
    const signedData = await createSignedUrls("decks", finalRequestedPaths, EXPIRES_IN_SECONDS);

    const signedMain = storagePath ? signedData.find((d) => d.path === storagePath)?.signedUrl ?? null : null;
    const signedImages = (image_paths as string[]).map((path: string) => ({
      path,
      signedUrl: signedData.find((d) => d.path === path)?.signedUrl || null,
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
