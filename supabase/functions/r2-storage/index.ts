import { createClient } from "@supabase/supabase-js";
import {
  buildStoragePublicUrl,
  createSignedUrls,
  deleteObjects,
  listAllObjects,
  presignPutUrl,
  StorageBucket,
} from "../_shared/r2.ts";

type R2StorageAction =
  | "presign-upload"
  | "remove"
  | "list"
  | "create-signed-urls";

function asBucket(value: unknown): StorageBucket | null {
  return value === "decks" || value === "assets" ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function userPrefixIsAllowed(userId: string, key: string): boolean {
  return key === userId || key.startsWith(`${userId}/`);
}

async function getCurrentUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabasePublishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const client = createClient(supabaseUrl, supabasePublishableKey);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return { user, token };
}

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
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = asString(body.action) as R2StorageAction | null;
    const bucket = asBucket(body.bucket) ?? "decks";

    if (!action) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action === "presign-upload") {
      const key = asString(body.key);
      if (!key) {
        return new Response(JSON.stringify({ error: "Missing key" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!userPrefixIsAllowed(currentUser.user.id, key)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const uploadUrl = await presignPutUrl(bucket, key, 900);
      return new Response(
        JSON.stringify({
          uploadUrl,
          key,
          publicUrl: buildStoragePublicUrl(bucket, key),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        },
      );
    }

    if (action === "remove") {
      const keys = Array.isArray(body.keys)
        ? body.keys.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];

      if (keys.length === 0) {
        return new Response(JSON.stringify({ error: "Missing keys" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      for (const key of keys) {
        if (!userPrefixIsAllowed(currentUser.user.id, key)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      await deleteObjects(bucket, keys);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (action === "list") {
      const prefix = asString(body.prefix) ?? "";
      if (!prefix || !userPrefixIsAllowed(currentUser.user.id, prefix)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const items = await listAllObjects(bucket, prefix);
      return new Response(JSON.stringify({ data: items }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (action === "create-signed-urls") {
      const paths = Array.isArray(body.paths)
        ? body.paths.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
      const expiresInSeconds = typeof body.expiresInSeconds === "number" ? body.expiresInSeconds : 3600;

      if (paths.length === 0) {
        return new Response(JSON.stringify({ error: "Missing paths" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      for (const key of paths) {
        if (!userPrefixIsAllowed(currentUser.user.id, key)) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      const data = await createSignedUrls(bucket, paths, expiresInSeconds);
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[r2-storage] error", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      },
    );
  }
});
