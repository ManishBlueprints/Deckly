import { supabase } from "./supabase";
import { Deck, SavedDeck } from "../types";
import { withRetry } from "../utils/resilience";
import { getDeckSession } from "./deckService.shared";

export const deckLibraryService = {
  async saveToLibrary(deckId: string): Promise<void> {
    const session = await getDeckSession();
    if (!session) throw new Error("Not authenticated");

    const { error } = await supabase.from("investor_library").upsert(
      {
        user_id: session.user.id,
        deck_id: deckId,
        last_viewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,deck_id" },
    );

    if (error) throw error;
  },

  async removeFromLibrary(deckId: string): Promise<void> {
    const session = await getDeckSession();
    if (!session) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("investor_library")
      .delete()
      .eq("user_id", session.user.id)
      .eq("deck_id", deckId);

    if (error) throw error;
  },

  async isDeckSaved(deckId: string): Promise<boolean> {
    const session = await getDeckSession();
    if (!session) return false;

    const { data, error } = await supabase
      .from("investor_library")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("deck_id", deckId)
      .maybeSingle();

    if (error) {
      console.error("Error checking if deck is saved:", error);
      return false;
    }
    return !!data;
  },

  async getSavedDecks(): Promise<SavedDeck[]> {
    return withRetry(async () => {
      const session = await getDeckSession();
      if (!session) return [];

      const { data, error } = await supabase
        .from("investor_library")
        .select(`
          id,
          created_at,
          last_viewed_at,
          deck:decks (
            id,
            title,
            slug,
            description,
            file_url,
            pages,
            display_mode,
            file_type,
            status,
            created_at,
            updated_at,
            user_id
          )
        `)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const validData = (data || []).filter((item) => item.deck);

      const ownerIds = [
        ...new Set(
          validData.map((item) => (item.deck as unknown as Deck).user_id),
        ),
      ];

      const profilesResult = ownerIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from("profiles")
            .select("id, handle")
            .in("id", ownerIds);
      const { data: profilesData, error: profilesError } = profilesResult;

      if (profilesError) {
        console.error("Error fetching profiles for library:", profilesError);
      }

      const handlesMap = (profilesData || []).reduce((acc, curr) => {
        acc[curr.id] = curr.handle;
        return acc;
      }, {} as Record<string, string>);

      const deckIds = validData.map((item) =>
        (item.deck as unknown as Deck).id
      );
      const notesResult = deckIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from("investor_notes")
            .select("deck_id, content")
            .eq("user_id", session.user.id)
            .in("deck_id", deckIds);
      const { data: notesData, error: notesError } = notesResult;

      if (notesError) {
        console.error(
          "Error fetching notes for bookmarked library:",
          notesError,
        );
      }

      const notesMap = (notesData || []).reduce((acc, curr) => {
        acc[curr.deck_id] = curr.content;
        return acc;
      }, {} as Record<string, string>);

      return validData.map((item) => {
        const deck = item.deck as unknown as Deck;
        return {
          ...deck,
          user_handle: handlesMap[deck.user_id] || "Unknown",
          saved_at: item.created_at,
          last_viewed_at: item.last_viewed_at,
          library_id: item.id,
          investor_note: notesMap[deck.id] || "",
        };
      }) as SavedDeck[];
    });
  },

  async updateLibraryLastViewed(deckId: string): Promise<void> {
    return withRetry(async () => {
      const session = await getDeckSession();
      if (!session) return;

      const { error } = await supabase
        .from("investor_library")
        .update({ last_viewed_at: new Date().toISOString() })
        .eq("user_id", session.user.id)
        .eq("deck_id", deckId);

      if (error) throw error;
    });
  },
};
