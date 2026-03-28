import { createClient } from "@supabase/supabase-js";
import { decodeBase64 } from "@std/encoding/base64";

// document-processor Edge Function
// Converts PPTX, DOCX, XLSX to PDF and returns a signed URL
// Client downloads PDF, processes it (images + link extraction), and cleans up

Deno.serve(async (req: Request) => {
  console.log("--- Function Invoked ---");

  const siteUrl = Deno.env.get("SITE_URL");
  if (!siteUrl) {
    return new Response(
      JSON.stringify({ error: "Server Configuration Error: SITE_URL missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const allowedOrigin = siteUrl;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    // Get user from JWT
    const { data: { user }, error: authError } = await supabaseClient.auth
      .getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Invalid or expired token");

    // Get the request body
    const body = await req.json().catch(() => ({}));
    const { deckId } = body;

    if (!deckId) throw new Error("Missing deckID in request body");

    console.log(`[Step 1] Fetching deck from DB: ${deckId}`);
    const { data: deck, error: dbError } = await supabaseClient
      .from("decks")
      .select("*")
      .eq("id", deckId)
      .single();

    if (dbError) throw new Error(`Database fetch error: ${dbError.message}`);
    if (!deck) throw new Error("No deck found for processing");

    // CRITICAL: Verify ownership
    if (deck.user_id !== user.id) {
      console.error(
        `[SECURITY] User ${user.id} attempted to process deck ${deckId} owned by ${deck.user_id}`,
      );
      throw new Error("You do not have permission to process this document");
    }

    // NEW: Verify Tier
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error(`[SECURITY] Could not fetch profile for user ${user.id}`);
      throw new Error("Could not verify subscription tier");
    }

    if (profile.tier === "FREE") {
      console.error(
        `[SECURITY] FREE user ${user.id} attempted to trigger interactive processing`,
      );
      throw new Error(
        "Interactive mode is restricted to PRO tiers. Please upgrade your account.",
      );
    }

    console.log(
      `[Step 1 OK] Processing deck: ${deck.title} (${deck.id}) Tier: ${profile.tier}`,
    );

    const apiKey = Deno.env.get("CONVERT_API_SECRET");
    if (!apiKey) {
      throw new Error("CONVERT_API_SECRET is not set in Supabase Secrets.");
    }

    // Extract file path from URL
    const storageBaseUrl = `${supabaseUrl}/storage/v1/object/public/decks/`;
    if (!deck.file_url.startsWith(storageBaseUrl)) {
      throw new Error(
        `[SECURITY] Deck ${deckId} file_url "${deck.file_url}" is external or invalid. Processing rejected.`,
      );
    }
    const filePath = deck.file_url.replace(storageBaseUrl, "");

    if (!filePath) throw new Error("Could not parse storage path from file_url");
    const fileName = filePath.split("/").pop() || "document.pptx";
    console.log(`[Step 2] Downloading file: ${filePath}`);

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from("decks")
      .download(filePath);

    if (downloadError) {
      throw new Error(`Storage download error: ${downloadError.message}`);
    }
    if (!fileData) throw new Error("File data is empty after download");
    console.log(`[Step 2 OK] Downloaded ${fileData.size} bytes`);

    const fileExt = fileName.split(".").pop()?.toLowerCase() || "pdf";

    // Convert to PDF via ConvertAPI (instead of JPG to preserve links)
    console.log(`[Step 3] Sending to ConvertAPI (${fileExt} to pdf)...`);
    const convertUrl = `https://v2.convertapi.com/convert/${fileExt}/to/pdf`;

    const formData = new FormData();
    // We use a clean fileName without path slashes for the API
    formData.append("File", fileData, fileName);

    const convertResponse = await fetch(convertUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!convertResponse.ok) {
      const errorText = await convertResponse.text();
      let errorMessage = `ConvertAPI error (${convertResponse.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.Message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const convertResult = await convertResponse.json();
    const convertedFiles = convertResult.Files;

    if (
      !convertedFiles || !Array.isArray(convertedFiles) ||
      convertedFiles.length === 0
    ) {
      console.error("ConvertAPI Result:", JSON.stringify(convertResult));
      throw new Error("ConvertAPI successful but returned no PDF file");
    }

    // PPTX→PDF returns a single PDF file
    const pdfFileInfo = convertedFiles[0];
    const pdfUrl = pdfFileInfo.Url || pdfFileInfo.url || pdfFileInfo.URL;
    const pdfBase64Data = pdfFileInfo.FileData || pdfFileInfo.filedata;

    let pdfBuffer: ArrayBuffer | Uint8Array;

    if (pdfUrl) {
      console.log(`[Step 4] Downloading converted PDF from URL...`);
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error("Failed to download converted PDF from URL");
      }
      pdfBuffer = await pdfResponse.arrayBuffer();
    } else if (pdfBase64Data) {
      console.log(`[Step 4] Decoding converted PDF from base64...`);
      pdfBuffer = decodeBase64(pdfBase64Data);
    } else {
      console.error(
        "PDF missing URL and FileData:",
        JSON.stringify(pdfFileInfo),
      );
      throw new Error("ConvertAPI returned PDF without downloadable content");
    }

    console.log(
      `[Step 4 OK] PDF conversion successful, size: ${pdfBuffer.byteLength} bytes`,
    );

    // Upload PDF to temp path (client will download, process, and delete)
    const tempPath = `${deck.user_id}/temp/${deck.id}.pdf`;
    console.log(`[Step 5] Uploading temp PDF to: ${tempPath}`);

    const { error: uploadError } = await supabaseClient.storage
      .from("decks")
      .upload(tempPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Temp PDF upload error: ${uploadError.message}`);
    }

    // Create signed URL with 5 min TTL (NOT public URL for security)
    const { data: signedUrlData, error: signedUrlError } =
      await supabaseClient.storage
        .from("decks")
        .createSignedUrl(tempPath, 300); // 5 min TTL

    if (signedUrlError || !signedUrlData) {
      throw new Error(
        `Failed to create signed URL: ${signedUrlError?.message}`,
      );
    }

    console.log(`[Step 5 OK] Temp PDF uploaded, signed URL created`);

    // Update status to CONVERTING
    console.log(`[Step 6] Updating deck status to CONVERTING: ${deckId}`);
    try {
      const { error: updateError } = await supabaseClient
        .from("decks")
        .update({ status: "CONVERTING" })
        .eq("id", deckId);
      if (updateError) throw updateError;
    } catch (updateErr) {
      const msg = updateErr instanceof Error ? updateErr.message : String(updateErr);
      console.error(`[CRITICAL] Failed to update deck status to CONVERTING for deck ${deckId}: ${msg}`);
      throw new Error(`Failed to update deck status: ${msg}`);
    }

    // Return signed PDF URL - client will handle PDF→images + link extraction
    console.log("--- Function Successful ---");
    return new Response(
      JSON.stringify({
        success: true,
        pdf_url: signedUrlData.signedUrl,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
        },
        status: 200,
      },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error && err.stack
      ? err.stack
      : undefined;
    console.error("[CRITICAL ERROR]", {
      message: errorMessage,
      stack: errorStack,
    });

    return new Response(
      JSON.stringify({
        error: true,
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while processing the document.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
        },
      },
    );
  }
});
