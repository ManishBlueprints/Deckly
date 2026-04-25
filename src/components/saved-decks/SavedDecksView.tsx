import { useState, useMemo, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  LibraryFolder,
  SavedDataRoomOrganized,
  SavedDeckOrganized,
} from "../../types";
import { Loader2, Filter, Tag, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
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
import { CreateFolderModal } from "./CreateFolderModal";
import { FolderCard } from "./FolderCard";
import { DocumentRow } from "./DocumentRow";
import { SavedRoomRow } from "./SavedRoomRow";
import { ManageTagsModal } from "./ManageTagsModal";
import { useLibrary } from "../../hooks/useLibrary";
import { dataRoomLibraryService } from "../../services/dataRoomLibraryService";
import { cn } from "../../lib/utils";

export function SavedDecksView() {
  const { session } = useAuth();
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Modal state
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isManageTagsModalOpen, setIsManageTagsModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<LibraryFolder | null>(
    null,
  );

  // Confirm dialog state
  const [unsaveTarget, setUnsaveTarget] = useState<SavedDeckOrganized | null>(
    null,
  );
  const [isUnsavingInProgress, setIsUnsavingInProgress] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<LibraryFolder | null>(
    null,
  );
  const [isDeletingInProgress, setIsDeletingInProgress] = useState(false);

  // --- Derived / filtered list ---
  const filteredDecks = useMemo(
    () =>
      decks.filter((deck) => {
        // When 'uncategorized' is selected show decks with no folder assigned
        const matchesFolder =
          selectedFolderId === "uncategorized"
            ? deck.folder_id === null
            : deck.folder_id === selectedFolderId;
        const matchesTag =
          selectedTagId === null ||
          deck.tags.some((t) => t.id === selectedTagId);
        const matchesSearch =
          searchQuery === "" ||
          deck.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFolder && matchesTag && matchesSearch;
      }),
    [decks, selectedFolderId, selectedTagId, searchQuery],
  );

  const filteredSavedRooms = useMemo(() => {
    if (selectedFolderId === "uncategorized") return [];
    return savedRooms.filter((room) => room.folder_id === selectedFolderId);
  }, [savedRooms, selectedFolderId]);

  const roomCountByFolder = useMemo(() => {
    return savedRooms.reduce<Record<string, number>>((acc, room) => {
      if (!room.folder_id) return acc;
      acc[room.folder_id] = (acc[room.folder_id] || 0) + 1;
      return acc;
    }, {});
  }, [savedRooms]);

  // --- Confirm: Unsave deck ---
  const handleConfirmUnsave = useCallback(async () => {
    if (!unsaveTarget) return;
    setIsUnsavingInProgress(true);
    try {
      await actions.unsaveDeck(unsaveTarget.deck_id);
      setUnsaveTarget(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to remove deck from library.";
      console.error("Failed to unsave deck:", err);
      toast.error(errorMessage);
    } finally {
      setIsUnsavingInProgress(false);
    }
  }, [unsaveTarget, actions]);

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
    async (name: string, color: string, tagNames: string[]) => {
      await actions.createFolder(name, color, tagNames);
      setIsCreateFolderModalOpen(false);
    },
    [actions],
  );

  const handleSaveEditFolder = useCallback(
    async (name: string, color: string, tagNames: string[]) => {
      if (!editingFolder) return;
      await actions.updateFolder(editingFolder, name, color, tagNames);
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

  const handleUnsaveRequest = useCallback((deck: SavedDeckOrganized) => {
    setUnsaveTarget(deck);
  }, []);

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
        <CreateFolderModal
          isOpen={isCreateFolderModalOpen}
          onClose={() => setIsCreateFolderModalOpen(false)}
          onCreate={handleCreateFolder}
          existingTags={tags}
          initialData={null}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-140px)] bg-deckly-background">
      <main className="overflow-y-auto custom-scrollbar">
        <div className="p-6 md:p-12 space-y-16 w-full max-w-[1600px] mx-auto">
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
              <button
                onClick={() => setIsFilterOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 border text-xs font-bold transition-all",
                  isFilterOpen
                    ? "bg-[#54e98a]/10 border-[#54e98a]/20 text-[#54e98a]"
                    : "bg-surface-low border-border text-[#bbcbbb]/60 hover:text-white",
                )}
              >
                <Filter size={14} />
                Filter By
              </button>
              <button
                onClick={() => setIsManageTagsModalOpen(true)}
                className="flex items-center gap-3 px-6 py-3 bg-surface-low border border-border text-xs font-bold text-[#bbcbbb]/60 hover:text-white transition-all"
              >
                <Tag size={14} />
                Edit Tags
              </button>
            </div>
          </div>

          {/* Filter Expandable */}
          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                initial={false}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="p-6 bg-surface-card border border-white/5 flex flex-col md:flex-row gap-6">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#bbcbbb]/40" />
                    <input
                      type="text"
                      placeholder="Search documents by title..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-10 py-3 bg-surface-container border border-white/10 text-[#e5e2e1] placeholder:text-[#bbcbbb]/40 focus:outline-none focus:border-[#54e98a]/50 transition-colors"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        aria-label="Clear search"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#bbcbbb]/40 hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Tag Filters */}
                  {tags.length > 0 && (
                    <div className="flex-1 flex gap-2 flex-wrap items-center">
                      <span className="text-xs font-bold text-[#bbcbbb]/40 uppercase tracking-wider mr-2">
                        Tags:
                      </span>
                      {tags.map((tag) => {
                        const isSelected = selectedTagId === tag.id;
                        return (
                          <button
                            key={tag.id}
                            onClick={() =>
                              setSelectedTagId(isSelected ? null : tag.id)
                            }
                            className={cn(
                              "px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all border",
                              isSelected
                                ? "border-transparent text-[#131313]"
                                : "bg-surface-container border-border hover:border-white/20",
                            )}
                            style={{
                              backgroundColor: isSelected
                                ? tag.color
                                : undefined,
                              color: isSelected ? "#131313" : tag.color,
                            }}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                      {selectedTagId && (
                        <button
                          onClick={() => setSelectedTagId(null)}
                          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all bg-surface-container border border-red-500/20 text-red-400 hover:bg-red-500/10"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
                {filteredSavedRooms.map((room: SavedDataRoomOrganized) => (
                  <SavedRoomRow
                    key={room.library_id}
                    room={room}
                    folders={folders}
                    tags={tags}
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
                  </div>
                ) : (
                  filteredDecks.map((deck) => (
                    <DocumentRow
                      key={deck.library_id}
                      deck={deck}
                      folders={folders}
                      tags={tags}
                      onMoveToFolder={(folderId) =>
                        handleMoveToFolder(deck.library_id, folderId)
                      }
                      onUpdateTags={(tagIds) =>
                        handleUpdateTags(deck.library_id, tagIds)
                      }
                      onSaveNote={(note) => handleSaveNote(deck.deck_id, note)}
                      onUnsave={() => handleUnsaveRequest(deck)}
                      isUnsaving={unsaveTarget?.library_id === deck.library_id}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AlertDialog
        open={!!unsaveTarget}
        onOpenChange={(open) => {
          if (!open && !isUnsavingInProgress) {
            setUnsaveTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Document</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{unsaveTarget?.title}" from your library? Your private
              notes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnsavingInProgress}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                handleConfirmUnsave();
              }}
              disabled={isUnsavingInProgress}
            >
              {isUnsavingInProgress ? "Removing..." : "Remove Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateFolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => {
          setIsCreateFolderModalOpen(false);
          setEditingFolder(null);
        }}
        onCreate={editingFolder ? handleSaveEditFolder : handleCreateFolder}
        existingTags={tags}
        initialData={
          editingFolder
            ? {
                name: editingFolder.name,
                color: editingFolder.color,
                tags: editingFolder.tags.map((t) => t.name),
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
        onDelete={actions.deleteTag}
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
