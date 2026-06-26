import { supabase } from "./supabase.ts";
export { extractStoragePath, isStorageKey } from "./storagePaths.ts";

export async function getDeckSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

export { getRequiredSessionUserId as getRequiredDeckUserId } from "./authSession.ts";

export async function assertDeckOwnership(deckId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("decks")
    .select("id")
    .eq("id", deckId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Unauthorized");
  }
}

