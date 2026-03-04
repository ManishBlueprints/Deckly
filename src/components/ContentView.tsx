import { useState, useEffect, useCallback } from "react";
import { deckService } from "../services/deckService";
import { analyticsService } from "../services/analyticsService";
import { useAuth } from "../contexts/AuthContext";
import { ContentStatsCard } from "./dashboard/ContentStatsCard";
import { DecksTable } from "./dashboard/DecksTable";

export function ContentView() {
  const { session, profile } = useAuth();

  // Initialize from cache if available for "instant" feel
  const getCachedData = () => {
    try {
      const cached = localStorage.getItem(`content-cache-${session?.user?.id}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const initialCache = getCachedData();
  const [stats, setStats] = useState(
    initialCache?.stats || {
      totalViews: 0,
      totalTimeSeconds: 0,
      totalSaves: 0,
    },
  );
  const [decks, setDecks] = useState<any[]>(initialCache?.decks || []);
  const [loading, setLoading] = useState(!initialCache);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchContentData = useCallback(
    async (isInitial = false) => {
      if (!session?.user?.id) return;

      // Only show loading if we have no data at all
      if (isInitial && stats.totalViews === 0 && decks.length === 0)
        setLoading(true);
      setIsRefreshing(true);

      try {
        const [totalStats, decksWithStats] = await Promise.all([
          analyticsService.getUserTotalStats(session.user.id, undefined, true),
          deckService.getDecksWithAnalytics(session.user.id),
        ]);

        setStats(totalStats);
        setDecks(decksWithStats);

        // Update cache
        localStorage.setItem(
          `content-cache-${session.user.id}`,
          JSON.stringify({
            stats: totalStats,
            decks: decksWithStats,
            timestamp: Date.now(),
          }),
        );
      } catch (err) {
        console.error("Failed to fetch content data:", err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [session?.user?.id, stats.totalViews, decks.length],
  );

  useEffect(() => {
    fetchContentData(true);
  }, [fetchContentData]);

  const handleDelete = async (deck: any) => {
    try {
      await deckService.deleteDeck(deck.id, deck.file_url, deck.slug);
      await fetchContentData();
    } catch (err) {
      console.error("Failed to delete deck:", err);
      alert("Error deleting deck. Please try again.");
    }
  };

  return (
    <div className="space-y-12 pb-12 animate-in fade-in duration-700 relative">
      <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] -mb-6 md:-mb-4">
        Manage your assets and track engagement across all your decks.
      </p>
      {/* Subtle refresh indicator */}
      {isRefreshing && !loading && (
        <div className="absolute top-0 right-0 py-2 flex items-center gap-2">
          <div className="w-2 h-2 bg-deckly-primary rounded-full animate-ping shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
          <span className="text-[8px] font-bold uppercase tracking-widest text-deckly-primary/70">
            Syncing...
          </span>
        </div>
      )}

      <ContentStatsCard
        totalViews={stats.totalViews}
        totalTimeSeconds={stats.totalTimeSeconds}
        totalSaves={stats.totalSaves}
        loading={loading}
      />

      <DecksTable
        decks={decks}
        userHandle={profile?.handle || "username"}
        loading={loading}
        onDelete={handleDelete}
      />
    </div>
  );
}
