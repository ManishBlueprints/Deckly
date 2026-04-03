import { supabase } from "./supabase";

export async function getSessionUserId(providedUserId?: string) {
  if (providedUserId) return providedUserId;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user?.id ?? null;
}

export async function getRequiredSessionUserId(providedUserId?: string) {
  const userId = await getSessionUserId(providedUserId);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}
