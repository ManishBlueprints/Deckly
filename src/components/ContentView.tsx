import { useAuth } from "../contexts/AuthContext";
import { ContentStatsCard } from "./dashboard/ContentStatsCard";
import { DecksTable } from "./dashboard/DecksTable";
import { useDecks } from "../hooks/useDecks";
import { useUserTotalStats } from "../hooks/useUserTotalStats";
import { useQueryClient } from "@tanstack/react-query";
import { deckService } from "../services/deckService";

export function ContentView() {
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: decks = [],
    isLoading: decksLoading,
    isFetching: decksFetching,
  } = useDecks(session?.user?.id);
  const {
    data: stats,
    isLoading: statsLoading,
    isFetching: statsFetching,
  } = useUserTotalStats(session?.user?.id);

  const loading = (decksLoading || statsLoading) && decks.length === 0;
  const isRefreshing = decksFetching || statsFetching;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDeleteDeck = async (deck: any) => {
    try {
      await deckService.deleteDeck(deck.id, deck.file_url, deck.slug);
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["decks", session?.user?.id] });
      queryClient.invalidateQueries({
        queryKey: ["user-total-stats", session?.user?.id],
      });
    } catch (err) {
      console.error("Failed to delete deck:", err);
      alert("Error deleting deck. Please try again.");
      throw err; // Propagate error to DecksTable
    }
  };

  return (
    <div className="space-y-12 pb-12 animate-in fade-in duration-700 relative">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <span className="text-primary text-[10px] font-bold uppercase tracking-[0.3em]">
          Manage your assets and track engagement across all your decks.
        </span>
        <h1 className="text-5xl font-bold tracking-tight text-white mb-2">
          Content Library
        </h1>
      </div>

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
        totalViews={stats?.totalViews || 0}
        totalTimeSeconds={stats?.totalTimeSeconds || 0}
        totalSaves={stats?.totalSaves || 0}
        loading={loading}
      />

      <DecksTable
        decks={decks}
        userHandle={profile?.handle || "username"}
        loading={loading}
        onDelete={handleDeleteDeck}
      />
    </div>
  );
}
