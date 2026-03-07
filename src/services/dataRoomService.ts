import { supabase } from "./supabase";
import { DataRoom, DataRoomDocument } from "../types";
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

      return (data || []).map((d: any) => ({
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
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const filePath = `room-icons/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("assets").getPublicUrl(filePath);
    return data.publicUrl;
  },

  // ── ANALYTICS ───────────────────────────────────────────

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
        .in("deck_id", deckIds);

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
