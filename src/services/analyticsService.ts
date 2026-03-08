import posthog from "posthog-js";
import { withRetry } from "../utils/resilience";
import { supabase } from "./supabase";
import { Deck, DeckStats } from "../types";
import { getTierConfig } from "../constants/tiers";

// Note: posthog.init is handled globally in main.tsx via PostHogProvider
const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;

export const analyticsService = {
  // Track when someone views a deck
  trackDeckView(deck: Deck, metadata: Record<string, any> = {}) {
    if (!posthogKey) return;

    posthog.capture("deck_viewed", {
      deck_id: deck.id,
      deck_slug: deck.slug,
      deck_title: deck.title,
      owner_id: deck.user_id,
      ...metadata,
    });
  },

  // Track page navigation in PDF
  trackPageView(deck: Deck, pageNumber: number, timeSpent: number = 0) {
    if (!posthogKey) return;

    posthog.capture("pdf_page_viewed", {
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
    if (!posthogKey) return;

    posthog.capture("deck_completed", {
      deck_id: deck.id,
      deck_slug: deck.slug,
      deck_title: deck.title,
      owner_id: deck.user_id,
      total_pages: totalPages,
    });
  },

  // Identify user
  identifyUser(userId: string, traits?: Record<string, any>) {
    if (!posthogKey) return;
    posthog.identify(userId, traits);
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

  // Sync stats to Supabase for user dashboard
  async syncSlideStats(
    deck: Deck,
    pageNumber: number,
    timeSpent: number,
    viewerEmail?: string,
  ): Promise<void> {
    try {
      const visitorId = this.getVisitorId();
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

      // 1. Check if this visitor has seen this slide in the last 24 hours
      const { data: recentView, error: viewError } = await supabase
        .from("deck_page_views")
        .select("id")
        .eq("deck_id", deck.id)
        .eq("page_number", pageNumber)
        .eq("visitor_id", visitorId)
        .gt("viewed_at", twentyFourHoursAgo)
        .limit(1)
        .maybeSingle();

      if (viewError) throw viewError;

      const isUniqueView = !recentView;

      // 2. Record or update the view with time_spent
      if (isUniqueView) {
        await supabase.from("deck_page_views").insert({
          deck_id: deck.id,
          page_number: pageNumber,
          visitor_id: visitorId,
          viewed_at: new Date().toISOString(),
          time_spent: timeSpent,
          viewer_email: viewerEmail || null,
        });
      } else if (recentView?.id) {
        // Accumulate time on revisit to same slide within 24h
        const { data: existing } = await supabase
          .from("deck_page_views")
          .select("time_spent")
          .eq("id", recentView.id)
          .single();
        await supabase
          .from("deck_page_views")
          .update({
            time_spent: (existing?.time_spent || 0) + timeSpent,
          })
          .eq("id", recentView.id);
      }

      // 3. Update the aggregate stats
      const { data: existing, error: fetchError } = await supabase
        .from("deck_stats")
        .select("total_views, total_time_seconds")
        .eq("deck_id", deck.id)
        .eq("page_number", pageNumber)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

      const newViews = (existing?.total_views || 0) + (isUniqueView ? 1 : 0);
      const newTime = (existing?.total_time_seconds || 0) + timeSpent;

      // 4. Upsert the new values
      const { error: upsertError } = await supabase.from("deck_stats").upsert(
        {
          deck_id: deck.id,
          page_number: pageNumber,
          total_views: newViews,
          total_time_seconds: newTime,
          user_id: deck.user_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "deck_id, page_number" },
      );

      if (upsertError) throw upsertError;
    } catch (err) {
      console.error("Error syncing slide stats:", err);
    }
  },

  // Get stats for a specific deck (Management view)
  async getDeckStats(
    deckId: string,
    isPro: boolean = false,
    providedUserId?: string,
  ): Promise<DeckStats[]> {
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
      return data as DeckStats[];
    });
  },

  // Get top performing decks based on total views
  async getTopPerformingDecks(userId: string, limit: number = 3) {
    // 1. Get time stats from deck_stats
    const { data: statsData, error: statsError } = await supabase
      .from("deck_stats")
      .select("deck_id, total_time_seconds, decks(title)")
      .eq("user_id", userId);

    if (statsError) throw statsError;

    // Aggregate time by deck_id and collect titles
    const deckInfo: Record<string, { title: string; time: number }> = {};
    for (const row of statsData as any[]) {
      const id = row.deck_id;
      if (!deckInfo[id]) {
        deckInfo[id] = { title: row.decks?.title || "Untitled", time: 0 };
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
      .map((id) => ({
        id,
        title: deckInfo[id].title,
        views: visitorsByDeck.get(id)?.size || 0,
        time: deckInfo[id].time,
      }))
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
      return { totalViews: 0, totalTimeSeconds: 0, totalSaves: 0 };
    }

    const deckIds = deckId ? [deckId] : userDecks.map((d: any) => d.id);

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

    return { totalViews, totalTimeSeconds, totalSaves };
  },

  // Get unique visitor count for a deck (distinct people, not slide views)
  async getUniqueVisitorCount(deckId: string): Promise<number> {
    const { data, error } = await supabase
      .from("deck_page_views")
      .select("visitor_id")
      .eq("deck_id", deckId);

    if (error || !data) return 0;

    const uniqueVisitors = new Set(data.map((r: any) => r.visitor_id));
    return uniqueVisitors.size;
  },

  // Get detailed bookmarks for a deck
  async getDeckBookmarks(deckId: string) {
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
        (profilesData || []).map((p: any) => [p.id, p]),
      );

      return basicData.map((b) => ({
        ...b,
        profiles: profilesMap.get(b.user_id) || null,
      }));
    }

    return data;
  },
};
