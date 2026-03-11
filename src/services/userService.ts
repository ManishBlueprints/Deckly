import { supabase } from "./supabase";
import { UserProfile } from "../types";
import { withRetry } from "../utils/resilience";
import { normalizeHandle } from "../utils/slug";

export const userService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error(`[User Service] Error fetching profile:`, error);
        return null;
      }

      const result = data as UserProfile | null;

      // Auto-generate handle if missing and full_name exists so its never blank
      if (result && !result.handle && result.full_name) {
        const generatedHandle = normalizeHandle(result.full_name);
        if (generatedHandle) {
          try {
            return await userService.updateProfile(userId, {
              handle: generatedHandle,
            });
          } catch (e) {
            console.error("[User Service] Failed to auto-generate handle:", e);
          }
        }
      }

      return result;
    });
  },

  async updateProfile(
    userId: string,
    updates: Partial<UserProfile>,
  ): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating profile:", error);
      throw error;
    }

    return data;
  },

  async isHandleAvailable(handle: string): Promise<boolean> {
    const { count, error } = await supabase
      .from("profiles")
      .select("handle", { count: "exact", head: true })
      .eq("handle", handle);

    if (error) return false;
    return count === 0;
  },
};
