import { supabase } from "./supabase";
import { DataRoom, DataRoomDocument } from "../types";
import { withRetry } from "../utils/resilience";
import { normalizeSlug } from "../utils/slug";

const roomsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60_000; // 1 minute

function getCached<T>(key: string): T | null {
  const cached = roomsCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: any) {
  roomsCache.set(key, { data, timestamp: Date.now() });
}

function invalidateCache(prefix?: string) {
  if (prefix) {
    for (const key of roomsCache.keys()) {
      if (key.startsWith(prefix)) roomsCache.delete(key);
    }
  } else {
    roomsCache.clear();
  }
}

async function resolveUserId(providedUserId?: string): Promise<string | null> {
  if (providedUserId) return providedUserId;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export const dataRoomService = {
  // ── CRUD ────────────────────────────────────────────────

  async createDataRoom(
    roomData: { name: string; slug: string; description?: string; icon_url?: string }
  ): Promise<DataRoom> {
    return withRetry(async () => {
      const userId = await resolveUserId();
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("data_rooms")
        .insert({
          user_id: userId,
          name: roomData.name,
          slug: normalizeSlug(roomData.slug),
          description: roomData.description || null,
          icon_url: roomData.icon_url || null,
        })
        .select()
        .single();

      if (error) throw error;
      invalidateCache("rooms:");
      return data as DataRoom;
    });
  },

  async getDataRooms(providedUserId?: string): Promise<DataRoom[]> {
    return withRetry(async () => {
      const userId = await resolveUserId(providedUserId);
      if (!userId) return [];

      const cacheKey = `rooms:${userId}`;
      const cached = getCached<DataRoom[]>(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from("data_rooms")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rooms = data as DataRoom[];
      setCache(cacheKey, rooms);
      return rooms;
    });
  },

  async getDataRoomById(id: string): Promise<DataRoom | null> {
    return withRetry(async () => {
      const cacheKey = `room:${id}`;
      const cached = getCached<DataRoom>(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from("data_rooms")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }
      setCache(cacheKey, data);
      return data as DataRoom;
    });
  },

  // Get single data room by handle and slug (uses public view to hide password)
  async getDataRoomByHandleAndSlug(handle: string, slug: string): Promise<DataRoom | null> {
    return withRetry(async () => {
      const cacheKey = `room:handle:${handle}:slug:${slug}`;
      const cached = getCached<DataRoom>(cacheKey);
      if (cached) return cached;

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
      setCache(cacheKey, data);
      return data as DataRoom;
    });
  },

  // NEW: Securely check data room password via RPC
  async checkDataRoomPassword(slug: string, password: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("check_data_room_password", {
      p_slug: slug,
      p_password: password,
    });
    if (error) throw error;
    return !!data;
  },

  async updateDataRoom(
    id: string,
    updates: Partial<Pick<DataRoom, "name" | "slug" | "description" | "icon_url" | "require_email" | "require_password" | "view_password" | "expires_at">>
  ): Promise<DataRoom> {
    return withRetry(async () => {
      const userId = await resolveUserId();
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("data_rooms")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      invalidateCache();
      return data as DataRoom;
    });
  },

  async deleteDataRoom(id: string): Promise<void> {
    return withRetry(async () => {
      const userId = await resolveUserId();
      if (!userId) throw new Error("Not authenticated");

      // Delete icon from storage if it exists
      const room = await dataRoomService.getDataRoomById(id);
      if (room?.icon_url) {
        try {
          const url = new URL(room.icon_url);
          const storagePath = url.pathname.split("/storage/v1/object/public/decks/")[1];
          if (storagePath) {
            await supabase.storage.from("decks").remove([storagePath]);
          }
        } catch { /* best effort */ }
      }

      const { error } = await supabase
        .from("data_rooms")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
      invalidateCache();
    });
  },

  // ── ICON UPLOAD ─────────────────────────────────────────

  async uploadRoomIcon(file: File): Promise<string> {
    return withRetry(async () => {
      const userId = await resolveUserId();
      if (!userId) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop() || "png";
      const path = `${userId}/room-icons/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("decks")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("decks").getPublicUrl(path);
      return urlData.publicUrl;
    });
  },

  // ── DOCUMENT MANAGEMENT ─────────────────────────────────

  async getDocuments(roomId: string): Promise<DataRoomDocument[]> {
    return withRetry(async () => {
      const cacheKey = `room-docs:${roomId}`;
      const cached = getCached<DataRoomDocument[]>(cacheKey);
      if (cached) return cached;

      const { data, error } = await supabase
        .from("data_room_documents")
        .select("*, deck:decks(*)")
        .eq("data_room_id", roomId)
        .order("display_order", { ascending: true });

      if (error) throw error;

      const docs = (data || []).map((d: any) => ({
        ...d,
        deck: d.deck || undefined,
      })) as DataRoomDocument[];

      setCache(cacheKey, docs);
      return docs;
    });
  },

  async addDocuments(roomId: string, deckIds: string[]): Promise<void> {
    return withRetry(async () => {
      // Get current max display order
      const existing = await dataRoomService.getDocuments(roomId);
      let maxOrder = existing.reduce((max, d) => Math.max(max, d.display_order), -1);

      const inserts = deckIds.map((deckId) => ({
        data_room_id: roomId,
        deck_id: deckId,
        display_order: ++maxOrder,
      }));

      const { error } = await supabase
        .from("data_room_documents")
        .upsert(inserts, { onConflict: "data_room_id,deck_id" });

      if (error) throw error;
      invalidateCache(`room-docs:${roomId}`);
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
      invalidateCache(`room-docs:${roomId}`);
    });
  },

  async reorderDocuments(roomId: string, orderedDeckIds: string[]): Promise<void> {
    return withRetry(async () => {
      const updates = orderedDeckIds.map((deckId, index) =>
        supabase
          .from("data_room_documents")
          .update({ display_order: index })
          .eq("data_room_id", roomId)
          .eq("deck_id", deckId)
      );

      await Promise.all(updates);
      invalidateCache(`room-docs:${roomId}`);
    });
  },

  // ── ANALYTICS AGGREGATION ───────────────────────────────

  async getDataRoomAnalytics(roomId: string): Promise<{ totalVisitors: number; perDeck: { deckId: string; title: string; visitors: number }[] }> {
    return withRetry(async () => {
      const cacheKey = `room-analytics:${roomId}`;
      const cached = getCached<any>(cacheKey);
      if (cached) return cached;

      const docs = await dataRoomService.getDocuments(roomId);
      const deckIds = docs.map((d) => d.deck_id);

      if (deckIds.length === 0) {
        const empty = { totalVisitors: 0, perDeck: [] };
        setCache(cacheKey, empty);
        return empty;
      }

      const { data: viewData } = await supabase
        .from("deck_page_views")
        .select("deck_id, visitor_id")
        .in("deck_id", deckIds);

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

      const result = { totalVisitors: allVisitors.size, perDeck };
      setCache(cacheKey, result);
      return result;
    });
  },

  // ── HELPERS ─────────────────────────────────────────────

  async getDocumentCount(roomId: string): Promise<number> {
    const { count, error } = await supabase
      .from("data_room_documents")
      .select("id", { count: "exact", head: true })
      .eq("data_room_id", roomId);

    if (error) return 0;
    return count || 0;
  },

  async checkSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
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

    const { data } = await query.maybeSingle();
    return !data;
  },
};
