import { supabase } from "./supabase.ts";
export { extractStoragePath, isStorageKey } from "./storagePaths.ts";

export async function getDeckSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

export { getRequiredSessionUserId as getRequiredDeckUserId } from "./authSession.ts";
