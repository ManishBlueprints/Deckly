import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { LibraryFolder, SavedDeckOrganized } from "../../types";
import { Filter, Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { SavedDeckEmptyState } from "./SavedDeckEmptyState";
import { FolderCard } from "./FolderCard";
import { DocumentRow } from "./DocumentRow";
import { SavedRoomRow } from "./SavedRoomRow";
import { ManageTagsModal } from "./ManageTagsModal";
import { useLibrary } from "../../hooks/useLibrary";
import { dataRoomLibraryService } from "../../services/dataRoomLibraryService";
import { MetadataSearchMenu } from "../search/MetadataSearchMenu";
import { useMetadataSearchState } from "../../hooks/useMetadataSearchState";
import { ManageTagsButton } from "../shared/ManageTagsButton";
import {
  filterSavedDeckRows,
  filterSavedRoomRows,
  type SavedDeckSearchResult,
  type SavedRoomSearchResult,
} from "../../utils/metadataSearchAdapters";
import { DataRoomFolderModal } from "../data-room/DataRoomFolderModal";
import {
  resolveFolderColorKey,
  type FolderColorKey,
} from "../../constants/folderColors";

export function SavedDecksView() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { decks, folders, tags, isLoading, isError, actions } = useLibrary(
    session?.user?.id,
  );
  const { data: savedRooms = [] } = useQuery({
    queryKey: ["saved-data-rooms", session?.user?.id],
    queryFn: () => dataRoomLibraryService.getSavedRooms(),
    enabled: !!session?.user?.id,
    staleTime: 30_000,
  });

  // --- UI state only ---
  const [selectedFolderId, setSelectedFolderId] = useState<
    string | "uncategorized"
  >("uncategorized");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const search = useMetadataSearchState("saved_decks");

  // Modal state
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isManageTagsModalOpen, setIsManageTagsModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<LibraryFolder | null>(
    null,
  );

  const [unsavingDeckId, setUnsavingDeckId] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<LibraryFolder | null>(
    null,
  );
  const [isDeletingInProgress, setIsDeletingInProgress] = useState(false);

  // --- Derived / filtered list ---
  const filteredDecks = useMemo(
    () =>
      filterSavedDeckRows(decks, search.filter, selectedFolderId, selectedTagId),
    [decks, search.filter, selectedFolderId, selectedTagId],
  );

  const filteredSavedRooms = useMemo(() => {
    return filterSavedRoomRows(
      savedRooms,
      search.filter,
      selectedFolderId,
      selectedTagId,
    );
  }, [savedRooms, search.filter, selectedFolderId, selectedTagId]);

  useEffect(() => {
    if (selectedTagId && !tags.some((tag) => tag.id === selectedTagId)) {
      setSelectedTagId(null);
    }
  }, [selectedTagId, tags]);

  const roomCountByFolder = useMemo(() => {
    return savedRooms.reduce<Record<string, number>>((acc, room) => {
      if (!room.folder_id) return acc;
      acc[room.folder_id] = (acc[room.folder_id] || 0) + 1;
      return acc;
    }, {});
  }, [savedRooms]);

  // --- Confirm: Delete folder ---
  const handleConfirmDeleteFolder = useCallback(async () => {
    if (!deletingFolder) return;
    setIsDeletingInProgress(true);
    try {
      await actions.deleteFolder(deletingFolder);
      if (selectedFolderId === deletingFolder.id)
        setSelectedFolderId("uncategorized");
      setDeletingFolder(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete folder.";
      console.error("Failed to delete folder:", err);
      toast.error(errorMessage);
    } finally {
      setIsDeletingInProgress(false);
    }
  }, [deletingFolder, selectedFolderId, actions]);

  // --- Folder modal handlers ---
  const handleCreateFolder = useCallback(
    async (input: {
      name: string;
      color: FolderColorKey;
      tagIds: string[];
    }) => {
      await actions.createFolder(input.name, input.color, input.tagIds);
      setIsCreateFolderModalOpen(false);
    },
    [actions],
  );

  const handleSaveEditFolder = useCallback(
    async (input: {
      name: string;
      color: FolderColorKey;
      tagIds: string[];
    }) => {
      if (!editingFolder) return;
      await actions.updateFolder(
        editingFolder,
        input.name,
        input.color,
        input.tagIds,
      );
      setEditingFolder(null);
      setIsCreateFolderModalOpen(false);
    },
    [editingFolder, actions],
  );

  // --- Shared stable handlers for rows ---
  const handleMoveToFolder = useCallback(
    (deckLibraryId: string, folderId: string | null) => {
      actions.moveDeck(deckLibraryId, folderId);
    },
    [actions],
  );

  const handleUpdateTags = useCallback(
    (deckLibraryId: string, tagIds: string[]) => {
      actions.updateDeckTags(deckLibraryId, tagIds);
    },
    [actions],
  );

  const handleSaveNote = useCallback(
    (deckId: string, note: string) => {
      return actions.saveNote(deckId, note);
    },
    [actions],
  );

  const handleDeleteTag = useCallback(
    async (tagId: string) => {
      await actions.deleteTag(tagId);
      await queryClient.invalidateQueries({
        queryKey: ["saved-data-rooms", session?.user?.id],
      });
    },
    [actions, queryClient, session?.user?.id],
  );

  const handleUnsaveRequest = useCallback((deck: SavedDeckOrganized) => {
    setUnsavingDeckId(deck.library_id);
    void actions
      .unsaveDeck(deck.deck_id)
      .catch((err) => {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to remove deck from library.";
        console.error("Failed to unsave deck:", err);
        toast.error(errorMessage);
      })
      .finally(() => {
        setUnsavingDeckId(null);
      });
  }, [actions]);

  const handleEditFolderRequest = useCallback((f: LibraryFolder) => {
    setEditingFolder(f);
    setIsCreateFolderModalOpen(true);
  }, []);

  const handleDeleteFolderRequest = useCallback((f: LibraryFolder) => {
    setDeletingFolder(f);
  }, []);

  const handleFolderClick = useCallback((folderId: string) => {
    setSelectedFolderId((prev) =>
      prev === folderId ? "uncategorized" : folderId,
    );
  }, []);

  // --- Loading / error / empty states ---
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-deckly-background h-full min-h-[calc(100vh-140px)] gap-6">
        <div className="w-16 h-16 bg-red-500/10 flex items-center justify-center text-red-500 rounded-full">
          <Filter size={32} />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-white">
            Failed to load library
          </h3>
          <p className="text-slate-400 max-w-sm">
            There was a problem connecting to the server. Please check your
            connection and try again.
          </p>
        </div>
        <button
          onClick={() => actions.refetch()}
          className="px-8 py-3 bg-primary text-black font-bold hover:bg-primary/90 transition-all"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20 bg-deckly-background h-full min-h-[calc(100vh-140px)]">
        <Loader2 className="animate-spin text-[#54e98a]" size={32} />
      </div>
    );
  }

  if (decks.length === 0 && folders.length === 0 && savedRooms.length === 0) {
    return (
      <div className="min-h-[calc(100vh-140px)] bg-deckly-background overflow-hidden">
        <SavedDeckEmptyState
          onCreateFolder={() => setIsCreateFolderModalOpen(true)}
        />
        <DataRoomFolderModal
          isOpen={isCreateFolderModalOpen}
          onClose={() => setIsCreateFolderModalOpen(false)}
          onSubmit={handleCreateFolder}
          existingTags={tags}
          initialData={null}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-140px)] bg-deckly-background">
      <main className="overflow-y-auto custom-scrollbar">
        <div className="px-6 pb-12 md:px-12 md:pb-12 pt-0 space-y-16 w-full max-w-[1600px] mx-auto">
          {/* Main Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-0">
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#54e98a]">
                Asset Repository
              </span>
              <h1 className="text-6xl font-headline font-extrabold text-[#e5e2e1] tracking-tighter">
                Saved Data
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <MetadataSearchMenu
                filter={search.filter}
                isActive={search.isActive || selectedTagId !== null}
                onModeChange={search.setMode}
                onQueryChange={search.setQuery}
                onDatePresetChange={search.setDatePreset}
                onCustomDateRangeChange={search.setCustomDateRange}
                onClear={() => {
                  search.resetFilter();
                  setSelectedTagId(null);
                }}
                resultCount={filteredDecks.length + filteredSavedRooms.length}
                triggerLabel="Search"
                namePlaceholder="Search saved titles..."
                filterOptions={tags.map((tag) => ({
                  id: tag.id,
                  name: tag.name,
                  color: tag.color,
                }))}
                selectedFilterId={selectedTagId}
                onFilterChange={setSelectedTagId}
                filterEmptyMessage="No tags created"
              />
              <ManageTagsButton onClick={() => setIsManageTagsModalOpen(true)} />
            </div>
          </div>

          {/* Folders */}
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-8 h-1 bg-[#54e98a] rounded-full" />
              <h2 className="text-xl font-headline font-bold text-[#e5e2e1]">
                Active Folders
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <FolderCard
                isNew
                onClick={() => {
                  setEditingFolder(null);
                  setIsCreateFolderModalOpen(true);
                }}
              />
              {folders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  isActive={selectedFolderId === folder.id}
                  documentCount={folder.deck_count + (roomCountByFolder[folder.id] || 0)}
                  onClick={() => handleFolderClick(folder.id)}
                  onEdit={handleEditFolderRequest}
                  onDelete={handleDeleteFolderRequest}
                />
              ))}
            </div>
          </div>

          {/* Saved Rooms */}
          {filteredSavedRooms.length > 0 && (
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-8 h-1 bg-[#54e98a] rounded-full" />
                <h2 className="text-xl font-headline font-bold text-[#e5e2e1]">
                  Saved Rooms
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredSavedRooms.map((result: SavedRoomSearchResult) => (
                  <SavedRoomRow
                    key={result.room.library_id}
                    room={result.room}
                    folders={folders}
                    tags={tags}
                    matchedTagNames={result.matchedTagNames}
                    onUnsave={() => {
                      void actions.refetch();
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-8 h-1 bg-[#54e98a] rounded-full opacity-40" />
                <h2 className="text-xl font-headline font-bold text-[#e5e2e1]">
                  {selectedFolderId === "uncategorized"
                    ? "Uncategorized Docs"
                    : folders.find((f) => f.id === selectedFolderId)?.name}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#bbcbbb]/20">
                  Total Inventory
                </p>
                <p className="text-lg font-headline font-bold text-[#e5e2e1]">
                  {decks.length} Active Decks
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {filteredDecks.length === 0 ? (
                  <div className="py-32 text-center">
                    <div className="w-20 h-20 bg-surface-card flex items-center justify-center text-[#54e98a]/20 mx-auto border border-white/5 mb-6">
                      <span className="material-symbols-outlined text-4xl">
                        inventory_2
                      </span>
                    </div>
                    <p className="text-[#bbcbbb]/40 font-bold">
                      No documents matching the current filter
                    </p>
                    <p className="text-[#bbcbbb]/40 text-sm mt-2">
                      Try another title, tag, or clear the current search.
                    </p>
                  </div>
                ) : (
                  filteredDecks.map((result: SavedDeckSearchResult) => (
                    <DocumentRow
                      key={result.deck.library_id}
                      deck={result.deck}
                      folders={folders}
                      tags={tags}
                      matchedTagNames={result.matchedTagNames}
                      onMoveToFolder={(folderId) =>
                        handleMoveToFolder(result.deck.library_id, folderId)
                      }
                      onUpdateTags={(tagIds) =>
                        handleUpdateTags(result.deck.library_id, tagIds)
                      }
                      onSaveNote={(note) => handleSaveNote(result.deck.deck_id, note)}
                      onUnsave={() => handleUnsaveRequest(result.deck)}
                      isUnsaving={unsavingDeckId === result.deck.library_id}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <DataRoomFolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => {
          setIsCreateFolderModalOpen(false);
          setEditingFolder(null);
        }}
        onSubmit={editingFolder ? handleSaveEditFolder : handleCreateFolder}
        existingTags={tags}
        initialData={
          editingFolder
            ? {
                name: editingFolder.name,
                color: resolveFolderColorKey(editingFolder.color),
                tagIds: editingFolder.tags.map((t) => t.id),
              }
            : null
        }
      />

      <ManageTagsModal
        isOpen={isManageTagsModalOpen}
        onClose={() => setIsManageTagsModalOpen(false)}
        tags={tags}
        onCreate={actions.createTag}
        onUpdate={actions.updateTag}
        onDelete={handleDeleteTag}
      />

      <AlertDialog
        open={!!deletingFolder}
        onOpenChange={(open) => {
          if (!open && !isDeletingInProgress) {
            setDeletingFolder(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingFolder?.name}"?
              Documents inside will not be deleted but will become
              Uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingInProgress}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDeleteFolder();
              }}
              disabled={isDeletingInProgress}
            >
              {isDeletingInProgress ? "Deleting..." : "Delete Folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
