import { supabase } from "./supabase";

export async function getDeckSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

export async function getRequiredDeckUserId(providedUserId?: string) {
  if (providedUserId) return providedUserId;

  const session = await getDeckSession();
  if (!session) throw new Error("Not authenticated");
  return session.user.id;
}

export function getDeckPublicStoragePath(fileUrl: string) {
  return fileUrl.split("/storage/v1/object/public/decks/")[1] || null;
}
