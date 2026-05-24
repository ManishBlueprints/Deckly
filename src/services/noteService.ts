import { supabase } from "./supabase.ts";
import { getRequiredSessionUserId, getSessionUserId } from "./authSession.ts";
import { withRetry } from "../utils/resilience.ts";

export const noteService = {
  async getNote(deckId: string, providedUserId?: string): Promise<string> {
    const userId = await getSessionUserId(providedUserId);
    if (!userId) return "";

    const { data, error } = await supabase
      .from("investor_notes")
      .select("content")
      .eq("user_id", userId)
      .eq("deck_id", deckId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching note:", error);
      return "";
    }
    
    return data?.content || "";
  },

  async saveNote(deckId: string, content: string): Promise<void> {
    return withRetry(async () => {
      const userId = await getRequiredSessionUserId();
      const noteContent = content.slice(0, 1000);

      const { error } = await supabase
        .from("investor_notes")
        .upsert({
          user_id: userId,
          deck_id: deckId,
          content: noteContent,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id, deck_id" });

      if (error) throw error;
    });
  }
};
