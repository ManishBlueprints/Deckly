import { useAuth } from "../../contexts/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { ContentStatsCard } from "./ContentStatsCard";
import { DecksTable } from "./DecksTable";
import { useDecks } from "../../hooks/useDecks";
import { useUserTotalStats } from "../../hooks/useUserTotalStats";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deckService } from "../../services/deckService";
import { organizerService } from "../../services/organizerService";
import { MetadataSearchMenu } from "../search/MetadataSearchMenu";
import { useMetadataSearchState } from "../../hooks/useMetadataSearchState";
import { filterContentLibraryDecks } from "../../utils/metadataSearchAdapters";
import { ManageTagsModal } from "../saved-decks/ManageTagsModal";
import { ManageTagsButton } from "../shared/ManageTagsButton";

export function ContentView() {
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  const {
    data: decks = [],
    isLoading: decksLoading,
    isFetching: decksFetching,
  } = useDecks(userId);
  const {
    data: stats,
    isLoading: statsLoading,
    isFetching: statsFetching,
  } = useUserTotalStats(userId);
  const { data: tags = [] } = useQuery({
    queryKey: ["library-tags", userId],
    queryFn: () => organizerService.getTags(userId),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const loading = (decksLoading || statsLoading) && decks.length === 0;
  const isRefreshing = decksFetching || statsFetching;
  const search = useMetadataSearchState("content_library");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const hasActiveSearch = search.isActive || selectedTagId !== null;
  const filteredDecks = useMemo(
    () => filterContentLibraryDecks(decks, search.filter, selectedTagId),
    [decks, search.filter, selectedTagId],
  );
  const hasSearchResults = filteredDecks.length > 0;
  const [isManageTagsModalOpen, setIsManageTagsModalOpen] = useState(false);

  useEffect(() => {
    if (selectedTagId && !tags.some((tag) => tag.id === selectedTagId)) {
      setSelectedTagId(null);
    }
  }, [selectedTagId, tags]);

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

  const handleCreateTag = async (name: string, color: string) => {
    const createdTag = await organizerService.createTag(name, color);
    await queryClient.invalidateQueries({ queryKey: ["library-tags", userId] });
    return createdTag;
  };

  const handleUpdateTag = async (tagId: string, name: string, color: string) => {
    await organizerService.updateTag(tagId, name, color);
    await queryClient.invalidateQueries({ queryKey: ["library-tags", userId] });
  };

  const handleDeleteTag = async (tagId: string) => {
    await organizerService.deleteTag(tagId);
    await queryClient.invalidateQueries({ queryKey: ["library-tags", userId] });
    await queryClient.invalidateQueries({ queryKey: ["decks", userId] });
    await queryClient.invalidateQueries({ queryKey: ["saved-data-rooms"] });
  };

  const handleUpdateDeckTags = async (deckId: string, tagIds: string[]) => {
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await deckService.saveToLibrary(deckId);

    const savedDecks = await organizerService.getSavedDecksOrganized(userId);
    const savedDeck = savedDecks.find((item) => item.deck_id === deckId);

    if (!savedDeck) {
      throw new Error("Unable to load the saved deck row for tagging.");
    }

    await organizerService.updateDeckTags(savedDeck.library_id, tagIds);
    await queryClient.invalidateQueries({ queryKey: ["decks", userId] });
    await queryClient.invalidateQueries({ queryKey: ["saved-data-rooms"] });
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

        <div className="flex items-center gap-2 md:gap-4">
          <MetadataSearchMenu
            filter={search.filter}
            isActive={hasActiveSearch}
            onModeChange={search.setMode}
            onQueryChange={search.setQuery}
            onDatePresetChange={search.setDatePreset}
            onCustomDateRangeChange={search.setCustomDateRange}
            onClear={() => {
              search.resetFilter();
              setSelectedTagId(null);
            }}
            resultCount={filteredDecks.length}
            triggerLabel="Search"
            namePlaceholder="Search deck titles..."
            filterOptions={tags.map((tag) => ({
              id: tag.id,
              name: tag.name,
              color: tag.color,
            }))}
            selectedFilterId={selectedTagId}
            onFilterChange={setSelectedTagId}
            filterEmptyMessage="No tags created"
          />
          <ManageTagsButton
            onClick={() => setIsManageTagsModalOpen(true)}
            label="Edit Tags"
          />
        </div>
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
        availableTags={tags}
        onUpdateTags={handleUpdateDeckTags}
        emptyMessage={
          hasActiveSearch && !hasSearchResults
            ? "No decks match the current search"
          : "No decks uploaded yet"
        }
      />

      <ManageTagsModal
        isOpen={isManageTagsModalOpen}
        onClose={() => setIsManageTagsModalOpen(false)}
        tags={tags}
        onCreate={handleCreateTag}
        onUpdate={handleUpdateTag}
        onDelete={handleDeleteTag}
      />
    </div>
  );
}
