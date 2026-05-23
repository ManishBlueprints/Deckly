import { supabase } from "./supabase.ts";
import { getRequiredSessionUserId, getSessionUserId } from "./authSession.ts";
import { withRetry } from "../utils/resilience.ts";

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
      const noteContent = content.slice(0, 1000);

      const { error } = await supabase
        .from("saved_data_room_notes")
        .upsert(
          {
            user_id: userId,
            data_room_id: dataRoomId,
            content: noteContent,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,data_room_id" },
        );

      if (error) throw error;
    });
  },
};
