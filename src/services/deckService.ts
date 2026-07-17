import { supabase } from "./supabase.ts";
import { deckBrandingService } from "./deckBrandingService.ts";
import { deckLibraryService } from "./deckLibraryService.ts";
import { deckStorageService } from "./deckStorageService.ts";
import {
  getDeckSession,
  getRequiredDeckUserId,
  extractStoragePath,
} from "./deckService.shared.ts";
import {
  BrandingSettings,
  Deck,
  DeckWithAnalytics,
  LibraryTag,
  SavedDeck,
  SlidePage,
} from "../types";
import { globalTagService } from "./globalTagService.ts";
import { withRetry } from "../utils/resilience.ts";
import { storageService } from "./storageService.ts";

const normalizeLibraryTag = (tag: LibraryTag | null | undefined): LibraryTag | null => {
  if (!tag) return null;

  return {
    ...tag,
    deleted_at: tag.deleted_at ?? null,
  };
};

const hydrateSignedDeckUrls = async (decks: Deck[]): Promise<Deck[]> => {
  const pathsToSign = new Set<string>();

  decks.forEach((deck) => {
    const mainPath = extractStoragePath(deck.file_url, "decks");
    if (mainPath) pathsToSign.add(mainPath);

    deck.pages?.forEach((page) => {
      const imagePath = extractStoragePath(page.image_url, "decks");
      if (imagePath) pathsToSign.add(imagePath);
    });
  });

  if (pathsToSign.size === 0) {
    return decks;
  }

  const { data: signedData, error: signError } = await storageService.createSignedUrls(
    "decks",
    Array.from(pathsToSign),
    3600,
  );

  if (signError || !signedData) {
    return decks;
  }

  const signedUrlMap = new Map<string, string>();
  signedData.forEach((item) => {
    if (item.path && item.signedUrl) {
      signedUrlMap.set(item.path, item.signedUrl);
    }
  });

  return decks.map((deck) => {
    const mainPath = extractStoragePath(deck.file_url, "decks");
    const signedFileUrl = mainPath ? signedUrlMap.get(mainPath) : null;

    return {
      ...deck,
      file_url: signedFileUrl ?? deck.file_url,
      pages: deck.pages?.map((page) => {
        const imagePath = extractStoragePath(page.image_url, "decks");
        const signedImageUrl = imagePath ? signedUrlMap.get(imagePath) : null;
        return signedImageUrl ? { ...page, image_url: signedImageUrl } : page;
      }) ?? [],
    };
  });
};

const hydrateSignedDeckThumbnails = async (decks: Deck[]): Promise<Deck[]> => {
  const thumbnailPaths = new Set<string>();

  decks.forEach((deck) => {
    const thumbnailPath = extractStoragePath(deck.pages?.[0]?.image_url, "decks");
    if (thumbnailPath) thumbnailPaths.add(thumbnailPath);
  });

  if (thumbnailPaths.size === 0) return decks;

  const { data: signedData, error: signError } = await storageService.createSignedUrls(
    "decks",
    Array.from(thumbnailPaths),
    3600,
  );

  if (signError || !signedData) return decks;

  const signedUrlMap = new Map<string, string>();
  signedData.forEach((item) => {
    if (item.path && item.signedUrl) signedUrlMap.set(item.path, item.signedUrl);
  });

  return decks.map((deck) => {
    const [firstPage, ...remainingPages] = deck.pages ?? [];
    const thumbnailPath = firstPage
      ? extractStoragePath(firstPage.image_url, "decks")
      : null;
    const signedThumbnailUrl = thumbnailPath
      ? signedUrlMap.get(thumbnailPath)
      : null;

    return signedThumbnailUrl && firstPage
      ? { ...deck, pages: [{ ...firstPage, image_url: signedThumbnailUrl }, ...remainingPages] }
      : deck;
  });
};

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
      return hydrateSignedDeckThumbnails(data as Deck[]);
    });
  },

  async getDecksByIds(
    deckIds: string[],
    providedUserId?: string,
  ): Promise<Deck[]> {
    return withRetry(async () => {
      const userId = providedUserId || (await getDeckSession())?.user.id;
      if (!userId || deckIds.length === 0) return [];

      const { data, error } = await supabase
        .from("decks")
        .select("*")
        .eq("user_id", userId)
        .in("id", deckIds);

      if (error) throw error;
      return hydrateSignedDeckUrls(data as Deck[]);
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
    const [deck] = await hydrateSignedDeckUrls([data as Deck]);
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

  async publishDeck(deckId: string, providedUserId?: string): Promise<Deck> {
    return this.updateDeck(deckId, { is_public: true }, providedUserId);
  },

  async unpublishDeck(deckId: string, providedUserId?: string): Promise<Deck> {
    return this.updateDeck(deckId, { is_public: false }, providedUserId);
  },

  async updateDeckTags(
    deckId: string,
    tagIds: string[],
    providedUserId?: string,
  ): Promise<void> {
    return withRetry(async () => {
      const userId = await getRequiredDeckUserId(providedUserId);
      const nextTagIds = Array.from(
        new Set(tagIds.map((tagId) => tagId.trim()).filter(Boolean)),
      );

      const ownedTags = await globalTagService.fetchTagsByIds(
        nextTagIds,
        userId,
        false,
      );
      if (ownedTags.length !== nextTagIds.length) {
        throw new Error("One or more tags were not found.");
      }

      const { error } = await supabase.rpc("reconcile_deck_tags", {
        p_deck_id: deckId,
        p_user_id: userId,
        p_tag_ids: nextTagIds,
      });

      if (error) throw error;
    });
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
  async getDeckByHandleAndSlug(
    handle: string,
    slugOrAlias: string,
  ): Promise<Deck> {
    const { data, error } = await supabase
      .rpc("get_decks_public", {
        p_handle: handle,
        p_slug_or_alias: slugOrAlias,
      })
      .single();

    if (error) throw error;
    return data as Deck;
  },

  async checkDeckPassword(
    handle: string | null,
    slugOrAlias: string,
    password: string,
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc("check_deck_password", {
      p_handle: handle,
      p_slug_or_alias: slugOrAlias,
      p_password: password,
    });
    if (error) throw error;
    return !!data;
  },

  async getDeckPayload(
    slugOrAlias: string,
    password?: string,
    handle?: string | null,
  ): Promise<{ file_url: string; signed_url?: string; expires_in?: number; pages: SlidePage[] }> {
    const { data, error } = await supabase.rpc("get_deck_payload", {
      p_handle: handle ?? null,
      p_slug_or_alias: slugOrAlias,
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
          handle: handle ?? null,
          slug: slugOrAlias,
          password: password ?? null, 
          storage_path: payload.storage_path,
          image_paths: imagePaths 
        },
      });

      if (fnError) throw fnError;

      if (fnData?.signed_url) {
        type SignedPageEntry = { path: string; signedUrl: string | null };
        const signedUrlMap = new Map<string, string>();
        const signedPages: unknown[] = Array.isArray(fnData.signed_pages) ? fnData.signed_pages : [];

        if (
          signedPages.length > 0 &&
          signedPages.every(
            (signed: unknown): signed is SignedPageEntry =>
              !!signed && typeof signed === "object" && "path" in signed && "signedUrl" in signed
          )
        ) {
          signedPages.forEach((signed: SignedPageEntry) => {
            if (signed.signedUrl) signedUrlMap.set(signed.path, signed.signedUrl);
          });
        } else if (signedPages.length > 0) {
          if (imagePaths.length !== signedPages.length) {
            console.error("sign-deck-url returned mismatched signed_pages length", {
              imagePaths,
              signed_pages: fnData.signed_pages,
            });
            throw new Error("Signed page URL response did not match requested image paths");
          }

          signedPages.forEach((signed: unknown, idx: number) => {
            if (typeof signed === "string") {
              signedUrlMap.set(imagePaths[idx], signed);
            } else if (
              signed &&
              typeof signed === "object" &&
              "path" in signed &&
              "signedUrl" in signed
            ) {
              const entry = signed as SignedPageEntry;
              if (entry.signedUrl) signedUrlMap.set(entry.path, entry.signedUrl);
            } else {
              console.warn(
                "[deckService] Invalid signedPages entry at index",
                idx,
                { entry: signed, imagePaths, signed_pages: fnData.signed_pages }
              );
              signedUrlMap.set(imagePaths[idx], null as unknown as string);
            }
          });
        }

        const hydratedPages = (payload.pages || []).map((page) => {
          const path = extractStoragePath(page.image_url, "decks");
          const signedUrl = path ? signedUrlMap.get(path) : null;
          return signedUrl ? { ...page, image_url: signedUrl } : page;
        });

        return { 
          ...payload, 
          signed_url: fnData.signed_url, 
          expires_in: fnData.expires_in as number | undefined,
          pages: hydratedPages
        };
      }
    }

    return payload;
  },

  async getDeckBySlugOnly(
    slug: string,
  ): Promise<{ handle: string; slug: string } | null> {
    const { data, error } = await supabase
      .rpc("get_decks_public", {
        p_handle: null,
        p_slug_or_alias: slug,
      })
      .select("user_handle, slug")
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
      const [tagLinksResult, statsResult, pageViewsResult, savesResult, deckLinksResult] = await Promise.all([
        supabase
          .from("decks")
          .select(`
            id,
            deck_tags (
              global_tags (*)
            )
          `)
          .eq("user_id", userId)
          .in("id", deckIds),
        supabase
          .from("deck_stats")
          .select("deck_id, updated_at")
          .in("deck_id", deckIds),
        supabase
          .from("deck_page_views")
          .select("deck_id, visitor_id")
          .in("deck_id", deckIds),
        supabase
          .from("investor_library")
          .select("deck_id")
          .in("deck_id", deckIds),
        supabase
          .from("deck_links")
          .select("deck_id, is_enabled")
          .in("deck_id", deckIds),
      ]);

      if (tagLinksResult.error) {
        console.warn("deck_tags lookup failed while hydrating Content Library", tagLinksResult.error);
      }

      const tagsByDeckId = new Map<string, LibraryTag[]>();
      (tagLinksResult.data || []).forEach((entry) => {
        const typedEntry = entry as unknown as {
          id: string;
          deck_tags?: { global_tags: LibraryTag }[];
        };
        const tags = (typedEntry.deck_tags || [])
          .map((link) => normalizeLibraryTag(link.global_tags))
          .filter((tag): tag is LibraryTag => Boolean(tag && tag.deleted_at === null));
        tagsByDeckId.set(typedEntry.id, tags);
      });

      let stats: { deck_id: string; updated_at: string | null }[] = [];
      if (statsResult.error) {
        console.warn("deck_stats lookup failed while hydrating Content Library", statsResult.error);
      } else {
        stats = (statsResult.data || []) as { deck_id: string; updated_at: string | null }[];
      }

      let pageViews: { deck_id: string; visitor_id: string }[] = [];
      if (pageViewsResult.error) {
        console.warn("deck_page_views lookup failed while hydrating Content Library", pageViewsResult.error);
      } else {
        pageViews = (pageViewsResult.data || []) as { deck_id: string; visitor_id: string }[];
      }

      let saves: { deck_id: string }[] = [];
      if (savesResult.error) {
        console.warn("investor_library lookup failed while hydrating Content Library", savesResult.error);
      } else {
        saves = (savesResult.data || []) as { deck_id: string }[];
      }

      let deckLinks: { deck_id: string; is_enabled: boolean }[] = [];
      if (deckLinksResult.error) {
        console.warn("deck_links lookup failed while hydrating Content Library", deckLinksResult.error);
      } else {
        deckLinks = (deckLinksResult.data || []) as {
          deck_id: string;
          is_enabled: boolean;
        }[];
      }

      const viewsMap: Record<string, Set<string>> = {};
      pageViews.forEach((pageView: { deck_id: string; visitor_id: string }) => {
        if (!viewsMap[pageView.deck_id]) viewsMap[pageView.deck_id] = new Set();
        viewsMap[pageView.deck_id].add(pageView.visitor_id);
      });

      const savesMap: Record<string, number> = {};
      saves.forEach((save: { deck_id: string }) => {
        savesMap[save.deck_id] = (savesMap[save.deck_id] || 0) + 1;
      });

      const lastActiveMap: Record<string, string | null> = {};
      stats.forEach((stat) => {
        const deckId = stat.deck_id;
        if (
          !lastActiveMap[deckId] ||
          (stat.updated_at && stat.updated_at > lastActiveMap[deckId]!)
        ) {
          lastActiveMap[deckId] = stat.updated_at;
        }
      });

      const totalLinkCountMap: Record<string, number> = {};
      const activeLinkCountMap: Record<string, number> = {};
      deckLinks.forEach((link) => {
        totalLinkCountMap[link.deck_id] = (totalLinkCountMap[link.deck_id] || 0) + 1;

        if (link.is_enabled) {
          activeLinkCountMap[link.deck_id] = (activeLinkCountMap[link.deck_id] || 0) + 1;
        }
      });

      return (decks as Deck[]).map((deck) => ({
        ...deck,
        active_link_count: activeLinkCountMap[deck.id] || 0,
        total_views: viewsMap[deck.id]?.size || 0,
        save_count: savesMap[deck.id] || 0,
        last_viewed_at: lastActiveMap[deck.id] || null,
        total_link_count: totalLinkCountMap[deck.id] || 0,
        tags: tagsByDeckId.get(deck.id) || [],
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

  /**
   * Batch signs the first page (thumbnail) for all decks owned by the caller.
   * Used by the dashboard to show private images securely.
   */
  async signOwnerThumbnails(): Promise<Record<string, string>> {
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_owner_thumbnails");
    
    if (rpcError) {
      console.error("RPC Error fetching owner thumbnails:", rpcError);
      return {};
    }

    // Validate RPC response structure
    if (!Array.isArray(rpcData)) {
      if (rpcData) console.warn("Unexpected RPC response format for thumbnails:", rpcData);
      return {};
    }

    const validPaths = rpcData.filter(p => 
      p && 
      typeof p.deck_id === "string" && 
      typeof p.storage_path === "string" &&
      p.storage_path.trim() !== ""
    ) as { deck_id: string; storage_path: string }[];

    if (validPaths.length === 0) return {};

    const storagePaths = validPaths.map(p => p.storage_path);

    const { data: signedData, error: fnError } = await supabase.functions.invoke("sign-deck-url", {
      body: { 
        image_paths: storagePaths 
      },
    });

    if (fnError || !Array.isArray(signedData?.signed_pages)) {
      console.error("Failed to sign owner thumbnails:", fnError);
      return {};
    }

    const urlMap: Record<string, string> = {};
    const signedPages = signedData.signed_pages as { path: string; signedUrl: string | null }[];
    
    // Optimization: Use a Map for O(1) lookups instead of nested find (O(n^2))
    const signedMap = new Map<string, string>();
    signedPages.forEach(p => {
      if (p.path && p.signedUrl) {
        signedMap.set(p.path, p.signedUrl);
      }
    });
    
    validPaths.forEach(item => {
      const signedUrl = signedMap.get(item.storage_path);
      if (signedUrl) {
        urlMap[item.deck_id] = signedUrl;
      }
    });

    return urlMap;
  },
};

export { deckBrandingService, deckLibraryService, deckStorageService };
