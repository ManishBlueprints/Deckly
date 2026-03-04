import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

// document-processor Edge Function
// Handles conversion of PPTX, DOCX, XLSX, and PDF to interactive JPG slides

serve(async (req: Request) => {
  console.log("--- Function Invoked ---");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
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
    const urlParts = deck.file_url.split("/public/decks/");
    if (urlParts.length < 2) {
      throw new Error(`Could not parse file path from URL: ${deck.file_url}`);
    }

    const filePath = urlParts[1];
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

    // Convert directly to JPG via ConvertAPI
    console.log(`[Step 3] Sending to ConvertAPI (${fileExt} to jpg)...`);
    const convertUrl =
      `https://v2.convertapi.com/convert/${fileExt}/to/jpg?Secret=${apiKey}`;

    const formData = new FormData();
    // We use a clean fileName without path slashes for the API
    formData.append("File", fileData, fileName);

    const convertResponse = await fetch(convertUrl, {
      method: "POST",
      body: formData,
    });

    if (!convertResponse.ok) {
      const errorText = await convertResponse.text();
      let errorMessage = `ConvertAPI error (${convertResponse.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.Message || errorMessage;
      } catch (_) {
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
      throw new Error("ConvertAPI successful but returned no files/images");
    }

    console.log(
      `[Step 3 OK] ConvertAPI success: ${convertedFiles.length} images generated`,
    );

    const imageUrls = [];
    const deckSlug = deck.slug;

    // Upload each image to Supabase Storage
    for (let i = 0; i < convertedFiles.length; i++) {
      const fileInfo = convertedFiles[i];
      const fileUrl = fileInfo.Url || fileInfo.url || fileInfo.URL;
      const base64Data = fileInfo.FileData || fileInfo.filedata;

      let imageBuffer: ArrayBuffer | Uint8Array;

      if (fileUrl) {
        console.log(
          `[Step 4] Downloading page ${
            i + 1
          }/${convertedFiles.length} from URL...`,
        );
        const imageResponse = await fetch(fileUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download page ${i + 1} from URL`);
        }
        imageBuffer = await imageResponse.arrayBuffer();
      } else if (base64Data) {
        console.log(
          `[Step 4] Decoding page ${
            i + 1
          }/${convertedFiles.length} from base64...`,
        );
        imageBuffer = decode(base64Data);
      } else {
        console.error(
          `[Page ${i + 1}] Missing URL and FileData in fileInfo:`,
          JSON.stringify(fileInfo),
        );
        continue;
      }

      const imagePath = `${deck.user_id}/deck-images/${deckSlug}/page-${
        i + 1
      }.jpg`;

      const { error: uploadError } = await supabaseClient.storage
        .from("decks")
        .upload(imagePath, imageBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(
          `Upload error at page ${i + 1}: ${uploadError.message}`,
        );
      }

      const { data: urlData } = supabaseClient.storage.from("decks")
        .getPublicUrl(imagePath);
      imageUrls.push({ image_url: urlData.publicUrl, page_number: i + 1 });
    }

    console.log(`[Step 5] Finalizing database update...`);
    // Update the deck record
    const { error: updateError } = await supabaseClient
      .from("decks")
      .update({
        pages: imageUrls,
        status: "PROCESSED",
      })
      .eq("id", deck.id);

    if (updateError) {
      throw new Error(`Final update error: ${updateError.message}`);
    }

    console.log("--- Function Successful ---");
    return new Response(
      JSON.stringify({
        success: true,
        count: imageUrls.length,
        message: "Processing completed",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
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
        status: 200, // Return 200 so the frontend can read the JSON error message
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
