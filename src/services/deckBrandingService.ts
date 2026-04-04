import { supabase } from "./supabase";
import { BrandingSettings } from "../types";
import { withRetry } from "../utils/resilience";
import { extractStoragePath, getRequiredDeckUserId } from "./deckService.shared";

const ALLOWED_LOGO_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const ALLOWED_LOGO_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

export const deckBrandingService = {
  async getBrandingSettings(
    providedUserId?: string,
  ): Promise<BrandingSettings | null> {
    const userId = await getRequiredDeckUserId(providedUserId).catch((error) => {
      if (error instanceof Error && error.message === "Not authenticated") return null;
      throw error;
    });
    if (!userId) return null;

    return withRetry(async () => {
      const { data, error } = await supabase
        .from("branding")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as BrandingSettings;
    });
  },

  async updateBrandingSettings(
    settings: Partial<BrandingSettings>,
    providedUserId?: string,
  ): Promise<BrandingSettings> {
    const userId = await getRequiredDeckUserId(providedUserId);
    const { data, error } = await supabase
      .from("branding")
      .upsert(
        [{
          ...settings,
          user_id: userId,
          updated_at: new Date().toISOString(),
        }],
        { onConflict: "user_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return data as BrandingSettings;
  },

  async uploadLogo(file: File): Promise<string> {
    const dotIndex = file.name.lastIndexOf(".");
    const fileExt = dotIndex > -1
      ? file.name.slice(dotIndex + 1).toLowerCase()
      : "";

    if (!fileExt || !ALLOWED_LOGO_EXTENSIONS.has(fileExt)) {
      throw new Error(
        "Invalid logo file type. Please upload a PNG, JPG, JPEG, or WEBP image.",
      );
    }

    if (!ALLOWED_LOGO_MIME_TYPES.has(file.type)) {
      throw new Error(
        "Invalid logo MIME type. Please upload a PNG, JPG, JPEG, or WEBP image.",
      );
    }

    if (file.size <= 0) {
      throw new Error("Logo file is empty. Please choose a valid image.");
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      throw new Error(
        "Logo file is too large. Please upload an image up to 5MB.",
      );
    }

    const userId = await getRequiredDeckUserId();
    const fileName = `${userId}/branding/logo-${Date.now()}-${crypto.randomUUID()}${
      fileExt ? "." + fileExt : ""
    }`;

    // 1. Fetch current branding to identify the old logo
    const { data: currentBranding, error: fetchError } = await supabase
      .from("branding")
      .select("logo_url")
      .eq("user_id", userId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.warn("Failed to fetch current branding:", fetchError);
    }

    const oldLogoUrl = currentBranding?.logo_url;

    // 2. Upload new logo
    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("assets").getPublicUrl(fileName);

    // 3. Update branding record atomically
    const { error: updateError } = await supabase
      .from("branding")
      .upsert(
        [{
          logo_url: publicUrl,
          user_id: userId,
          updated_at: new Date().toISOString(),
        }],
        { onConflict: "user_id" },
      );

    if (updateError) {
      console.error(
        "Failed to update branding record after logo upload:",
        updateError,
      );
      // Cleanup the newly uploaded file to avoid an orphan asset in storage
      if (fileName) {
        await supabase.storage.from("assets").remove([fileName]).catch((err) =>
          console.warn("Failed to clean up newly uploaded logo on DB error:", err)
        );
      }
      throw updateError;
    }

    // 4. Cleanup ONLY the specific old logo if it exists and is different
    if (oldLogoUrl && oldLogoUrl !== publicUrl) {
      const oldPath = extractStoragePath(oldLogoUrl, "assets");

      if (oldPath && oldPath.startsWith(`${userId}/branding/logo-`)) {
        const { error: removeError } = await supabase.storage
          .from("assets")
          .remove([oldPath]);

        if (removeError) {
          console.warn("Failed to clean up specific old logo asset:", {
            userId,
            oldPath,
            removeError,
          });
        }
      }
    }

    return publicUrl;
  },
};
