import { supabase } from "./supabase";
import { BrandingSettings } from "../types";
import { withRetry } from "../utils/resilience";
import { getRequiredDeckUserId } from "./deckService.shared";

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
    const userId = await getRequiredDeckUserId(providedUserId).catch(() => null);
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
        [{ ...settings, user_id: userId, updated_at: new Date().toISOString() }],
        { onConflict: "user_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return data as BrandingSettings;
  },

  async uploadLogo(file: File): Promise<string> {
    const dotIndex = file.name.lastIndexOf(".");
    const fileExt = dotIndex > -1 ? file.name.slice(dotIndex + 1).toLowerCase() : "";

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
      throw new Error("Logo file is too large. Please upload an image up to 5MB.");
    }

    const userId = await getRequiredDeckUserId();
    const brandingPrefix = `${userId}/branding`;
    const fileName = `${userId}/branding/logo-${Date.now()}${fileExt ? "." + fileExt : ""}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("assets").getPublicUrl(fileName);

    const { data: existingFiles, error: listError } = await supabase.storage
      .from("assets")
      .list(brandingPrefix);

    if (listError) {
      console.warn("Failed to list previous branding assets after logo upload:", {
        userId,
        brandingPrefix,
        listError,
      });
      return publicUrl;
    }

    const oldLogoPaths = (existingFiles || [])
      .filter((existingFile) => existingFile.name.startsWith("logo-"))
      .filter((existingFile) => `${brandingPrefix}/${existingFile.name}` !== fileName)
      .map((existingFile) => `${brandingPrefix}/${existingFile.name}`);

    if (oldLogoPaths.length > 0) {
      const { error: removeError } = await supabase.storage
        .from("assets")
        .remove(oldLogoPaths);

      if (removeError) {
        console.warn("Failed to clean up old branding assets after logo upload:", {
          userId,
          oldLogoPaths,
          removeError,
        });
      }
    }

    return publicUrl;
  },
};
