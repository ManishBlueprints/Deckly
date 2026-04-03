import { supabase } from "./supabase";
import { BrandingSettings } from "../types";
import { withRetry } from "../utils/resilience";
import { getRequiredDeckUserId } from "./deckService.shared";

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

    const { data: existing } = await supabase
      .from("branding")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("branding")
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data as BrandingSettings;
    }

    const { data, error } = await supabase
      .from("branding")
      .insert([{ ...settings, user_id: userId }])
      .select()
      .single();
    if (error) throw error;
    return data as BrandingSettings;
  },

  async uploadLogo(file: File): Promise<string> {
    const userId = await getRequiredDeckUserId();
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/branding/logo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("assets").getPublicUrl(fileName);
    return publicUrl;
  },
};
