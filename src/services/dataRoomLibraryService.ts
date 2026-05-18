import { supabase } from "./supabase";
import { getDeckSession } from "./deckService.shared";
import { withRetry } from "../utils/resilience";
import { DataRoom, LibraryTag, SavedDataRoomOrganized } from "../types";
import { getRequiredSessionUserId } from "./authSession";
import { globalTagService } from "./globalTagService";

interface SavedDataRoomRow {
  id: string;
  user_id: string;
  data_room_id: string | null;
  folder_id: string | null;
  room_title: string;
  room_slug: string;
  room_handle: string;
  room_owner_id: string | null;
  room_owner_handle: string;
  description: string | null;
  expires_at: string | null;
  require_email: boolean;
  require_password: boolean;
  last_viewed_at: string | null;
  created_at?: string;
  updated_at: string;
}

interface SavedDataRoomTagLinkRow {
  saved_room_id: string;
  tag_id: string;
}

function buildRoomSnapshot(
  room: DataRoom,
  ownerHandle: string,
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
      resolvedHandle = profile?.handle || null;
    }

    const payload = {
      user_id: session.user.id,
      ...buildRoomSnapshot(room, resolvedHandle || "unknown"),
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

  async updateRoomTags(savedRoomId: string, tagIds: string[]): Promise<void> {
    const session = await getDeckSession();
    if (!session) throw new Error("Not authenticated");

    const uniqueTagIds = Array.from(
      new Set(tagIds.map((tagId) => tagId.trim()).filter(Boolean)),
    );

    const ownedTags = await globalTagService.fetchTagsByIds(uniqueTagIds, session.user.id, false);
    if (ownedTags.length !== uniqueTagIds.length) {
      throw new Error("One or more tags were not found.");
    }

    const { error: deleteError } = await supabase
      .from("library_data_room_tags")
      .delete()
      .eq("saved_room_id", savedRoomId);

    if (deleteError) throw deleteError;

    if (uniqueTagIds.length === 0) return;

    const rows = uniqueTagIds.map((tagId) => ({
      saved_room_id: savedRoomId,
      tag_id: tagId,
    }));

    const { error: insertError } = await supabase
      .from("library_data_room_tags")
      .insert(rows);

    if (insertError) throw insertError;
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
      const resolvedHandle = profile?.handle || null;

      const { error } = await supabase
        .from("saved_data_rooms")
        .update({
          room_title: room.name,
          room_slug: room.slug,
          room_handle: resolvedHandle || "unknown",
          room_owner_handle: resolvedHandle || "unknown",
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
        const { data: tagLinks, error: tagLinksError } = await supabase
          .from("library_data_room_tags")
          .select("saved_room_id, tag_id")
          .in("saved_room_id", roomIds);

        if (tagLinksError) throw tagLinksError;

        const links = (tagLinks || []) as SavedDataRoomTagLinkRow[];
        const tagIds = [...new Set(links.map((link) => link.tag_id))];

        if (tagIds.length > 0) {
          const tags = await globalTagService.fetchTagsByIds(tagIds, session.user.id, false);
          const tagsById = new Map<string, LibraryTag>();
          tags.forEach((tag) => {
            tagsById.set(tag.id, tag);
          });

          links.forEach((link) => {
            const tag = tagsById.get(link.tag_id);
            if (!tag) return;
            const current = tagMap.get(link.saved_room_id) || [];
            current.push(tag);
            tagMap.set(link.saved_room_id, current);
          });
        }
      }

      return rows.map((row) => ({
        ...row,
        room_handle:
          row.room_handle && row.room_handle !== "unknown"
            ? row.room_handle
            : ownerHandleById.get(row.room_owner_id ?? "") ||
              row.room_owner_handle ||
              row.room_handle,
        room_owner_handle:
          row.room_owner_handle && row.room_owner_handle !== "unknown"
            ? row.room_owner_handle
            : ownerHandleById.get(row.room_owner_id ?? "") ||
              row.room_owner_handle ||
              row.room_handle,
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
