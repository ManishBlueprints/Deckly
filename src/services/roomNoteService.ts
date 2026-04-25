import { supabase } from "./supabase";
import { getRequiredSessionUserId, getSessionUserId } from "./authSession";
import { withRetry } from "../utils/resilience";

export const roomNoteService = {
  async getNote(dataRoomId: string, providedUserId?: string): Promise<string> {
    const userId = await getSessionUserId(providedUserId);
    if (!userId) return "";

    const { data, error } = await supabase
      .from("saved_data_room_notes")
      .select("content")
      .eq("user_id", userId)
      .eq("data_room_id", dataRoomId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching room note:", error);
      return "";
    }

    return data?.content || "";
  },

  async saveNote(dataRoomId: string, content: string): Promise<void> {
    return withRetry(async () => {
      const userId = await getRequiredSessionUserId();

      const { error } = await supabase
        .from("saved_data_room_notes")
        .upsert(
          {
            user_id: userId,
            data_room_id: dataRoomId,
            content,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,data_room_id" },
        );

      if (error) throw error;
    });
  },
};
