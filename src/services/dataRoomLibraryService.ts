import { supabase } from "./supabase";
import { getDeckSession } from "./deckService.shared";
import { withRetry } from "../utils/resilience";
import { DataRoom, LibraryTag, SavedDataRoomOrganized } from "../types";
import { getRequiredSessionUserId } from "./authSession";

interface SavedDataRoomRow {
  id: string;
  user_id: string;
  data_room_id: string | null;
  folder_id: string | null;
  room_title: string;
  room_slug: string;
  room_handle: string | null;
  room_owner_id: string | null;
  room_owner_handle: string | null;
  description: string | null;
  expires_at: string | null;
  require_email: boolean;
  require_password: boolean;
  last_viewed_at: string | null;
  created_at?: string;
  updated_at: string;
}

function normalizeSavedRoomHandle(handle?: string | null): string | null {
  const trimmedHandle = handle?.trim();
  return trimmedHandle && trimmedHandle !== "unknown" ? trimmedHandle : null;
}

function normalizeSavedRoomTag(
  tag: LibraryTag | null | undefined,
): LibraryTag | null {
  if (!tag) return null;

  return {
    ...tag,
    deleted_at: tag.deleted_at ?? null,
  };
}

function buildRoomSnapshot(
  room: DataRoom,
  ownerHandle: string | null,
): Omit<
  SavedDataRoomRow,
  "id" | "user_id" | "folder_id" | "last_viewed_at" | "created_at" | "updated_at"
> {
  return {
    data_room_id: room.id,
    room_title: room.name,
    room_slug: room.slug,
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
  async saveToLibrary(
    dataRoomId: string,
    roomSnapshot?: DataRoom,
    ownerHandle?: string,
  ): Promise<void> {
    const session = await getDeckSession();
    if (!session) throw new Error("Not authenticated");

    const room = roomSnapshot
      ? roomSnapshot
      : await (async () => {
          const { data, error } = await supabase
            .from("data_rooms")
            .select("*")
            .eq("id", dataRoomId)
            .maybeSingle();

          if (error) throw error;
          if (!data) throw new Error("Room not found");
          return data as DataRoom;
        })();

    let resolvedHandle = ownerHandle?.trim() || null;
    if (!resolvedHandle) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", room.user_id)
        .maybeSingle();

      if (profileError) throw profileError;
      resolvedHandle = normalizeSavedRoomHandle(profile?.handle);
    }

    const payload = {
      user_id: session.user.id,
      ...buildRoomSnapshot(room, normalizeSavedRoomHandle(resolvedHandle)),
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

  async updateRoomFolder(savedRoomId: string, folderId: string | null): Promise<void> {
    const session = await getDeckSession();
    if (!session) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("saved_data_rooms")
      .update({
        folder_id: folderId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", savedRoomId)
      .eq("user_id", session.user.id);

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
      const resolvedHandle = normalizeSavedRoomHandle(profile?.handle);

      const { error } = await supabase
        .from("saved_data_rooms")
        .update({
          room_title: room.name,
          room_slug: room.slug,
          room_handle: resolvedHandle,
          room_owner_handle: resolvedHandle,
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

      const rows = (data || []) as Array<SavedDataRoomRow>;
      const roomIds = rows.map((row) => row.id);
      const ownerIdsToHydrate = Array.from(
        new Set(
          rows
            .filter(
              (row) =>
                row.room_owner_id &&
                (!row.room_owner_handle || row.room_owner_handle === "unknown"),
            )
            .map((row) => row.room_owner_id as string),
        ),
      );
      const ownerHandleById = new Map<string, string>();

      if (ownerIdsToHydrate.length > 0) {
        const { data: ownerProfiles, error: ownerProfilesError } = await supabase
          .from("profiles")
          .select("id, handle")
          .in("id", ownerIdsToHydrate);

        if (ownerProfilesError) throw ownerProfilesError;

        (ownerProfiles || []).forEach((profile) => {
          if (profile?.id && profile?.handle) {
            ownerHandleById.set(profile.id, profile.handle);
          }
        });
      }

      const tagMap = new Map<string, LibraryTag[]>();
      if (roomIds.length > 0) {
        const { data: roomTagRows, error: roomTagRowsError } = await supabase
          .rpc("get_saved_room_library_tags", {
            p_saved_room_ids: roomIds,
          })
          .select("saved_room_id, tags");

        if (roomTagRowsError) throw roomTagRowsError;

        (
          (Array.isArray(roomTagRows) ? roomTagRows : []) as {
            saved_room_id: string;
            tags: LibraryTag[] | null;
          }[]
        ).forEach((row) => {
          tagMap.set(
            row.saved_room_id,
            (row.tags || [])
              .map((tag) => normalizeSavedRoomTag(tag))
              .filter((tag): tag is LibraryTag => Boolean(tag && tag.deleted_at === null)),
          );
        });
      }

      return rows.map((row) => ({
        ...row,
        room_handle:
          normalizeSavedRoomHandle(row.room_handle) ||
          normalizeSavedRoomHandle(ownerHandleById.get(row.room_owner_id ?? "")) ||
          normalizeSavedRoomHandle(row.room_owner_handle),
        room_owner_handle:
          normalizeSavedRoomHandle(row.room_owner_handle) ||
          normalizeSavedRoomHandle(ownerHandleById.get(row.room_owner_id ?? "")) ||
          normalizeSavedRoomHandle(row.room_handle),
        library_id: row.id,
        data_room_id: row.data_room_id,
        title: row.room_title,
        slug: row.room_slug,
        room_owner_id: row.room_owner_id ?? row.user_id,
        folder_id: row.folder_id ?? null,
        tags: tagMap.get(row.id) || [],
        saved_at: row.created_at || row.updated_at,
        last_viewed_at: row.last_viewed_at,
        investor_note: null,
        description: row.description,
        is_available: true,
        is_deleted: false,
        expires_at: row.expires_at,
        require_email: row.require_email,
        require_password: row.require_password,
        updated_at: row.updated_at,
      }));
    });
  },
};
