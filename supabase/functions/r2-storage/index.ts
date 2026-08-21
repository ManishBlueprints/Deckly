import { createClient } from "@supabase/supabase-js";
import {
  buildStoragePublicUrl,
  createSignedUrls,
  deleteObjects,
  listObjects,
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

function isServerManagedDeckPath(userId: string, key: string): boolean {
  return key.startsWith(`${userId}/decks/verified/`)
    || new RegExp(`^${userId}/decks/[^/]+/revisions/`).test(key)
    || key.startsWith(`${userId}/watermarks/`);
}

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function buildJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
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
      headers: responseHeaders,
    });
  }

  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return buildJsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = asString(body.action) as R2StorageAction | null;
    const bucket = asBucket(body.bucket) ?? "decks";

    if (!action) {
      return buildJsonResponse({ error: "Invalid action" }, 400);
    }

    if (action === "presign-upload") {
      const key = asString(body.key);
      if (!key) {
        return buildJsonResponse({ error: "Missing key" }, 400);
      }

      if (!userPrefixIsAllowed(currentUser.user.id, key) || isServerManagedDeckPath(currentUser.user.id, key)) {
        return buildJsonResponse({ error: "Forbidden" }, 403);
      }

      const uploadUrl = await presignPutUrl(bucket, key, 900);
      return buildJsonResponse({
        uploadUrl,
        key,
        publicUrl: buildStoragePublicUrl(bucket, key),
      });
    }

    if (action === "remove") {
      const keys = Array.isArray(body.keys)
        ? body.keys.filter((value: unknown): value is string =>
          typeof value === "string" && value.trim().length > 0
        )
        : [];

      if (keys.length === 0) {
        return buildJsonResponse({ error: "Missing keys" }, 400);
      }

      for (const key of keys) {
        if (
          !userPrefixIsAllowed(currentUser.user.id, key)
          || isServerManagedDeckPath(currentUser.user.id, key)
        ) {
          return buildJsonResponse({ error: "Forbidden" }, 403);
        }
      }

      await deleteObjects(bucket, keys);
      return buildJsonResponse({ success: true });
    }

    if (action === "list") {
      const prefix = asString(body.prefix) ?? "";
      if (!prefix || !userPrefixIsAllowed(currentUser.user.id, prefix)) {
        return buildJsonResponse({ error: "Forbidden" }, 403);
      }

      const limit =
        typeof body.limit === "number" && Number.isFinite(body.limit)
          ? Math.max(1, Math.min(Math.floor(body.limit), 1000))
          : 1000;
      const continuationToken =
        typeof body.continuationToken === "string" && body.continuationToken.trim().length > 0
          ? body.continuationToken.trim()
          : null;

      const page = await listObjects(bucket, prefix, {
        limit,
        continuationToken,
      });

      return buildJsonResponse({
        data: page.items,
        nextToken: page.nextContinuationToken,
      });
    }

    if (action === "create-signed-urls") {
      const paths = Array.isArray(body.paths)
        ? body.paths.filter((value: unknown): value is string =>
          typeof value === "string" && value.trim().length > 0
        )
        : [];
      const expiresInSeconds = typeof body.expiresInSeconds === "number" ? body.expiresInSeconds : 3600;

      if (paths.length === 0) {
        return buildJsonResponse({ error: "Missing paths" }, 400);
      }

      for (const key of paths) {
        if (!userPrefixIsAllowed(currentUser.user.id, key)) {
          return buildJsonResponse({ error: "Forbidden" }, 403);
        }
      }

      const data = await createSignedUrls(bucket, paths, expiresInSeconds);
      return buildJsonResponse({ data });
    }

    return buildJsonResponse({ error: "Unsupported action" }, 400);
  } catch (err) {
    console.error("[r2-storage] error", err);
    return buildJsonResponse({ error: "Internal server error" }, 500);
  }
});
