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
    const { slug, password, storage_path } = await req.json();

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

    const { error: rpcError } = await anonClient.rpc("get_deck_payload", {
      p_slug: slug,
      p_password: password ?? null,
    });

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Auth passed — use service_role to generate the signed URL.
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const EXPIRES_IN_SECONDS = 3600; // 1 hour

    const { data, error: signError } = await adminClient.storage
      .from("decks")
      .createSignedUrl(storage_path, EXPIRES_IN_SECONDS);

    if (signError || !data?.signedUrl) {
      console.error("Failed to create signed URL", signError);
      return new Response(
        JSON.stringify({ error: "Failed to generate signed URL" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        signed_url: data.signedUrl,
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
