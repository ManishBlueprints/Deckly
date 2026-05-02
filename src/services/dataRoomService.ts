import { supabase } from "./supabase";
import { getRequiredSessionUserId, getSessionUserId } from "./authSession";
import {
  DataRoom,
  DataRoomDocument,
  DataRoomDocumentSearchSummary,
  DataRoomTag,
  Deck,
} from "../types";
import { withRetry } from "../utils/resilience";
import { extractStoragePath } from "./deckService.shared";

const normalizeDataRoomTag = (
  tag: DataRoomTag | null | undefined,
): DataRoomTag | null => {
  if (!tag) return null;

  return {
    ...tag,
    deleted_at: tag.deleted_at ?? null,
  };
};

export const dataRoomService = {
  // ── CRUD ────────────────────────────────────────────────

  async createDataRoom(roomData: {
    name: string;
    slug: string;
    description?: string;
    icon_url?: string;
    require_email?: boolean;
    require_password?: boolean;
    view_password?: string;
    expires_at?: string | null;
  }): Promise<DataRoom> {
    return withRetry(async () => {
      const userId = await getRequiredSessionUserId();

      const { data, error } = await supabase
        .from("data_rooms")
        .insert({
          ...roomData,
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        console.error("[dataRoomService] createDataRoom failed:", error);
        throw error;
      }
      return data as DataRoom;
    });
  },

  async getDataRooms(providedUserId?: string): Promise<DataRoom[]> {
    return withRetry(async () => {
      const userId = await getSessionUserId(providedUserId);
      if (!userId) return [];

      const { data, error } = await supabase
        .from("data_rooms")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DataRoom[];
    });
  },

  async getDataRoomById(
    id: string,
    providedUserId?: string,
  ): Promise<DataRoom | null> {
    return withRetry(async () => {
      const userId = await getRequiredSessionUserId(providedUserId);

      const { data, error } = await supabase
        .from("data_rooms")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }
      return data as DataRoom;
    });
  },

  async getDataRoomByHandleAndSlug(
    handle: string,
    slug: string,
  ): Promise<DataRoom | null> {
    return withRetry(async () => {
      const { data, error } = await supabase
        .rpc("get_data_rooms_public")
        .select("*")
        .eq("slug", slug)
        .eq("user_handle", handle)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data as DataRoom;
    });
  },

  async updateDataRoom(
    id: string,
    updates: Partial<DataRoom>,
  ): Promise<DataRoom> {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from("data_rooms")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as DataRoom;
    });
  },

  async publishDataRoom(id: string): Promise<DataRoom> {
    return this.updateDataRoom(id, { is_public: true });
  },

  async unpublishDataRoom(id: string): Promise<DataRoom> {
    return this.updateDataRoom(id, { is_public: false });
  },

  async deleteDataRoom(id: string): Promise<void> {
    return withRetry(async () => {
      const userId = await getRequiredSessionUserId();

      const { error } = await supabase
        .from("data_rooms")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
    });
  },

  // ── DOCUMENT MANAGEMENT ─────────────────────────────────

  async getDocumentSearchSummaries(
    roomId: string,
  ): Promise<DataRoomDocumentSearchSummary[]> {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from("data_room_documents")
        .select(`
          id,
          deck:decks (
            title
          ),
          data_room_document_tags (
            global_tags (
              id,
              name,
              color,
              deleted_at
            )
          )
        `)
        .eq("data_room_id", roomId)
        .order("display_order", { ascending: true });

      if (error) throw error;

      return ((data || []) as Record<string, unknown>[]).map((document) => {
        const rawDeck = document.deck;
        const deck =
          Array.isArray(rawDeck)
            ? (rawDeck[0] as Record<string, unknown> | undefined)
            : rawDeck && typeof rawDeck === "object"
              ? (rawDeck as Record<string, unknown>)
              : undefined;
        const rawDocumentTagLinks = Array.isArray(document.data_room_document_tags)
          ? document.data_room_document_tags
          : [];
        const tags = rawDocumentTagLinks
          .map((link) => {
            const rawGlobalTags =
              link && typeof link === "object" && "global_tags" in link
                ? (link as { global_tags?: unknown }).global_tags
                : undefined;
            const globalTag = Array.isArray(rawGlobalTags) ? rawGlobalTags[0] : rawGlobalTags;
            return globalTag && typeof globalTag === "object"
              ? normalizeDataRoomTag(globalTag as DataRoomTag)
              : null;
          })
          .filter((tag): tag is DataRoomTag => Boolean(tag && tag.deleted_at === null));

        return {
          id: String(document.id),
          deck:
            typeof deck?.title === "string"
              ? { title: deck.title }
              : undefined,
          tags,
        };
      });
    });
  },

  async getDocuments(roomId: string, options?: { signUrls?: boolean }): Promise<DataRoomDocument[]> {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from("data_room_documents")
        .select(`
          *,
          deck:decks (
            *
          ),
          data_room_document_tags (
            global_tags (*)
          )
        `)
        .eq("data_room_id", roomId)
        .order("display_order", { ascending: true });

      if (error) throw error;

      const documents = (data || []).map((d: DataRoomDocument & { deck?: Deck | null }) => ({
        ...d,
        deck: d.deck || undefined,
      })) as DataRoomDocument[];

      documents.forEach((doc) => {
        const documentTagLinks = (
          doc as DataRoomDocument & {
            data_room_document_tags?: { global_tags?: DataRoomTag | DataRoomTag[] | null }[];
          }
        ).data_room_document_tags || [];
        const tags = documentTagLinks
          .map((link) => {
            const globalTag = Array.isArray(link.global_tags)
              ? link.global_tags[0]
              : link.global_tags;
            return normalizeDataRoomTag(globalTag);
          })
          .filter((tag): tag is DataRoomTag => Boolean(tag && tag.deleted_at === null));
        doc.tags = tags;
      });

      // Hydrate signed URLs only when explicitly requested
      if (options?.signUrls) {
        const allPaths: string[] = [];
        documents.forEach(doc => {
          if (!doc.deck) return;
          const mainPath = extractStoragePath(doc.deck.file_url, "decks");
          if (mainPath) allPaths.push(mainPath);
          
          const pages = Array.isArray(doc.deck.pages) ? doc.deck.pages : [];
          pages.forEach(p => {
            const pPath = extractStoragePath(p.image_url, "decks");
            if (pPath) allPaths.push(pPath);
          });
        });

        if (allPaths.length > 0) {
          const { data: signedUrls, error: signError } = await supabase.storage
            .from("decks")
            .createSignedUrls(allPaths, 3600);
          
          if (signError) {
            console.error("[dataRoomService] Failed to sign URLs for owner:", signError);
          } else if (signedUrls) {
            const urlMap = new Map(signedUrls.map(s => [s.path, s.signedUrl]));
            
            documents.forEach(doc => {
              if (!doc.deck) return;
              const mainPath = extractStoragePath(doc.deck.file_url, "decks");
              if (mainPath && urlMap.has(mainPath)) {
                doc.deck.file_url = urlMap.get(mainPath)!;
              }
              
              if (Array.isArray(doc.deck.pages)) {
                doc.deck.pages = doc.deck.pages.map(p => {
                  const pPath = extractStoragePath(p.image_url, "decks");
                  if (pPath && urlMap.has(pPath)) {
                    return { ...p, image_url: urlMap.get(pPath)! };
                  }
                  return p;
                });
              }
            });
          }
        }
      }

      return documents;
    });
  },

  async addDocuments(roomId: string, deckIds: string[]): Promise<void> {
    return withRetry(async () => {
      const count = await this.getDocumentCount(roomId);

      const inserts = deckIds.map((deckId, index) => ({
        data_room_id: roomId,
        deck_id: deckId,
        display_order: count + index,
      }));

      const { error } = await supabase.from("data_room_documents").insert(
        inserts,
      );
      if (error) throw error;
    });
  },

  async removeDocument(roomId: string, deckId: string): Promise<void> {
    return withRetry(async () => {
      const { error } = await supabase
        .from("data_room_documents")
        .delete()
        .eq("data_room_id", roomId)
        .eq("deck_id", deckId);

      if (error) throw error;
    });
  },

  async reorderDocuments(
    roomId: string,
    orderedDeckIds: string[],
  ): Promise<void> {
    return withRetry(async () => {
      const updates = orderedDeckIds.map((deckId, index) =>
        supabase
          .from("data_room_documents")
          .update({ display_order: index })
          .eq("data_room_id", roomId)
          .eq("deck_id", deckId)
      );

      await Promise.all(updates);
    });
  },

  async getDocumentCount(roomId: string): Promise<number> {
    const { count, error } = await supabase
      .from("data_room_documents")
      .select("*", { count: "exact", head: true })
      .eq("data_room_id", roomId);

    if (error) throw error;
    return count || 0;
  },

  // ── ASSETS ──────────────────────────────────────────────

  async uploadRoomIcon(file: File): Promise<string> {
    const userId = await getRequiredSessionUserId();

    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/room-icons/icon-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("assets").getPublicUrl(fileName);
    return data.publicUrl;
  },

  // ── ANALYTICS DASHBOARD ───────────────────────────────────────────

  async getDataRoomAnalytics(
    roomId: string,
    documents?: DataRoomDocument[],
  ): Promise<{
    totalVisitors: number;
    perDeck: { deckId: string; title: string; visitors: number }[];
  }> {
    return withRetry(async () => {
      const docs = documents ?? await this.getDocuments(roomId, { signUrls: false });
      const deckIds = docs.map((d) => d.deck_id);

      if (deckIds.length === 0) {
        return { totalVisitors: 0, perDeck: [] };
      }

      const { data: viewData, error } = await supabase
        .from("deck_page_views")
        .select("deck_id, visitor_id")
        .in("deck_id", deckIds)
        .eq("data_room_id", roomId); // Scoped to this room for accurate per-room visitor counts

      if (error) throw error;

      const allVisitors = new Set<string>();
      const visitorsByDeck = new Map<string, Set<string>>();

      for (const row of viewData || []) {
        allVisitors.add(row.visitor_id);
        if (!visitorsByDeck.has(row.deck_id)) {
          visitorsByDeck.set(row.deck_id, new Set());
        }
        visitorsByDeck.get(row.deck_id)!.add(row.visitor_id);
      }

      const perDeck = docs.map((d) => ({
        deckId: d.deck_id,
        title: d.deck?.title || "Untitled",
        visitors: visitorsByDeck.get(d.deck_id)?.size || 0,
      }));

      return { totalVisitors: allVisitors.size, perDeck };
    });
  },

  // ── BATCH ANALYTICS (N+1 optimization) ────────────────────────────

  async getBatchDataRoomAnalytics(
    roomIds: string[]
  ): Promise<Map<string, { docCount: number; visitors: number }>> {
    try {
      // Try RPC first (requires get_batch_data_room_analytics function in Supabase)
      const { data, error } = await supabase.rpc("get_batch_data_room_analytics", {
        p_room_ids: roomIds,
      });

      if (error) {
        console.warn(
          "RPC get_batch_data_room_analytics not available, using fallback:", error.message
        );
        return this._getBatchDataRoomAnalyticsFallback(roomIds);
      }

      // Convert array to Map for easy lookup
      const results = new Map<string, { docCount: number; visitors: number }>();
      for (const item of data || []) {
        results.set(item.room_id, {
          docCount: item.doc_count,
          visitors: item.visitors,
        });
      }
      return results;
    } catch (err) {
      console.warn("Error in getBatchDataRoomAnalytics, using fallback:", err);
      return this._getBatchDataRoomAnalyticsFallback(roomIds);
    }
  },

  // Fallback: client-side aggregation (less efficient)
  async _getBatchDataRoomAnalyticsFallback(
    roomIds: string[]
  ): Promise<Map<string, { docCount: number; visitors: number }>> {
    const results = new Map<string, { docCount: number; visitors: number }>();

    // Batch fetch document counts
    const { data: docCounts, error: docCountsError } = await supabase
      .from("data_room_documents")
      .select("data_room_id")
      .in("data_room_id", roomIds);

    if (docCountsError) {
      console.error("[dataRoomService] Failed to fetch document counts:", docCountsError);
      throw docCountsError;
    }

    // Batch fetch visitor counts
    const { data: viewData, error: viewDataError } = await supabase
      .from("deck_page_views")
      .select("data_room_id, visitor_id")
      .in("data_room_id", roomIds);

    if (viewDataError) {
      console.error("[dataRoomService] Failed to fetch visitor data:", viewDataError);
      throw viewDataError;
    }

    // Aggregate document counts
    const docCountMap = new Map<string, number>();
    for (const row of docCounts || []) {
      const count = docCountMap.get(row.data_room_id) || 0;
      docCountMap.set(row.data_room_id, count + 1);
    }

    // Aggregate visitor counts
    const visitorMap = new Map<string, Set<string>>();
    for (const row of viewData || []) {
      if (row.data_room_id) {
        if (!visitorMap.has(row.data_room_id)) {
          visitorMap.set(row.data_room_id, new Set());
        }
        visitorMap.get(row.data_room_id)!.add(row.visitor_id);
      }
    }

    // Build results
    for (const roomId of roomIds) {
      results.set(roomId, {
        docCount: docCountMap.get(roomId) || 0,
        visitors: visitorMap.get(roomId)?.size || 0,
      });
    }

    return results;
  },

  // ── UTILS ───────────────────────────────────────────────

  async checkSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    return withRetry(async () => {
      const userId = await getSessionUserId();
      if (!userId) return true;

      let query = supabase
        .from("data_rooms")
        .select("id")
        .eq("slug", slug);

      if (excludeId) {
        query = query.neq("id", excludeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data?.length || 0) === 0;
    });
  },

  async checkDataRoomPassword(
    slug: string,
    password: string,
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc("check_data_room_password", {
      p_slug: slug,
      p_password: password,
    });
    if (error) throw error;
    return !!data;
  },

  async getDataRoomPayload(
    slug: string,
    password?: string,
  ): Promise<(Deck & { folder_id?: string | null; folder_name?: string | null })[]> {
    const { data: rawData, error } = await supabase.rpc("get_data_room_payload", {
      p_slug: slug,
      p_password: password || null,
    });
    if (error) throw error;
    if (!rawData) return [];

    const decks = rawData as (Deck & {
      storage_path?: string;
      folder_id?: string | null;
      folder_name?: string | null;
    })[];

    // Hydrate signed URLs for guests via the sign-deck-url Edge Function
    const allPaths: string[] = [];
    decks.forEach(deck => {
      // Collect main file path for signing
      const filePath = extractStoragePath(deck.file_url, "decks");
      if (filePath) allPaths.push(filePath);

      // Collect slide image paths
      const pages = Array.isArray(deck.pages) ? deck.pages : [];
      pages.forEach(p => {
        const pPath = extractStoragePath(p.image_url, "decks");
        if (pPath) allPaths.push(pPath);
      });
    });

    if (allPaths.length > 0) {
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke("sign-deck-url", {
          body: { 
            room_slug: slug, 
            password: password ?? null, 
            image_paths: allPaths 
          },
        });

        if (!fnError && fnData?.signed_pages) {
          const signedUrlMap = new Map<string, string>();
          const signedPages = (Array.isArray(fnData.signed_pages) ? fnData.signed_pages : []) as { path: string; signedUrl: string | null }[];
          
          signedPages.forEach((signed) => {
            if (signed?.path && signed?.signedUrl) {
              signedUrlMap.set(signed.path, signed.signedUrl);
            }
          });

          decks.forEach(deck => {
            // Remap main file URL
            const fPath = extractStoragePath(deck.file_url, "decks");
            const signedFileUrl = fPath ? signedUrlMap.get(fPath) : null;
            if (signedFileUrl) {
              deck.file_url = signedFileUrl;
            }

            // Remap individual pages
            if (Array.isArray(deck.pages)) {
              deck.pages = deck.pages.map(p => {
                const path = extractStoragePath(p.image_url, "decks");
                const signedUrl = path ? signedUrlMap.get(path) : null;
                return signedUrl ? { ...p, image_url: signedUrl } : p;
              });
            }
          });
        }
      } catch (err) {
        console.error("[dataRoomService] sign-deck-url invocation failed:", err);
        throw err;
      }
    }

    return decks;
  },

  async getDataRoomBySlugOnly(
    slug: string,
  ): Promise<{ handle: string; slug: string } | null> {
    const { data, error } = await supabase
      .rpc("get_data_rooms_public")
      .select("user_handle, slug")
      .eq("slug", slug)
      .limit(1)
      .single();

    if (error || !data) return null;
    return { handle: data.user_handle, slug: data.slug };
  },
};
