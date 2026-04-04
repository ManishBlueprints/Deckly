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

export function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const parts = publicUrl.split(marker);
  return parts.length > 1 ? parts[1] : null;
}
