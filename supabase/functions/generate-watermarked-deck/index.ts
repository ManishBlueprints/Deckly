import { createClient } from "@supabase/supabase-js";
import { extractStoragePath } from "../../../src/services/storagePaths.ts";
import { deleteObject, deleteObjects, listAllObjects, presignGetUrl, uploadObject } from "../_shared/r2.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
});

const EXTERNAL_FETCH_TIMEOUT_MS = 60_000;
const CONVERT_API_DOWNLOAD_HOST = "v2.convertapi.com";

async function withExternalFetchTimeout<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_FETCH_TIMEOUT_MS);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
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

  const parsedBody: unknown = await req.json().catch(() => ({}));
  const body = parsedBody && typeof parsedBody === "object"
    ? parsedBody as Record<string, unknown>
    : {};
  const action: "generate" | "cleanup" = body.action === "cleanup" ? "cleanup" : "generate";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("PROJECT_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const convertApiKey = Deno.env.get("CONVERT_API_SECRET") ?? "";
  if (!supabaseUrl || !serviceRoleKey || (action === "generate" && !convertApiKey)) {
    return json({ success: false, message: "Watermark service is not configured." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ success: false, message: "Authentication required." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let deckId = "";
  let revision = "";
  try {
    deckId = typeof body.deckId === "string" ? body.deckId : "";
    if (!deckId) return json({ success: false, message: "A deck id is required." }, 400);

    const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !userData.user) return json({ success: false, message: "Authentication required." }, 401);

    const { data: deck, error: deckError } = await admin
      .from("decks")
      .select("id, user_id, file_url, file_type, watermark_enabled, watermark_text, watermark_revision, watermark_status, watermarked_file_path")
      .eq("id", deckId)
      .single();
    if (deckError || !deck || deck.user_id !== userData.user.id) {
      return json({ success: false, message: "Deck not found." }, 404);
    }
    revision = deck.watermark_revision;
    const watermarkPrefix = `${deck.user_id}/watermarks/${deck.id}/`;
    const expectedCurrentPath = `${watermarkPrefix}${revision}.pdf`;

    if (action === "cleanup") {
      if (deck.watermark_enabled) {
        return json({ success: false, message: "Disable the watermark before cleanup." }, 409);
      }
      const watermarkArtifacts = await listAllObjects("decks", watermarkPrefix);
      await deleteObjects(
        "decks",
        watermarkArtifacts
          .map((artifact) => artifact.name)
          .filter((path) => path.startsWith(watermarkPrefix)),
      );
      const { error: cleanupUpdateError } = await admin
        .from("decks")
        .update({ watermarked_file_path: null, watermark_error: null, watermark_updated_at: new Date().toISOString() })
        .eq("id", deckId)
        .eq("watermark_enabled", false);
      if (cleanupUpdateError) throw cleanupUpdateError;
      return json({ success: true });
    }

    if (!deck.watermark_enabled || deck.file_type !== "pdf" || !deck.watermark_text?.trim()) {
      return json({ success: false, message: "This deck does not have an active PDF watermark." }, 409);
    }

    if (deck.watermark_status === "ready" && deck.watermarked_file_path === expectedCurrentPath) {
      return json({ success: true });
    }

    const { data: entitlement } = await admin.rpc("has_live_feature_for_user", {
      p_user_id: userData.user.id,
      p_feature_key: "deck_watermarking",
    });
    if (entitlement !== true) return json({ success: false, message: "Deck watermarking requires the Raise plan." }, 403);

    const { error: processingError } = await admin
      .from("decks")
      .update({ watermark_status: "processing", watermark_error: null, watermark_updated_at: new Date().toISOString() })
      .eq("id", deckId)
      .eq("watermark_revision", revision);
    if (processingError) throw processingError;

    const sourcePath = extractStoragePath(deck.file_url, "decks");
    if (!sourcePath) throw new Error("The deck source file is invalid.");
    const sourceName = sourcePath.split("/").pop() || "pitch-deck.pdf";
    const sourceUrl = await presignGetUrl("decks", sourcePath, 900);

    const formData = new FormData();
    formData.append("File", sourceUrl);
    formData.append("FileName", sourceName);
    formData.append("Text", deck.watermark_text.trim());
    formData.append("Style", "stamp");
    formData.append("FontName", "arial");
    formData.append("FontSize", "42");
    formData.append("FontColor", "#666666");
    formData.append("Opacity", "25");
    formData.append("Rotation", "-35");
    formData.append("HorizontalAlignment", "center");
    formData.append("VerticalAlignment", "center");
    formData.append("StoreFile", "true");

    const result = await withExternalFetchTimeout(async (signal) => {
      const response = await fetch("https://v2.convertapi.com/convert/pdf/to/text-watermark", {
        method: "POST",
        headers: { Authorization: `Bearer ${convertApiKey}` },
        body: formData,
        signal,
      });
      if (!response.ok) {
        const message = await response.text().catch(() => "");
        throw new Error(`ConvertAPI watermark failed (${response.status}): ${message.slice(0, 240)}`);
      }
      return response.json();
    });
    const converted = Array.isArray(result?.Files) ? result.Files[0] : null;
    const convertedUrl = converted?.Url ?? converted?.url ?? converted?.URL;
    if (typeof convertedUrl !== "string") {
      throw new Error("ConvertAPI returned no watermarked PDF.");
    }
    let convertedDownloadUrl: URL;
    try {
      convertedDownloadUrl = new URL(convertedUrl);
    } catch {
      throw new Error("ConvertAPI returned an invalid watermarked PDF URL.");
    }
    if (
      convertedDownloadUrl.protocol !== "https:" ||
      convertedDownloadUrl.hostname !== CONVERT_API_DOWNLOAD_HOST
    ) {
      throw new Error("ConvertAPI returned an unexpected watermarked PDF URL.");
    }

    const outputPath = `${deck.user_id}/watermarks/${deck.id}/${revision}.pdf`;
    await withExternalFetchTimeout(async (signal) => {
      const convertedResponse = await fetch(convertedDownloadUrl, { signal });
      if (!convertedResponse.ok || !convertedResponse.body) {
        throw new Error("Unable to download the generated watermark file.");
      }
      await uploadObject("decks", outputPath, convertedResponse.body, {
        contentType: "application/pdf",
        expiresInSeconds: 900,
        signal,
      });
    });

    const { data: updated, error: readyError } = await admin
      .from("decks")
      .update({
        watermark_status: "ready",
        watermarked_file_path: outputPath,
        watermark_error: null,
        watermark_updated_at: new Date().toISOString(),
      })
      .eq("id", deckId)
      .eq("watermark_revision", revision)
      .select("id")
      .maybeSingle();
    if (readyError) throw readyError;
    if (!updated) {
      await deleteObject("decks", outputPath).catch((cleanupError) => {
        console.warn("Unable to remove stale watermark artifact", cleanupError);
      });
      return json({ success: true, stale: true });
    }
    if (
      deck.watermarked_file_path &&
      deck.watermarked_file_path !== outputPath &&
      deck.watermarked_file_path.startsWith(`${deck.user_id}/watermarks/${deck.id}/`)
    ) {
      await deleteObject("decks", deck.watermarked_file_path).catch((cleanupError) => {
        console.warn("Unable to remove superseded watermark artifact", cleanupError);
      });
    }
    return json({ success: true });
  } catch (error) {
    console.error("generate-watermarked-deck failed", error);
    if (action === "generate" && deckId && revision) {
      await admin
        .from("decks")
        .update({
          watermark_status: "failed",
          watermark_error: "generation_failed",
          watermark_updated_at: new Date().toISOString(),
        })
        .eq("id", deckId)
        .eq("watermark_revision", revision);
    }
    return json({ success: false, message: "Unable to prepare the watermarked download." }, 500);
  }
});
