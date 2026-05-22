import { supabase } from "./supabase.ts";

/**
 * Retrieves the current session user ID.
 * 
 * @param providedUserId - Optional user ID to bypass session validation. 
 * IMPORTANT: This parameter assumes the caller has already validated the user ID 
 * from a trusted, server-side source (e.g., middleware or authenticated context).
 * Bypassing session validation can have security implications if untrusted data is passed.
 * 
 * @returns The user ID string or null if no session exists.
 * @throws Error if the session retrieval fails.
 */
export async function getSessionUserId(providedUserId?: string) {
  if (providedUserId) return providedUserId;

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Error retrieving session user ID:", error);
    throw error;
  }

  return session?.user?.id ?? null;
}

export async function getRequiredSessionUserId(providedUserId?: string) {
  const userId = await getSessionUserId(providedUserId);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}
