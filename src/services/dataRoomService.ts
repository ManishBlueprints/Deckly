import { supabase } from "./supabase";
import { DataRoom, DataRoomDocument, Deck } from "../types";
import { withRetry } from "../utils/resilience";

async function resolveUserId(providedUserId?: string): Promise<string | null> {
  if (providedUserId) return providedUserId;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export const dataRoomService = {
  // ── CRUD ────────────────────────────────────────────────

  async createDataRoom(roomData: {
    name: string;
    slug: string;
    description?: string;
    icon_url?: string;
  }): Promise<DataRoom> {
    return withRetry(async () => {
      const userId = await resolveUserId();
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("data_rooms")
        .insert({
          ...roomData,
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DataRoom;
    });
  },

  async getDataRooms(providedUserId?: string): Promise<DataRoom[]> {
    return withRetry(async () => {
      const userId = await resolveUserId(providedUserId);
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

  async getDataRoomById(id: string): Promise<DataRoom | null> {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from("data_rooms")
        .select("*")
        .eq("id", id)
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
        .from("data_rooms_public")
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

  async deleteDataRoom(id: string): Promise<void> {
    return withRetry(async () => {
      const userId = await resolveUserId();
      if (!userId) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("data_rooms")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
    });
  },

  // ── DOCUMENT MANAGEMENT ─────────────────────────────────

  async getDocuments(roomId: string): Promise<DataRoomDocument[]> {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from("data_room_documents")
        .select("*, deck:decks(*)")
        .eq("data_room_id", roomId)
        .order("display_order", { ascending: true });

      if (error) throw error;

      return (data || []).map((d: DataRoomDocument & { deck?: Deck | null }) => ({
        ...d,
        deck: d.deck || undefined,
      })) as DataRoomDocument[];
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
    const userId = await resolveUserId();
    if (!userId) throw new Error("Not authenticated");

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

  async getDataRoomAnalytics(roomId: string): Promise<{
    totalVisitors: number;
    perDeck: { deckId: string; title: string; visitors: number }[];
  }> {
    return withRetry(async () => {
      const docs = await this.getDocuments(roomId);
      const deckIds = docs.map((d) => d.deck_id);

      if (deckIds.length === 0) {
        return { totalVisitors: 0, perDeck: [] };
      }

      const { data: viewData, error } = await supabase
        .from("deck_page_views")
        .select("deck_id, visitor_id")
        .in("deck_id", deckIds); // BROADENED: Include views outside this specifically tagged room for historical context

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
    const { data: docCounts } = await supabase
      .from("data_room_documents")
      .select("data_room_id")
      .in("data_room_id", roomIds);

    // Batch fetch visitor counts
    const { data: viewData } = await supabase
      .from("deck_page_views")
      .select("data_room_id, visitor_id")
      .in("data_room_id", roomIds);

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
      const userId = await resolveUserId();
      if (!userId) return true;

      let query = supabase
        .from("data_rooms")
        .select("id")
        .eq("user_id", userId)
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

  async getDataRoomPayload(slug: string, password?: string): Promise<Deck[]> {
    const { data, error } = await supabase.rpc("get_data_room_payload", {
      p_slug: slug,
      p_password: password || null,
    });
    if (error) throw error;
    return data as Deck[];
  },

  async getDataRoomBySlugOnly(
    slug: string,
  ): Promise<{ handle: string; slug: string } | null> {
    const { data, error } = await supabase
      .from("data_rooms_public")
      .select("user_handle, slug")
      .eq("slug", slug)
      .limit(1)
      .single();

    if (error || !data) return null;
    return { handle: data.user_handle, slug: data.slug };
  },
};
