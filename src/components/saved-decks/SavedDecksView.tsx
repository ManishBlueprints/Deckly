import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { LibraryFolder, SavedDeckOrganized } from "../../types";
import { Filter, FolderPlus, Loader2 } from "lucide-react";
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
import { SavedLibraryEmptyState } from "./SavedDeckEmptyState";
import { FolderCard } from "./FolderCard";
import { DocumentRow } from "./DocumentRow";
import { SavedRoomRow } from "./SavedRoomRow";
import { ManageTagsModal } from "./ManageTagsModal";
import { useLibrary } from "../../hooks/useLibrary";
import { dataRoomLibraryService } from "../../services/dataRoomLibraryService";
import { MetadataSearchMenu } from "../search/MetadataSearchMenu";
import { useMetadataSearchState } from "../../hooks/useMetadataSearchState";
import { ManageTagsButton } from "../shared/ManageTagsButton";
import { cn } from "../../lib/utils";
import {
  filterSavedDeckRows,
  filterSavedRoomRows,
} from "../../utils/metadataSearchAdapters";
import { DataRoomFolderModal } from "../data-room/DataRoomFolderModal";
import {
  resolveFolderColorKey,
  type FolderColorKey,
} from "../../constants/folderColors";

type SavedLibraryViewMode = "all" | "decks" | "rooms";

function getSavedLibraryEmptyStateCopy(
  viewMode: SavedLibraryViewMode,
  hasSearchFilters: boolean,
) {
  if (viewMode === "decks") {
    return hasSearchFilters
      ? {
          title: "No saved decks match your filters",
          description:
            "Try clearing the current search, folder, or tag filter to see more decks.",
          ctaLabel: "Create Folder",
        }
      : {
          title: "No saved decks yet",
          description:
            "Save a deck from the viewer or content library and it will appear here.",
          ctaLabel: "Create Folder",
        };
  }

  if (viewMode === "rooms") {
    return hasSearchFilters
      ? {
          title: "No saved rooms match your filters",
          description:
            "Try clearing the current search, folder, or tag filter to see more rooms.",
          ctaLabel: "Create Folder",
        }
      : {
          title: "No saved rooms yet",
          description:
            "Save a room from the room viewer and it will appear here.",
          ctaLabel: "Create Folder",
        };
  }

  return hasSearchFilters
    ? {
        title: "No saved items match your filters",
        description:
          "Try clearing the current search, folder, or tag filter to see more saved items.",
        ctaLabel: "Create Folder",
      }
    : {
        title: "No saved items yet",
        description: "Save decks and rooms to build a single shared library.",
        ctaLabel: "Create Folder",
      };
}

export function SavedLibraryView() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { decks, folders, tags, isLoading, isError, actions } = useLibrary(
    session?.user?.id,
  );
  const {
    data: savedRooms = [],
    isLoading: isSavedRoomsLoading,
    isError: isSavedRoomsError,
  } = useQuery({
    queryKey: ["saved-data-rooms", session?.user?.id],
    queryFn: () => dataRoomLibraryService.getSavedRooms(),
    enabled: !!session?.user?.id,
    staleTime: 30_000,
  });

  // --- UI state only ---
  const [selectedFolderId, setSelectedFolderId] = useState<
    string | "uncategorized" | "all"
  >("all");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<SavedLibraryViewMode>("all");
  const search = useMetadataSearchState("saved_library");

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
      filterSavedDeckRows(
        decks,
        search.filter,
        selectedFolderId,
        selectedTagId,
      ),
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

  const visibleDecks = useMemo(() => {
    if (viewMode === "rooms") return [];
    return filteredDecks;
  }, [filteredDecks, viewMode]);

  const visibleSavedRooms = useMemo(() => {
    if (viewMode === "decks") return [];
    return filteredSavedRooms;
  }, [filteredSavedRooms, viewMode]);

  const hasAnyItems =
    decks.length > 0 || folders.length > 0 || savedRooms.length > 0;
  const hasSearchFilters =
    search.isActive ||
    selectedTagId !== null ||
    selectedFolderId !== "all";
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

  const handleRetryLibraryLoad = useCallback(async () => {
    await Promise.all([
      actions.refetch(),
      queryClient.invalidateQueries({
        queryKey: ["saved-data-rooms", session?.user?.id],
      }),
    ]);
  }, [actions, queryClient, session?.user?.id]);

  // --- Confirm: Delete folder ---
  const handleConfirmDeleteFolder = useCallback(async () => {
    if (!deletingFolder) return;
    setIsDeletingInProgress(true);
    try {
      await actions.deleteFolder(deletingFolder);
      if (selectedFolderId === deletingFolder.id)
        setSelectedFolderId("all");
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

  const handleUpdateFolderTags = useCallback(
    async (folder: LibraryFolder, tagIds: string[]) => {
      await actions.updateFolder(
        folder,
        folder.name,
        resolveFolderColorKey(folder.color),
        tagIds,
      );
    },
    [actions],
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
      await queryClient.invalidateQueries({
        queryKey: ["library-decks", session?.user?.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["library-folders", session?.user?.id],
      });
    },
    [actions, queryClient, session?.user?.id],
  );

  const handleUnsaveRequest = useCallback(
    (deck: SavedDeckOrganized) => {
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
    },
    [actions],
  );

  const handleEditFolderRequest = useCallback((f: LibraryFolder) => {
    setEditingFolder(f);
    setIsCreateFolderModalOpen(true);
  }, []);

  const handleDeleteFolderRequest = useCallback((f: LibraryFolder) => {
    setDeletingFolder(f);
  }, []);

  const handleFolderClick = useCallback((folderId: string) => {
    setSelectedFolderId((prev) =>
      prev === folderId ? "all" : folderId,
    );
  }, []);

  const recentlySavedItems = useMemo(
    () =>
      [
        ...visibleDecks.map((result) => ({
          kind: "deck" as const,
          savedAt: result.deck.saved_at,
          result,
        })),
        ...visibleSavedRooms.map((result) => ({
          kind: "room" as const,
          savedAt: result.room.saved_at,
          result,
        })),
      ].sort(
        (left, right) =>
          new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime(),
      ),
    [visibleDecks, visibleSavedRooms],
  );

  // --- Loading / error / empty states ---
  if (isError) {
    return (
      <div className="flex h-full min-h-[calc(100vh-140px)] flex-col items-center justify-center gap-6 bg-ui-canvas p-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ui-destructive/10 text-ui-destructive">
          <Filter size={32} />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-ui-text">
            Failed to load library
          </h3>
          <p className="max-w-sm text-ui-muted">
            There was a problem connecting to the server. Please check your
            connection and try again.
          </p>
        </div>
        <button
          onClick={() => {
            void handleRetryLibraryLoad();
          }}
          className="rounded-[14px] bg-ui-primary px-8 py-3 font-semibold text-ui-primary-text transition-opacity hover:opacity-90"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[calc(100vh-140px)] items-center justify-center bg-ui-canvas p-20">
        <Loader2 className="animate-spin text-ui-primary" size={32} />
      </div>
    );
  }

  if (!hasAnyItems) {
    const emptyState = getSavedLibraryEmptyStateCopy(
      viewMode,
      hasSearchFilters,
    );
    return (
      <div className="min-h-[calc(100vh-88px)] overflow-hidden bg-ui-canvas">
        <SavedLibraryEmptyState
          title={emptyState.title}
          description={emptyState.description}
          ctaLabel={emptyState.ctaLabel}
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
    <div className="min-h-[calc(100vh-88px)] bg-ui-canvas">
      <div className="overflow-y-auto custom-scrollbar">
        <div className="mx-auto w-full max-w-[1440px] space-y-10 px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          {/* Main Header */}
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ui-text sm:text-4xl">
                Saved library
              </h1>
              <p className="text-sm text-ui-muted sm:text-base">Keep useful decks and rooms organized in one private place.</p>
            </div>

            <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-2 md:w-auto md:gap-4">
              <div className="inline-flex min-w-0 w-full items-center rounded-[12px] border border-ui-border bg-ui-surface p-1 sm:flex-1 md:w-auto md:flex-none">
                {(
                  [
                    ["all", "All"],
                    ["decks", "Decks"],
                    ["rooms", "Rooms"],
                  ] as const
                ).map(([mode, label]) => {
                  const active = viewMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      className={cn(
                        "flex-1 rounded-[9px] px-3 py-2 text-xs font-medium transition-all sm:px-4 md:flex-none",
                        active
                          ? "bg-ui-subtle text-ui-text"
                          : "text-ui-muted hover:bg-ui-subtle hover:text-ui-text",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2">
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
                  resultCount={visibleDecks.length + visibleSavedRooms.length}
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
                  mobileIconOnly
                />
                <ManageTagsButton
                  onClick={() => setIsManageTagsModalOpen(true)}
                />
                <button
                  type="button"
                  aria-label="New folder"
                  onClick={() => {
                    setEditingFolder(null);
                    setIsCreateFolderModalOpen(true);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-primary-text transition-opacity hover:opacity-90"
                >
                  <FolderPlus size={16} />
                  <span className="hidden sm:inline">New folder</span>
                </button>
              </div>
            </div>
          </div>

          {/* Folders */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ui-text">Folders</h2>
                <p className="mt-1 text-sm text-ui-muted">Group saved decks and rooms around your workflow.</p>
              </div>
              {selectedFolderId !== "all" ? (
                <button
                  type="button"
                  onClick={() => setSelectedFolderId("all")}
                  className="text-sm font-medium text-ui-primary hover:underline"
                >
                  View all items
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {folders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  availableTags={tags}
                  onUpdateTags={handleUpdateFolderTags}
                  isActive={selectedFolderId === folder.id}
                  documentCount={
                    folder.deck_count + (roomCountByFolder[folder.id] || 0)
                  }
                  onClick={() => handleFolderClick(folder.id)}
                  onEdit={handleEditFolderRequest}
                  onDelete={handleDeleteFolderRequest}
                />
              ))}
              <FolderCard
                isNew
                onClick={() => {
                  setEditingFolder(null);
                  setIsCreateFolderModalOpen(true);
                }}
              />
            </div>
          </div>

          {(isSavedRoomsLoading || isSavedRoomsError) && (
            <div className="flex items-start gap-3 rounded-[14px] border border-ui-border bg-ui-subtle px-4 py-3">
              {isSavedRoomsLoading ? (
                <Loader2
                  className="mt-0.5 animate-spin text-ui-primary"
                  size={18}
                />
              ) : (
                <Filter className="mt-0.5 text-ui-destructive" size={18} />
              )}
              <div className="space-y-1">
                <p className="text-sm font-semibold text-ui-text">
                  {isSavedRoomsLoading
                    ? "Loading saved rooms"
                    : "Saved rooms unavailable"}
                </p>
                <p className="text-xs text-ui-muted">
                  {isSavedRoomsLoading
                    ? "Decks, folders, and the view toggle remain available while room data finishes loading."
                    : "Decks, folders, and the view toggle remain available while room data is unavailable."}
                </p>
              </div>
            </div>
          )}

          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ui-text">Recently saved</h2>
                <p className="mt-1 text-sm text-ui-muted">
                  {recentlySavedItems.length} {recentlySavedItems.length === 1 ? "item" : "items"}
                  {selectedFolderId === "all" ? " across your library" : " in this folder"}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-ui-border bg-ui-surface">
              <div className="hidden grid-cols-[minmax(210px,1.6fr)_minmax(100px,.7fr)_80px_minmax(100px,.7fr)_minmax(120px,.9fr)_minmax(150px,1fr)_110px_40px] gap-3 bg-ui-subtle px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ui-muted xl:grid">
                <span>Name</span>
                <span>Created by / Owner</span>
                <span>Type</span>
                <span>Folder</span>
                <span>Tags</span>
                <span>Private note</span>
                <span>Saved</span>
                <span className="sr-only">Actions</span>
              </div>

              {recentlySavedItems.length > 0 ? (
                recentlySavedItems.map((item) =>
                  item.kind === "deck" ? (
                    <DocumentRow
                      key={`deck-${item.result.deck.library_id}`}
                      deck={item.result.deck}
                      folders={folders}
                      tags={tags}
                      matchedTagNames={item.result.matchedTagNames}
                      onSummarize={() =>
                        window.open(
                          `/${encodeURIComponent(item.result.deck.user_handle)}/${encodeURIComponent(item.result.deck.slug)}?ai=summary`,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      onMoveToFolder={(folderId) =>
                        handleMoveToFolder(item.result.deck.library_id, folderId)
                      }
                      onUpdateTags={(tagIds) =>
                        handleUpdateTags(item.result.deck.library_id, tagIds)
                      }
                      onSaveNote={(note) => handleSaveNote(item.result.deck.deck_id, note)}
                      onUnsave={() => handleUnsaveRequest(item.result.deck)}
                      isUnsaving={unsavingDeckId === item.result.deck.library_id}
                    />
                  ) : (
                    <SavedRoomRow
                      key={`room-${item.result.room.library_id}`}
                      room={item.result.room}
                      folders={folders}
                      tags={tags}
                      matchedTagNames={item.result.matchedTagNames}
                      onUnsave={() => {
                        void actions.refetch();
                      }}
                    />
                  ),
                )
              ) : (
                <div className="border-t border-ui-border px-6 py-14 text-center">
                  <p className="text-sm font-semibold text-ui-text">No saved items match this view</p>
                  <p className="mt-1 text-sm text-ui-muted">Try another folder, type, tag, or search.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

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
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingFolder?.name}” will be removed. Its saved decks and
              rooms will stay in your library and move to Unsorted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingInProgress}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-ui-destructive text-ui-primary-text hover:opacity-90"
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDeleteFolder();
              }}
              disabled={isDeletingInProgress}
            >
              {isDeletingInProgress ? "Deleting..." : "Delete folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const SavedDecksView = SavedLibraryView;
