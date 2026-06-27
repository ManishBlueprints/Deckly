import posthog from "posthog-js";
import { withRetry } from "../utils/resilience.ts";
import { supabase } from "./supabase.ts";
import { assertDeckOwnership } from "./deckService.shared.ts";
import { Deck, DeckPageStats } from "../types";
import { getTierConfig } from "../constants/tiers.ts";
import type { AiScopeType } from "./aiScopeResolutionBuilder.ts";

// Note: posthog.init is handled globally in main.tsx via PostHogProvider
const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
type GeoLocation = {
  country: string;
  city: string;
  country_code: string;
};

const GEO_CACHE_KEY = "deckly_geo_cache";
const GEO_CACHE_TTL_MS = 30 * 60 * 1000;
let geoCache: GeoLocation | null = null;
let geoCacheExpiresAt: number | null = null;

type StoredGeoLocation = GeoLocation & {
  cached_at: number;
};

const clearGeoCacheFromSession = () => {
  try {
    sessionStorage.removeItem(GEO_CACHE_KEY);
  } catch {
    // Ignore sessionStorage errors.
  }
};

const readGeoCacheFromSession = (): GeoLocation | null => {
  try {
    const raw = sessionStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredGeoLocation>;
    if (
      typeof parsed.country !== "string" ||
      typeof parsed.city !== "string" ||
      typeof parsed.country_code !== "string" ||
      typeof parsed.cached_at !== "number"
    ) {
      clearGeoCacheFromSession();
      return null;
    }

    if (Date.now() - parsed.cached_at > GEO_CACHE_TTL_MS) {
      clearGeoCacheFromSession();
      return null;
    }

    geoCacheExpiresAt = parsed.cached_at + GEO_CACHE_TTL_MS;

    return {
      country: parsed.country,
      city: parsed.city,
      country_code: parsed.country_code,
    };
  } catch {
    return null;
  }
};

const writeGeoCacheToSession = (value: GeoLocation) => {
  try {
    const cachedAt = Date.now();
    geoCacheExpiresAt = cachedAt + GEO_CACHE_TTL_MS;
    sessionStorage.setItem(
      GEO_CACHE_KEY,
      JSON.stringify({
        ...value,
        cached_at: cachedAt,
      } satisfies StoredGeoLocation),
    );
  } catch {
    // Ignore sessionStorage errors and continue with in-memory cache only.
  }
};

type AiSummaryTelemetryMetadata = {
  scope_type: AiScopeType;
  scope_id: string;
  scope_label?: string | null;
  auth_state?: "guest" | "signed_in";
  status?: string | null;
  cache_state?: string | null;
  cached_reopen?: boolean;
  partial_data?: boolean;
  no_content?: boolean;
  usage_count?: number | null;
  quota_limit?: number | null;
  quota_remaining?: number | null;
  quota_scope?: string | null;
  session_id?: string | null;
  message_count?: number | null;
  error_message?: string | null;
  [key: string]: unknown;
};

const captureEvent = (event: string, properties: Record<string, unknown>) => {
  if (!posthogKey) return;
  posthog.capture(event, properties);
};

export const analyticsService = {
  // Track when someone views a deck
  trackDeckView(deck: Deck, metadata: Record<string, unknown> = {}) {
    captureEvent("deck_viewed", {
      deck_id: deck.id,
      deck_slug: deck.slug,
      deck_title: deck.title,
      owner_id: deck.user_id,
      ...metadata,
    });
  },

  // Track page navigation in PDF
  trackPageView(deck: Deck, pageNumber: number, timeSpent: number = 0) {
    captureEvent("pdf_page_viewed", {
      deck_id: deck.id,
      deck_slug: deck.slug,
      deck_title: deck.title,
      owner_id: deck.user_id,
      page_number: pageNumber,
      time_spent_seconds: Math.round(timeSpent),
    });
  },

  // Track when someone completes viewing a deck
  trackDeckComplete(deck: Deck, totalPages: number) {
    captureEvent("deck_completed", {
      deck_id: deck.id,
      deck_slug: deck.slug,
      deck_title: deck.title,
      owner_id: deck.user_id,
      total_pages: totalPages,
    });
  },

  // Identify user
  identifyUser(userId: string, traits?: Record<string, unknown>) {
    if (!posthogKey) return;
    posthog.identify(userId, traits);
  },

  trackAiSummaryRequested(metadata: AiSummaryTelemetryMetadata) {
    captureEvent("ai_summary_requested", metadata);
  },

  trackAiSummaryResolved(metadata: AiSummaryTelemetryMetadata) {
    captureEvent("ai_summary_resolved", metadata);
  },

  trackAiSummaryAuthPrompt(metadata: AiSummaryTelemetryMetadata) {
    captureEvent("ai_summary_auth_prompt_shown", metadata);
  },

  trackAiSummaryChatSubmitted(metadata: AiSummaryTelemetryMetadata) {
    captureEvent("ai_summary_chat_submitted", metadata);
  },

  trackAiSummaryChatResolved(metadata: AiSummaryTelemetryMetadata) {
    captureEvent("ai_summary_chat_resolved", metadata);
  },

  // Get or generate a persistent visitor ID
  getVisitorId(): string {
    let visitorId = localStorage.getItem("deckly_visitor_id");
    if (!visitorId) {
      visitorId = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "v-" + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("deckly_visitor_id", visitorId);
    }
    return visitorId;
  },

  // Get geolocation from Vercel Edge headers
  async getGeoLocation(): Promise<GeoLocation> {
    if (geoCache && geoCacheExpiresAt && Date.now() < geoCacheExpiresAt) {
      return geoCache;
    }

    geoCache = null;
    geoCacheExpiresAt = null;

    const sessionCachedGeo = readGeoCacheFromSession();
    if (sessionCachedGeo) {
      geoCache = sessionCachedGeo;
      return sessionCachedGeo;
    }
    
    try {
      // Fetch from our local Vercel API route
      const response = await fetch("/api/geo", {
        cache: "no-store",
        headers: {
          "cache-control": "no-cache",
          pragma: "no-cache",
        },
      });
      if (!response.ok) throw new Error("Geo fetch failed");
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Geo endpoint did not return JSON");
      }

      const data = await response.json();
      geoCache = {
        country: data.country || "Unknown",
        city: data.city || "Unknown City",
        country_code: data.country_code || "US"
      };
      writeGeoCacheToSession(geoCache);
      return geoCache!;
    } catch (err) {
      console.warn("Failed to fetch geolocation, falling back to defaults:", err);
      return { country: "Unknown", city: "Unknown City", country_code: "Unknown" };
    }
  },

  // Sync stats to Supabase for user dashboard
  async syncSlideStats(
    deck: Deck,
    pageNumber: number,
    timeSpent: number,
    viewerEmail?: string,
    dataRoomId?: string,
  ): Promise<void> {
    try {
      const visitorId = this.getVisitorId();
      const geo = await this.getGeoLocation();

      const { error } = await supabase.rpc("record_deck_visit", {
        p_deck_id: deck.id,
        p_page_number: pageNumber,
        p_time_spent: timeSpent,
        p_visitor_id: visitorId,
        p_viewer_email: viewerEmail || null,
        p_data_room_id: dataRoomId || null,
        p_country: geo.country,
        p_city: geo.city,
        p_country_code: geo.country_code,
      });

      if (error) throw error;
    } catch (err) {
      console.error("Error syncing slide stats:", err);
    }
  },

  // Get stats for a specific deck (Management view)
  async getDeckStats(
    deckId: string,
    isPro: boolean = false,
    providedUserId?: string,
  ): Promise<DeckPageStats[]> {
    let userId = providedUserId;

    if (!userId) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      userId = session.user.id;
    }

    const tier = getTierConfig(isPro);

    return withRetry(async () => {
      const cutoffDate = new Date(
        Date.now() - tier.days * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data, error } = await supabase
        .from("deck_stats")
        .select("*")
        .eq("deck_id", deckId)
        .eq("user_id", userId)
        .gt("updated_at", cutoffDate)
        .order("page_number", { ascending: true });

      if (error) throw error;
      
      // Aggregate by page_number to handle multiple contexts (Data Rooms vs Direct)
      const aggregated = ((data as unknown as DeckPageStats[]) || []).reduce((acc: Record<number, DeckPageStats>, curr: DeckPageStats) => {
        const page = curr.page_number;
        if (!acc[page]) {
          acc[page] = {
            page_number: page,
            total_views: 0,
            total_time_seconds: 0
          };
        }
        acc[page].total_views += (curr.total_views || 0);
        acc[page].total_time_seconds += (curr.total_time_seconds || 0);
        return acc;
      }, {} as Record<number, DeckPageStats>);

      return (Object.values(aggregated) as DeckPageStats[]).sort((a, b) => a.page_number - b.page_number);
    });
  },

  // Get top performing decks based on total views
  async getTopPerformingDecks(userId: string, limit: number = 3) {
    // 1. Get time stats from deck_stats
    const { data: statsData, error: statsError } = await supabase
      .from("deck_stats")
      .select("deck_id, total_time_seconds, decks(title, updated_at, created_at)")
      .eq("user_id", userId);

    if (statsError) throw statsError;

    // Aggregate time by deck_id and collect titles
    const deckInfo: Record<string, { title: string; time: number; updated_at?: string; created_at?: string }> = {};
    for (const row of statsData as unknown as { deck_id: string; total_time_seconds: number; decks: { title: string; updated_at: string; created_at: string } | null }[]) {
      const id = row.deck_id;
      if (!deckInfo[id]) {
        deckInfo[id] = { 
          title: row.decks?.title || "Untitled", 
          time: 0,
          updated_at: row.decks?.updated_at,
          created_at: row.decks?.created_at,
        };
      }
      deckInfo[id].time += row.total_time_seconds;
    }

    const deckIds = Object.keys(deckInfo);
    if (deckIds.length === 0) {
      return [];
    }

    // 2. Get unique visitors per deck from deck_page_views
    const { data: viewData } = await supabase
      .from("deck_page_views")
      .select("deck_id, visitor_id")
      .in("deck_id", deckIds);

    const visitorsByDeck = new Map<string, Set<string>>();
    for (const row of viewData || []) {
      if (!visitorsByDeck.has(row.deck_id)) {
        visitorsByDeck.set(row.deck_id, new Set());
      }
      visitorsByDeck.get(row.deck_id)!.add(row.visitor_id);
    }

    // 3. Merge and sort
    const result = deckIds
      .map((id) => {
        const views = visitorsByDeck.get(id)?.size || 0;
        const time = deckInfo[id].time;
        return {
          id,
          title: deckInfo[id].title,
          views,
          time,
          avgSession: views > 0 ? time / views : 0,
          updated_at: deckInfo[id].updated_at,
          created_at: deckInfo[id].created_at,
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);

    return result;
  },

  // Get daily metrics for the last 7 days (optionally filtered by deck)
  async getDailyMetrics(userId: string, deckId?: string) {
    const days = 7;
    const labels: string[] = [];
    const visits: number[] = [];
    const timeSpent: number[] = [];
    const bookmarks: number[] = [];
    const dateKeys: string[] = []; // YYYY-MM-DD for matching

    // Initialize days (Mon-Sun style, ending today)
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      labels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
      dateKeys.push(d.toISOString().split("T")[0]);
      visits.push(0);
      timeSpent.push(0);
      bookmarks.push(0);
    }

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      // 1. Fetch user's deck IDs
      let deckIdsQuery = supabase.from("decks").select("id").eq(
        "user_id",
        userId,
      );

      if (deckId) {
        deckIdsQuery = deckIdsQuery.eq("id", deckId);
      }

      const { data: userDecks } = await deckIdsQuery;

      const deckIds = (userDecks || []).map((d) => d.id);
      if (deckIds.length === 0) return { labels, visits, timeSpent, bookmarks };

      // 2. Fetch both page views and bookmarks in parallel
      const [vResult, bResult] = await Promise.all([
        supabase
          .from("deck_page_views")
          .select("viewed_at, visitor_id, deck_id, time_spent")
          .in("deck_id", deckIds)
          .gt("viewed_at", sevenDaysAgo.toISOString()),
        supabase
          .from("investor_library")
          .select("created_at, deck_id")
          .in("deck_id", deckIds)
          .gt("created_at", sevenDaysAgo.toISOString()),
      ]);

      if (vResult.error) throw vResult.error;
      if (bResult.error) throw bResult.error;

      const vData = vResult.data || [];
      const bData = bResult.data || [];

      // Tracks unique visitor/deck combos per day to count as "one visit"
      const dayVisitsMap = dateKeys.map(() => new Set<string>());

      // Map visits to days using date keys
      vData.forEach((v) => {
        const vDate = new Date(v.viewed_at).toISOString().split("T")[0];
        const index = dateKeys.indexOf(vDate);
        if (index !== -1) {
          // Same logic as total views: unique visitor per deck per day
          dayVisitsMap[index].add(`${v.visitor_id}-${v.deck_id}`);
          timeSpent[index] += Number(v.time_spent || 0);
        }
      });

      // Map bookmarks to days
      bData.forEach((b) => {
        const bDate = new Date(b.created_at).toISOString().split("T")[0];
        const index = dateKeys.indexOf(bDate);
        if (index !== -1) {
          bookmarks[index]++;
        }
      });

      // Convert Sets to counts
      dayVisitsMap.forEach((set, i) => {
        visits[i] = set.size;
      });
    } catch (err) {
      console.error("Error fetching daily metrics:", err);
    }

    return { labels, visits, timeSpent, bookmarks };
  },

  // Get total stats for the user dashboard (optionally filtered by deck)
  async getUserTotalStats(userId: string, deckId?: string) {
    // 1. Fetch user's deck IDs
    const { data: userDecks } = await supabase
      .from("decks")
      .select("id")
      .eq("user_id", userId);

    if (!userDecks || userDecks.length === 0) {
      return { totalViews: 0, totalTimeSeconds: 0, totalSaves: 0, deckCount: 0 };
    }

    const deckIds = deckId ? [deckId] : userDecks.map((d) => d.id);

    // 2. Fetch everything in parallel
    const [timeResult, viewResult, saveResult] = await Promise.all([
      // Total time
      supabase
        .from("deck_stats")
        .select("total_time_seconds")
        .in("deck_id", deckIds),
      // Unique visitors
      supabase
        .from("deck_page_views")
        .select("visitor_id, deck_id")
        .in("deck_id", deckIds),
      // Total saves - use count check
      supabase
        .from("investor_library")
        .select("id", {
          count: "exact",
          head: true,
        })
        .in("deck_id", deckIds),
    ]);

    if (timeResult.error) {
      console.error("Error fetching time stats:", timeResult.error);
    }
    if (viewResult.error) {
      console.error("Error fetching view stats:", viewResult.error);
    }
    if (saveResult.error) {
      console.error("Error fetching save counts:", saveResult.error);
    }

    const totalTimeSeconds = (timeResult.data || []).reduce(
      (acc, curr) => acc + curr.total_time_seconds,
      0,
    );

    let totalViews = 0;
    if (viewResult.data) {
      const visitorsByDeck = new Map<string, Set<string>>();
      for (const row of viewResult.data) {
        if (!visitorsByDeck.has(row.deck_id)) {
          visitorsByDeck.set(row.deck_id, new Set());
        }
        visitorsByDeck.get(row.deck_id)!.add(row.visitor_id);
      }
      for (const visitors of visitorsByDeck.values()) {
        totalViews += visitors.size;
      }
    }

    const totalSaves = saveResult.count || 0;

    return { totalViews, totalTimeSeconds, totalSaves, deckCount: userDecks.length };
  },

  // Get unique visitor count for a deck (distinct people, not slide views)
  // Uses SQL COUNT(DISTINCT) via RPC for efficiency
  async getUniqueVisitorCount(deckId: string, ownerUserId: string): Promise<number> {
    await assertDeckOwnership(deckId, ownerUserId);

    try {
      // Try RPC first (requires count_unique_visitors function in Supabase)
      const { data, error } = await supabase.rpc("count_unique_visitors", {
        p_deck_id: deckId,
      });

      if (error) {
        // Fallback to client-side aggregation if RPC doesn't exist
        console.warn("RPC count_unique_visitors not available, using fallback:", error.message);
        return this._getUniqueVisitorCountFallback(deckId);
      }

      return data || 0;
    } catch (err) {
      console.warn("Error in getUniqueVisitorCount, using fallback:", err);
      return this._getUniqueVisitorCountFallback(deckId);
    }
  },

  // Fallback: client-side aggregation (less efficient, used if RPC doesn't exist)
  async _getUniqueVisitorCountFallback(deckId: string): Promise<number> {
    const { data, error } = await supabase
      .from("deck_page_views")
      .select("visitor_id")
      .eq("deck_id", deckId);

    if (error || !data) return 0;

    const uniqueVisitors = new Set(data.map((r: { visitor_id: string }) => r.visitor_id));
    return uniqueVisitors.size;
  },

  // Get detailed bookmarks for a deck
  async getDeckBookmarks(deckId: string, ownerUserId: string) {
    await assertDeckOwnership(deckId, ownerUserId);

    // Attempt with join first
    const { data, error } = await supabase
      .from("investor_library")
      .select(`
        created_at,
        user_id,
        profiles (
          full_name,
          avatar_url
        )
      `)
      .eq("deck_id", deckId)
      .order("created_at", { ascending: false });

    // If join fails (often due to missing FK relation in schema), fallback to manual join
    if (error) {
      console.warn(
        "Join with profiles failed, falling back to manual join:",
        error,
      );
      const { data: basicData, error: basicError } = await supabase
        .from("investor_library")
        .select("created_at, user_id")
        .eq("deck_id", deckId)
        .order("created_at", { ascending: false });

      if (basicError) throw basicError;
      if (!basicData || basicData.length === 0) return [];

      const userIds = basicData.map((b) => b.user_id);

      // Fetch profiles manually
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      if (profilesError) {
        console.error("Failed to fetch profiles for bookmarks:", profilesError);
        return basicData;
      }

      const profilesMap = new Map(
        (profilesData || []).map((p: { id: string; full_name: string | null; avatar_url: string | null }) => [p.id, p]),
      );

      return basicData.map((b) => ({
        ...b,
        profiles: profilesMap.get(b.user_id) || null,
      }));
    }

    return data;
  },

  // Get aggregated location stats for a deck
  // Uses SQL GROUP BY via RPC for efficiency
  async getDeckLocations(deckId: string, ownerUserId: string) {
    await assertDeckOwnership(deckId, ownerUserId);

    try {
      // Try RPC first (requires get_deck_locations function in Supabase)
      const { data, error } = await supabase.rpc("get_deck_locations", {
        p_deck_id: deckId,
      });

      if (error) {
        // Fallback to client-side aggregation if RPC doesn't exist
        console.warn("RPC get_deck_locations not available, using fallback:", error.message);
        return this._getDeckLocationsFallback(deckId);
      }

      return data || { countries: [], cities: [] };
    } catch (err) {
      console.warn("Error in getDeckLocations, using fallback:", err);
      return this._getDeckLocationsFallback(deckId);
    }
  },

  // Fallback: client-side aggregation (less efficient, used if RPC doesn't exist)
  async _getDeckLocationsFallback(deckId: string) {
    const { data, error } = await supabase
      .from("deck_page_views")
      .select("country, city, country_code")
      .eq("deck_id", deckId);

    if (error) throw error;
    if (!data) return { countries: [], cities: [] };

    // Aggregate by country
    const countryMap = new Map<string, { name: string; count: number; code: string }>();
    const cityMap = new Map<string, { name: string; count: number; country: string }>();

    data.forEach((row) => {
      const cName = row.country || "Unknown";
      const cCode = row.country_code || "US";
      const cityName = row.city || "Unknown City";

      // Countries
      if (!countryMap.has(cName)) {
        countryMap.set(cName, { name: cName, count: 0, code: cCode });
      }
      countryMap.get(cName)!.count++;

      // Cities
      const cityKey = `${cityName}-${cName}`;
      if (!cityMap.has(cityKey)) {
        cityMap.set(cityKey, { name: cityName, count: 0, country: cName });
      }
      cityMap.get(cityKey)!.count++;
    });

    return {
      countries: Array.from(countryMap.values()).sort((a, b) => b.count - a.count),
      cities: Array.from(cityMap.values()).sort((a, b) => b.count - a.count),
    };
  },

  // Get aggregated location stats for a data room
  async getDataRoomLocations(roomId: string) {
    try {
      const { data, error } = await supabase.rpc("get_data_room_locations", {
        p_room_id: roomId,
      });

      if (error) {
        console.warn("RPC get_data_room_locations not available, using fallback:", error.message);
        return this._getDataRoomLocationsFallback(roomId);
      }

      return data || { countries: [], cities: [] };
    } catch (err) {
      console.warn("Error in getDataRoomLocations, using fallback:", err);
      return this._getDataRoomLocationsFallback(roomId);
    }
  },

  async _getDataRoomLocationsFallback(roomId: string) {
    const { data, error } = await supabase
      .from("deck_page_views")
      .select("country, city, country_code")
      .eq("data_room_id", roomId);

    if (error) throw error;
    if (!data) return { countries: [], cities: [] };

    const countryMap = new Map<string, { name: string; count: number; code: string }>();
    const cityMap = new Map<string, { name: string; count: number; country: string }>();

    data.forEach((row) => {
      const cName = row.country || "Unknown";
      const cCode = row.country_code || "US";
      const cityName = row.city || "Unknown City";

      if (!countryMap.has(cName)) {
        countryMap.set(cName, { name: cName, count: 0, code: cCode });
      }
      countryMap.get(cName)!.count++;

      const cityKey = `${cityName}-${cName}`;
      if (!cityMap.has(cityKey)) {
        cityMap.set(cityKey, { name: cityName, count: 0, country: cName });
      }
      cityMap.get(cityKey)!.count++;
    });

    return {
      countries: Array.from(countryMap.values()).sort((a, b) => b.count - a.count),
      cities: Array.from(cityMap.values()).sort((a, b) => b.count - a.count),
    };
  },

  // Get document-level analytics for a data room
  async getDataRoomDocumentStats(roomId: string) {
    try {
      const { data, error } = await supabase
        .from("deck_page_views")
        .select("deck_id, visitor_id, time_spent, deck:decks(title)")
        .eq("data_room_id", roomId);

      if (error) throw error;
      if (!data) return [];

      const byDeck = new Map<string, {
        deckId: string;
        title: string;
        totalViews: number;
        totalTimeSeconds: number;
        uniqueVisitors: number;
      }>();
      const visitorsByDeck = new Map<string, Set<string>>();

      for (const row of data as unknown as { deck_id: string; visitor_id: string; time_spent: number | null; deck?: { title?: string | null } | null }[]) {
        const deckId = row.deck_id;
        const current = byDeck.get(deckId) || {
          deckId,
          title: row.deck?.title || "Untitled",
          totalViews: 0,
          totalTimeSeconds: 0,
          uniqueVisitors: 0,
        };
        current.totalViews += 1;
        current.totalTimeSeconds += Number(row.time_spent || 0);

        if (!visitorsByDeck.has(deckId)) visitorsByDeck.set(deckId, new Set());
        visitorsByDeck.get(deckId)!.add(row.visitor_id);
        current.uniqueVisitors = visitorsByDeck.get(deckId)!.size;

        byDeck.set(deckId, current);
      }

      return Array.from(byDeck.values()).sort(
        (a, b) => b.totalViews - a.totalViews || b.totalTimeSeconds - a.totalTimeSeconds,
      );
    } catch (err) {
      console.warn("Error in getDataRoomDocumentStats, using fallback:", err);
      return [];
    }
  },
};
