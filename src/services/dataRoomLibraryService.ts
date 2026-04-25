import { supabase } from "./supabase";
import { getDeckSession } from "./deckService.shared";
import { withRetry } from "../utils/resilience";
import { DataRoom, SavedDataRoomOrganized } from "../types";
import { getRequiredSessionUserId } from "./authSession";

function buildRoomSnapshot(room: DataRoom, ownerHandle: string): Omit<
  SavedDataRoomOrganized,
  "library_id" | "folder_id" | "tags" | "saved_at" | "last_viewed_at" | "investor_note" | "is_available" | "is_deleted" | "updated_at"
> {
  return {
    data_room_id: room.id,
    title: room.name,
    slug: room.slug,
    room_handle: ownerHandle,
    room_owner_handle: ownerHandle,
    room_owner_id: room.user_id,
    description: room.description || null,
    expires_at: room.expires_at || null,
    require_email: !!room.require_email,
    require_password: !!room.require_password,
  };
}

export const dataRoomLibraryService = {
  async saveToLibrary(dataRoomId: string): Promise<void> {
    const session = await getDeckSession();
    if (!session) throw new Error("Not authenticated");

    const { data: room, error: roomError } = await supabase
      .from("data_rooms")
      .select("*")
      .eq("id", dataRoomId)
      .maybeSingle();

    if (roomError) throw roomError;
    if (!room) throw new Error("Room not found");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", room.user_id)
      .maybeSingle();

    if (profileError) throw profileError;

    const payload = {
      user_id: session.user.id,
      ...buildRoomSnapshot(room as DataRoom, profile?.handle || "unknown"),
      last_viewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("saved_data_rooms").upsert(payload, {
      onConflict: "user_id,data_room_id",
    });

    if (error) throw error;
  },

  async removeFromLibrary(dataRoomId: string): Promise<void> {
    const session = await getDeckSession();
    if (!session) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("saved_data_rooms")
      .delete()
      .eq("user_id", session.user.id)
      .eq("data_room_id", dataRoomId);

    if (error) throw error;
  },

  async isDataRoomSaved(dataRoomId: string): Promise<boolean> {
    const session = await getDeckSession();
    if (!session) return false;

    const { data, error } = await supabase
      .from("saved_data_rooms")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("data_room_id", dataRoomId)
      .maybeSingle();

    if (error) {
      console.error("Error checking if data room is saved:", error);
      return false;
    }

    return !!data;
  },

  async updateLibraryLastViewed(dataRoomId: string): Promise<void> {
    return withRetry(async () => {
      const session = await getDeckSession();
      if (!session) return;

      const { error } = await supabase
        .from("saved_data_rooms")
        .update({ last_viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", session.user.id)
        .eq("data_room_id", dataRoomId);

      if (error) throw error;
    });
  },

  async refreshRoomSnapshot(dataRoomId: string): Promise<void> {
    return withRetry(async () => {
      const userId = await getRequiredSessionUserId();
      const { data: room, error: roomError } = await supabase
        .from("data_rooms")
        .select("*")
        .eq("id", dataRoomId)
        .maybeSingle();

      if (roomError) throw roomError;
      if (!room) return;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", room.user_id)
        .maybeSingle();

      if (profileError) throw profileError;

      const { error } = await supabase
        .from("saved_data_rooms")
        .update({
          title: room.name,
          slug: room.slug,
          room_handle: profile?.handle || "unknown",
          room_owner_handle: profile?.handle || "unknown",
          room_owner_id: room.user_id,
          description: room.description || null,
          expires_at: room.expires_at || null,
          require_email: !!room.require_email,
          require_password: !!room.require_password,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("data_room_id", dataRoomId);

      if (error) throw error;
    });
  },

  async getSavedRooms(): Promise<SavedDataRoomOrganized[]> {
    return withRetry(async () => {
      const session = await getDeckSession();
      if (!session) return [];

      const { data, error } = await supabase
        .from("saved_data_rooms")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data || []) as Array<SavedDataRoomOrganized & { folder_id?: string | null }>;
      return rows.map((row) => ({
        ...row,
        folder_id: row.folder_id ?? null,
        tags: row.tags || [],
      }));
    });
  },
};
