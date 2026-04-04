import { supabase } from "./supabase";

export async function getDeckSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

export { getRequiredSessionUserId as getRequiredDeckUserId } from "./authSession";

export function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex === -1) return null;
  return publicUrl.substring(markerIndex + marker.length);
}
