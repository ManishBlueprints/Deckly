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
            // Find existing handles safely and smartly to get a likely free suffix
            const { data: existing } = await supabase
              .from("profiles")
              .select("handle")
              .ilike("handle", `${generatedHandle}%`);

            let suffix = 0;
            if (existing && existing.length > 0) {
              const taken = new Set(existing.map((e) => e.handle));
              while (
                taken.has(
                  suffix === 0
                    ? generatedHandle
                    : `${generatedHandle}${suffix}`,
                )
              ) {
                suffix++;
              }
            }

            // Wrapping the update in a bounded retry loop handles any TOCTOU unique violations
            let attempts = 0;
            let finalHandle = suffix === 0
              ? generatedHandle
              : `${generatedHandle}${suffix}`;

            while (attempts < 5) {
              try {
                return await userService.updateProfile(userId, {
                  handle: finalHandle,
                });
              } catch (updateError: unknown) {
                // 23505 is the PostgreSQL Unique Violation error code
                if ((updateError as { code?: string })?.code === "23505") {
                  suffix++;
                  finalHandle = `${generatedHandle}${suffix}`;
                  attempts++;
                } else {
                  throw updateError; // Unexpected error, break loop
                }
              }
            }
            console.warn(
              `[User Service] Could not generate unique handle for ${result.full_name}`,
            );
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
    options?: { suppressUniqueViolationLog?: boolean },
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
      // Only suppress logging for 23505 when the caller explicitly opts in
      // (e.g., the handle-generation retry loop). All other callers still log.
      const suppress = options?.suppressUniqueViolationLog === true &&
        error.code === "23505";
      if (!suppress) {
        console.error("Error updating profile:", error);
      }
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

  async getTotalUsers(): Promise<number> {
    const { data, error } = await supabase.rpc("get_total_system_users");
    if (error) {
      console.error("[User Service] Failed to get total users:", error);
      throw error;
    }
    return data ?? 0;
  },

  async deleteAccount(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("No active session. Please sign in again.");
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    if (!supabaseUrl) {
      throw new Error("Missing VITE_SUPABASE_URL environment variable.");
    }
    const functionUrl = `${supabaseUrl}/functions/v1/delete-account`;

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Account deletion failed (${response.status})`);
    }
  },
};
