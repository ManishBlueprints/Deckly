import { useAuth } from "../../contexts/AuthContext";
import { useMemo } from "react";
import { ContentStatsCard } from "./ContentStatsCard";
import { DecksTable } from "./DecksTable";
import { useDecks } from "../../hooks/useDecks";
import { useUserTotalStats } from "../../hooks/useUserTotalStats";
import { useQueryClient } from "@tanstack/react-query";
import { deckService } from "../../services/deckService";
import { MetadataSearchMenu } from "../search/MetadataSearchMenu";
import { useMetadataSearchState } from "../../hooks/useMetadataSearchState";
import { filterContentLibraryDecks } from "../../utils/metadataSearchAdapters";

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
  const search = useMetadataSearchState("content_library");
  const filteredDecks = useMemo(
    () => filterContentLibraryDecks(decks, search.filter),
    [decks, search.filter],
  );
  const hasSearchResults = filteredDecks.length > 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDeleteDeck = async (deck: any) => {
    try {
      const { dbDeleted, assetsDeleted, cleanupError } = await deckService.deleteDeck(deck.id, deck.file_url, deck.slug);
      
      if (!dbDeleted) {
        throw new Error("Failed to delete deck from database");
      }

      if (!assetsDeleted) {
        console.warn(`Deck removed from UI but storage cleanup failed for deck [${deck.id}].`, cleanupError);
      }

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
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <span className="text-primary text-[10px] font-bold uppercase tracking-[0.3em]">
            Manage your assets and track engagement across all your decks.
          </span>
          <h1 className="text-5xl font-bold tracking-tight text-white mb-2">
            Content Library
          </h1>
        </div>

        <MetadataSearchMenu
          filter={search.filter}
          isActive={search.isActive}
          onModeChange={search.setMode}
          onQueryChange={search.setQuery}
          onDatePresetChange={search.setDatePreset}
          onCustomDateRangeChange={search.setCustomDateRange}
          onClear={search.resetFilter}
          resultCount={filteredDecks.length}
          triggerLabel="Search"
          namePlaceholder="Search deck titles..."
        />
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
        decks={filteredDecks}
        userHandle={profile?.handle || "username"}
        loading={loading}
        onDelete={handleDeleteDeck}
        emptyMessage={
          search.isActive && !hasSearchResults
            ? "No decks match the current search"
            : "No decks uploaded yet"
        }
      />
    </div>
  );
}
