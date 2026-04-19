import { supabase } from "./supabase";
import { deckBrandingService } from "./deckBrandingService";
import { deckLibraryService } from "./deckLibraryService";
import { deckStorageService } from "./deckStorageService";
import {
  getDeckSession,
  getRequiredDeckUserId,
  extractStoragePath,
} from "./deckService.shared";
import {
  BrandingSettings,
  Deck,
  DeckWithAnalytics,
  SavedDeck,
  SlidePage,
} from "../types";
import { withRetry } from "../utils/resilience";

const deckCrudService = {
  async getAllDecks(providedUserId?: string): Promise<Deck[]> {
    return withRetry(async () => {
      const userId = providedUserId || (await getDeckSession())?.user.id;
      if (!userId) return [];

      const { data, error } = await supabase
        .from("decks")
        .select("*")
        .eq("user_id", userId)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as Deck[];
    });
  },

  async getDeckById(id: string, providedUserId?: string): Promise<Deck> {
    const userId = await getRequiredDeckUserId(providedUserId);

    const { data, error } = await supabase
      .from("decks")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    const deck = data as Deck;

    // Because the decks bucket is PRIVATE, public URLs stored in the DB will 403.
    // If the owner is viewing their own deck, getDeckById is called instead of getDeckPayload.
    // We must use their authenticated session to hydrate the signed URLs via the Storage API.
    const pathsToSign: string[] = [];
    
    const mainPath = extractStoragePath(deck.file_url, "decks");
    if (mainPath) pathsToSign.push(mainPath);

    const imagePaths = (deck.pages || [])
      .map(p => extractStoragePath(p.image_url, "decks"))
      .filter((p): p is string => !!p);
    
    pathsToSign.push(...imagePaths);

    if (pathsToSign.length > 0) {
      const { data: signedData, error: signError } = await supabase.storage
        .from("decks")
        .createSignedUrls(pathsToSign, 3600);
      
      if (!signError && signedData) {
        const signedUrlMap = new Map<string, string>();
        signedData.forEach(d => {
          if (d.path && d.signedUrl) signedUrlMap.set(d.path, d.signedUrl);
        });

        if (mainPath && signedUrlMap.has(mainPath)) {
          deck.file_url = signedUrlMap.get(mainPath)!;
        }

        if (deck.pages) {
          deck.pages = deck.pages.map(page => {
            const pPath = extractStoragePath(page.image_url, "decks");
            const sUrl = pPath ? signedUrlMap.get(pPath) : null;
            return sUrl ? { ...page, image_url: sUrl } : page;
          });
        }
      }
    }

    return deck;
  },

  async uploadDeck(file: File, deckData: Partial<Deck>): Promise<Deck> {
    const lastDotIndex = file.name.lastIndexOf(".");
    const baseName = lastDotIndex > 0 ? file.name.slice(0, lastDotIndex) : file.name;
    const normalizedSlug =
      deckData.slug ||
      baseName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "") ||
      "untitled";
    const { userId, publicUrl } = await deckStorageService.uploadDeckFile(
      file,
      normalizedSlug,
    );

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

  async deleteDeck(
    id: string,
    fileUrl: string,
    slug: string,
    providedUserId?: string,
  ): Promise<{ dbDeleted: boolean; assetsDeleted: boolean; cleanupError?: Error }> {
    const userId = await getRequiredDeckUserId(providedUserId);
    const { error } = await supabase
      .from("decks")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Deck DB deletion failed; storage cleanup was not attempted.", {
        deckId: id,
        fileUrl,
        slug,
        userId,
        error,
      });
      throw error;
    }

    let cleanupError: unknown = null;
    try {
      await deckStorageService.deleteDeckAssets(
        fileUrl,
        slug,
        userId,
      );
    } catch (err) {
      cleanupError = err;
    }

    if (cleanupError) {
      console.error("Deck DB row deleted but asset cleanup failed.", {
        deckId: id,
        fileUrl,
        slug,
        userId,
        cleanupError,
      });
      return {
        dbDeleted: true,
        assetsDeleted: false,
        cleanupError: cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError)),
      };
    }

    return { dbDeleted: true, assetsDeleted: true };
  },

  async updateDeckPages(
    deckId: string,
    pages: SlidePage[],
    providedUserId?: string,
  ): Promise<Deck> {
    const userId = await getRequiredDeckUserId(providedUserId);

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

  async updateDeck(
    deckId: string,
    updates: Partial<Deck>,
    providedUserId?: string,
  ): Promise<Deck> {
    const userId = await getRequiredDeckUserId(providedUserId);

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

  async checkSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    const session = await getDeckSession();
    if (!session) return true;

    let query = supabase
      .from("decks")
      .select("id")
      .eq("slug", slug);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Error checking slug availability:", {
        slug,
        excludeId,
        userId: session.user.id,
        error,
      });
      throw new Error(
        `Failed to verify slug availability for "${slug}". Please try again.`,
      );
    }

    return !data;
  },
};

const deckPublicService = {
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
  ): Promise<{ file_url: string; signed_url?: string; expires_in?: number; pages: SlidePage[] }> {
    const { data, error } = await supabase.rpc("get_deck_payload", {
      p_slug: slug,
      p_password: password ?? null,
    });
    if (error) throw error;
    if (!data) throw new Error("Deck not found or access denied");

    const payload = data as { file_url: string; storage_path?: string; pages: SlidePage[] };

    // If the bucket is private and we have a storage path, fetch short-lived signed URLs.
    // This includes both the main document and any processed slide images.
    if (payload.storage_path) {
      const imagePaths = (payload.pages || [])
        .map((p) => extractStoragePath(p.image_url, "decks"))
        .filter((path): path is string => !!path);

      const { data: fnData, error: fnError } = await supabase.functions.invoke("sign-deck-url", {
        body: { 
          slug, 
          password: password ?? null, 
          storage_path: payload.storage_path,
          image_paths: imagePaths 
        },
      });

      if (fnError) throw fnError;

      if (fnData?.signed_url) {
        // Create a lookup map for faster, robust path-based URL replacement
        const signedUrlMap = new Map<string, string>();
        imagePaths.forEach((path, idx) => {
          const signed = fnData.signed_pages?.[idx];
          if (signed) signedUrlMap.set(path, signed);
        });

        const signedPages = (payload.pages || []).map((page) => {
          const path = extractStoragePath(page.image_url, "decks");
          const signedUrl = path ? signedUrlMap.get(path) : null;
          return signedUrl ? { ...page, image_url: signedUrl } : page;
        });

        return { 
          ...payload, 
          signed_url: fnData.signed_url, 
          expires_in: fnData.expires_in as number | undefined,
          pages: signedPages
        };
      }
    }

    return payload;
  },

  async getDeckBySlugOnly(
    slug: string,
  ): Promise<{ handle: string; slug: string } | null> {
    const { data, error } = await supabase
      .from("decks_public")
      .select("user_handle, slug")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return { handle: data.user_handle, slug: data.slug };
  },
};

const deckAnalyticsService = {
  async getDecksWithAnalytics(providedUserId?: string): Promise<DeckWithAnalytics[]> {
    return withRetry(async () => {
      const userId = providedUserId || (await getDeckSession())?.user.id;
      if (!userId) return [];

      const { data: decks, error: decksError } = await supabase
        .from("decks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (decksError) throw decksError;
      if (!decks || decks.length === 0) return [];

      const deckIds = decks.map((deck) => deck.id);
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

      const viewsMap: Record<string, Set<string>> = {};
      (pageViews || []).forEach((pageView: { deck_id: string; visitor_id: string }) => {
        if (!viewsMap[pageView.deck_id]) viewsMap[pageView.deck_id] = new Set();
        viewsMap[pageView.deck_id].add(pageView.visitor_id);
      });

      const savesMap: Record<string, number> = {};
      (saves || []).forEach((save: { deck_id: string }) => {
        savesMap[save.deck_id] = (savesMap[save.deck_id] || 0) + 1;
      });

      const lastActiveMap: Record<string, string | null> = {};
      (stats || []).forEach((stat) => {
        const deckId = stat.deck_id;
        if (
          !lastActiveMap[deckId] ||
          (stat.updated_at && stat.updated_at > lastActiveMap[deckId]!)
        ) {
          lastActiveMap[deckId] = stat.updated_at;
        }
      });

      return decks.map((deck) => ({
        ...deck,
        total_views: viewsMap[deck.id]?.size || 0,
        save_count: savesMap[deck.id] || 0,
        last_viewed_at: lastActiveMap[deck.id] || null,
      })) as DeckWithAnalytics[];
    });
  },
};

export const deckService = {
  ...deckCrudService,
  ...deckPublicService,
  ...deckAnalyticsService,
  uploadSlideImages: deckStorageService.uploadSlideImages,
  getStoragePath: deckStorageService.getStoragePath,
  getBrandingSettings:
    deckBrandingService.getBrandingSettings as (
      providedUserId?: string,
    ) => Promise<BrandingSettings | null>,
  updateBrandingSettings: deckBrandingService.updateBrandingSettings,
  uploadLogo: deckBrandingService.uploadLogo,
  saveToLibrary: deckLibraryService.saveToLibrary,
  removeFromLibrary: deckLibraryService.removeFromLibrary,
  isDeckSaved: deckLibraryService.isDeckSaved,
  getSavedDecks: deckLibraryService.getSavedDecks as () => Promise<SavedDeck[]>,
  updateLibraryLastViewed: deckLibraryService.updateLibraryLastViewed,
};

export { deckBrandingService, deckLibraryService, deckStorageService };
