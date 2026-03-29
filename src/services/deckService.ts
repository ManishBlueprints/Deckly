import { supabase } from "./supabase";
import { BrandingSettings, Deck, SlidePage, SavedDeck, DeckWithAnalytics } from "../types";
import { withRetry } from "../utils/resilience";

export const deckService = {
  // Get all decks for the logged-in user
  async getAllDecks(providedUserId?: string): Promise<Deck[]> {
    return withRetry(async () => {
      let userId = providedUserId;

      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];
        userId = session.user.id;
      }

      const { data, error } = await supabase
        .from("decks")
        .select("*")
        .eq("user_id", userId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as Deck[];
    });
  },

  // Get single deck by handle and slug (uses public view to hide password)
  async getDeckByHandleAndSlug(handle: string, slug: string): Promise<Deck> {
    const { data, error } = await supabase
      .from("decks_public")
      .select("*")
      .eq("slug", slug)
      .eq("user_handle", handle)
      .single();

    if (error) throw error;
    return data as Deck;
  },

  // NEW: Securely check deck password via RPC
  async checkDeckPassword(slug: string, password: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("check_deck_password", {
      p_slug: slug,
      p_password: password,
    });
    if (error) throw error;
    return !!data;
  },

  async getDeckPayload(
    slug: string,
    password?: string,
  ): Promise<{ file_url: string; pages: SlidePage[] }> {
    const { data, error } = await supabase.rpc("get_deck_payload", {
      p_slug: slug,
      p_password: password ?? null,
    });
    if (error) throw error;
    if (!data) throw new Error("Deck not found or access denied");
    return data as { file_url: string; pages: SlidePage[] };
  },
  // Get single deck by ID (management use)
  async getDeckById(id: string, providedUserId?: string): Promise<Deck> {
    let userId = providedUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      userId = session.user.id;
    }

    const { data, error } = await supabase
      .from("decks")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    return data as Deck;
  },

  // NEW: Upload a deck PDF
  async uploadDeck(file: File, deckData: Partial<Deck>): Promise<Deck> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const userId = session.user.id;

    const fileExt = file.name.split(".").pop();
    const normalizedSlug = deckData.slug ||
      file.name.split(".")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");
    const fileName =
      `${userId}/decks/${normalizedSlug}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("decks")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("decks").getPublicUrl(fileName);

    // Create deck record
    const { data: deckRecord, error: deckError } = await supabase
      .from("decks")
      .insert([
        {
          ...deckData,
          file_url: publicUrl,
          status: "PENDING",
          user_id: userId,
        },
      ])
      .select()
      .single();

    if (deckError) throw deckError;
    return deckRecord as Deck;
  },

  // Delete deck
  async deleteDeck(
    id: string,
    fileUrl: string,
    slug: string,
    providedUserId?: string,
  ): Promise<void> {
    let userId = providedUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      userId = session.user.id;
    }

    // 1. Delete the PDF file — must succeed before DB row is removed
    const urlParts = fileUrl.split("/storage/v1/object/public/decks/");
    const storagePath = urlParts[1];

    if (!storagePath) {
      console.warn(
        `[deckService.deleteDeck] Unexpected fileUrl format — could not parse storage path. ` +
          `Deck DB row will NOT be deleted to avoid orphaning data. fileUrl: ${fileUrl}`,
      );
      return; // Abort: do not remove the DB row if we can't clean up storage
    }

    await withRetry(async () => {
      const { error } = await supabase.storage.from("decks").remove([
        storagePath,
      ]);
      // Treat 404/ObjectNotFound as success — file is already gone
      if (
        error && !error.message?.includes("not found") &&
        error.message !== "Object not found"
      ) {
        throw error;
      }
    });

    // 2. Delete processed images — must succeed before DB row is removed
    await withRetry(async () => {
      const { data: files, error: listError } = await supabase.storage
        .from("decks")
        .list(`${userId}/deck-images/${slug}`);

      // 404 on the folder means no images exist — treat as success
      if (listError && !listError.message?.includes("not found")) {
        throw listError;
      }

      if (files && files.length > 0) {
        const filesToDelete = files.map(
          (f) => `${userId}/deck-images/${slug}/${f.name}`,
        );
        const { error: removeError } = await supabase.storage.from("decks")
          .remove(filesToDelete);
        if (removeError && !removeError.message?.includes("not found")) {
          throw removeError;
        }
      }
    });

    // 3. Delete from database — only reached if both storage steps above succeeded
    const { error } = await supabase
      .from("decks")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  },

  // NEW: Upload processing images
  async uploadSlideImages(
    userId: string,
    deckSlug: string,
    imageBlobs: Blob[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<string[]> {
    const imageUrls: string[] = new Array(imageBlobs.length);
    const timestamp = Date.now();
    const CONCURRENCY_LIMIT = 3;

    // Helper for a single upload with retry
    const uploadSingle = async (index: number) => {
      const fileName = `${userId}/deck-images/${deckSlug}/page-${
        index + 1
      }-${timestamp}.webp`;

      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          const { error } = await supabase.storage
            .from("decks")
            .upload(fileName, imageBlobs[index], {
              contentType: "image/webp",
              upsert: true,
            });

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage.from("decks")
            .getPublicUrl(fileName);
          imageUrls[index] = publicUrl;

          if (onProgress) {
            const completedCount = imageUrls.filter(Boolean).length;
            onProgress(completedCount, imageBlobs.length);
          }
          return;
        } catch (err) {
          attempts++;
          if (attempts === maxAttempts) throw err;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempts)); // Backoff
        }
      }
    };

    // Run in parallel with concurrency limit
    for (let i = 0; i < imageBlobs.length; i += CONCURRENCY_LIMIT) {
      const chunk = imageBlobs.slice(i, i + CONCURRENCY_LIMIT).map((_, idx) =>
        uploadSingle(i + idx)
      );
      await Promise.all(chunk);
    }

    return imageUrls;
  },

  // NEW: Update deck with processed pages (with ownership check)
  async updateDeckPages(
    deckId: string,
    pages: SlidePage[],
    providedUserId?: string,
  ): Promise<Deck> {
    let userId = providedUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      userId = session.user.id;
    }

    const { data, error } = await supabase
      .from("decks")
      .update({
        pages,
        status: "PROCESSED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", deckId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data as Deck;
  },

  // Update deck generic
  async updateDeck(
    deckId: string,
    updates: Partial<Deck>,
    providedUserId?: string,
  ): Promise<Deck> {
    let userId = providedUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      userId = session.user.id;
    }

    const { data, error } = await supabase
      .from("decks")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deckId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data as Deck;
  },

  // Get global branding settings (for the current user)
  async getBrandingSettings(
    providedUserId?: string,
  ): Promise<BrandingSettings | null> {
    const userId = providedUserId ||
      (await supabase.auth.getSession()).data.session?.user.id;
    if (!userId) return null;

    return withRetry(async () => {
      const { data, error } = await supabase
        .from("branding")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as BrandingSettings;
    });
  },

  // Update global branding settings
  async updateBrandingSettings(
    settings: Partial<BrandingSettings>,
    providedUserId?: string,
  ): Promise<BrandingSettings> {
    let userId = providedUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      userId = session.user.id;
    }

    // Get existing record if any
    const { data: existing } = await supabase
      .from("branding")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("branding")
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data as BrandingSettings;
    } else {
      const { data, error } = await supabase
        .from("branding")
        .insert([{ ...settings, user_id: userId }])
        .select()
        .single();
      if (error) throw error;

      return data as BrandingSettings;
    }
  },

  // NEW: Upload a branding logo/mascot
  async uploadLogo(file: File): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const userId = session.user.id;

    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/branding/logo-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(
      fileName,
    );
    return publicUrl;
  },

  // Get all decks with aggregated stats for Content management
  async getDecksWithAnalytics(providedUserId?: string): Promise<DeckWithAnalytics[]> {
    return withRetry(async () => {
      let userId = providedUserId;
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];
        userId = session.user.id;
      }

      // 1. Fetch decks
      const { data: decks, error: decksError } = await supabase
        .from("decks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (decksError) throw decksError;
      if (!decks || decks.length === 0) return [];

      const deckIds = decks.map((d) => d.id);

      // 2. Fetch stats, pageViews, and saves in parallel
      const [
        { data: stats, error: statsError },
        { data: pageViews },
        { data: saves, error: savesError },
      ] = await Promise.all([
        supabase.from("deck_stats").select("deck_id, updated_at").in(
          "deck_id",
          deckIds,
        ),
        supabase.from("deck_page_views").select("deck_id, visitor_id").in(
          "deck_id",
          deckIds,
        ),
        supabase.from("investor_library").select("deck_id").in(
          "deck_id",
          deckIds,
        ),
      ]);

      if (statsError) throw statsError;
      if (savesError) throw savesError;

      // Count unique visitors per deck
      const viewsMap: Record<string, Set<string>> = {};
      (pageViews || []).forEach(
        (pv: { deck_id: string; visitor_id: string }) => {
          if (!viewsMap[pv.deck_id]) viewsMap[pv.deck_id] = new Set();
          viewsMap[pv.deck_id].add(pv.visitor_id);
        },
      );

      // Count saves per deck
      const savesMap: Record<string, number> = {};
      (saves || []).forEach((s: { deck_id: string }) => {
        savesMap[s.deck_id] = (savesMap[s.deck_id] || 0) + 1;
      });

      // Find latest activity per deck
      const lastActiveMap: Record<string, string | null> = {};
      (stats || []).forEach((s) => {
        const id = s.deck_id;
        if (
          !lastActiveMap[id] ||
          (s.updated_at && s.updated_at > lastActiveMap[id]!)
        ) {
          lastActiveMap[id] = s.updated_at;
        }
      });

      // 4. Merge data
      return decks.map((deck) => ({
        ...deck,
        total_views: viewsMap[deck.id]?.size || 0,
        save_count: savesMap[deck.id] || 0,
        last_viewed_at: lastActiveMap[deck.id] || null,
      })) as DeckWithAnalytics[];
    });
  },

  // Helper for user-specific storage path
  async getStoragePath(slug: string, filename: string): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    return `${session.user.id}/${slug}/${filename}`;
  },

  // NEW: Save deck to investor library
  async saveToLibrary(deckId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("investor_library")
      .upsert({
        user_id: session.user.id,
        deck_id: deckId,
        last_viewed_at: new Date().toISOString(),
      }, { onConflict: "user_id,deck_id" });

    if (error) throw error;
  },

  // NEW: Remove deck from investor library
  async removeFromLibrary(deckId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("investor_library")
      .delete()
      .eq("user_id", session.user.id)
      .eq("deck_id", deckId);

    if (error) throw error;
  },

  // NEW: Check if deck is in library
  async isDeckSaved(deckId: string): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data, error } = await supabase
      .from("investor_library")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("deck_id", deckId)
      .maybeSingle();

    if (error) return false;
    return !!data;
  },

  // NEW: Get all saved decks for the logged-in user
  async getSavedDecks(): Promise<SavedDeck[]> {
    return withRetry(async () => {
      const { data: { session } } = await supabase.auth.getSession();
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

      // Extract unique user IDs from decks to fetch handles
      const ownerIds = [
        ...new Set(
          (data || []).map((item) => (item.deck as unknown as Deck).user_id),
        ),
      ];

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, handle")
        .in("id", ownerIds);

      if (profilesError) {
        console.error("Error fetching profiles for library:", profilesError);
      }

      const handlesMap = (profilesData || []).reduce((acc, curr) => {
        acc[curr.id] = curr.handle;
        return acc;
      }, {} as Record<string, string>);

      // Fetch notes for these decks in parallel
      const deckIds = (data || []).map((item) =>
        (item.deck as unknown as Deck).id
      );
      const { data: notesData, error: notesError } = await supabase
        .from("investor_notes")
        .select("deck_id, content")
        .eq("user_id", session.user.id)
        .in("deck_id", deckIds);

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

      // Flatten the response so it looks like an array of decks (with extra library metadata if needed)
      return (data || []).map((item) => {
        const deck = item.deck as unknown as Deck;
        return {
          ...deck,
          user_handle: handlesMap[deck.user_id] || "username",
          saved_at: item.created_at,
          last_viewed_at: item.last_viewed_at,
          library_id: item.id,
          investor_note: notesMap[deck.id] || "",
        };
      }) as SavedDeck[];
    });
  },

  // NEW: Update the last_viewed_at for a saved deck
  async updateLibraryLastViewed(deckId: string): Promise<void> {
    return withRetry(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("investor_library")
        .update({ last_viewed_at: new Date().toISOString() })
        .eq("user_id", session.user.id)
        .eq("deck_id", deckId);

      if (error) throw error;
    });
  },

  // NEW: Check if a slug is available for the current user
  async checkSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return true;

    let query = supabase
      .from("decks")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("slug", slug);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data } = await query.maybeSingle();
    return !data;
  },

  // NEW: Get deck by slug only
  async getDeckBySlugOnly(
    slug: string,
  ): Promise<{ handle: string; slug: string } | null> {
    const { data, error } = await supabase
      .from("decks_public")
      .select("user_handle, slug")
      .eq("slug", slug)
      .limit(1)
      .single();

    if (error || !data) return null;
    return { handle: data.user_handle, slug: data.slug };
  },
};
