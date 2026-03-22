import { useState, useMemo, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { LibraryFolder, SavedDeckOrganized } from "../types";
import { Loader2, Filter, Tag, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmModal } from "./common/ConfirmModal";
import { SavedDeckEmptyState } from "./saved-decks/SavedDeckEmptyState";
import { CreateFolderModal } from "./saved-decks/CreateFolderModal";
import { FolderCard } from "./saved-decks/FolderCard";
import { DocumentRow } from "./saved-decks/DocumentRow";
import { ManageTagsModal } from "./saved-decks/ManageTagsModal";
import { useLibrary } from "../hooks/useLibrary";
import { cn } from "../utils/cn";

export function SavedDecksView() {
  const { session } = useAuth();
  const { decks, folders, tags, isLoading, actions } = useLibrary(session?.user?.id);

  // --- UI state only ---
  const [selectedFolderId, setSelectedFolderId] = useState<string | "all">("all");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Modal state
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isManageTagsModalOpen, setIsManageTagsModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<LibraryFolder | null>(null);

  // Confirm dialog state
  const [unsaveTarget, setUnsaveTarget] = useState<SavedDeckOrganized | null>(null);
  const [isUnsavingInProgress, setIsUnsavingInProgress] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<LibraryFolder | null>(null);
  const [isDeletingInProgress, setIsDeletingInProgress] = useState(false);

  // --- Derived / filtered list ---
  const filteredDecks = useMemo(
    () =>
      decks.filter((deck) => {
        // When 'all' is selected only show truly uncategorized decks (no folder)
        const matchesFolder =
          selectedFolderId === "all"
            ? deck.folder_id === null
            : deck.folder_id === selectedFolderId;
        const matchesTag =
          selectedTagId === null || deck.tags.some((t) => t.id === selectedTagId);
        const matchesSearch =
          searchQuery === "" ||
          deck.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFolder && matchesTag && matchesSearch;
      }),
    [decks, selectedFolderId, selectedTagId, searchQuery]
  );

  // --- Confirm: Unsave deck ---
  const handleConfirmUnsave = useCallback(async () => {
    if (!unsaveTarget) return;
    setIsUnsavingInProgress(true);
    try {
      await actions.unsaveDeck(unsaveTarget.deck_id);
      setUnsaveTarget(null);
    } catch (err) {
      console.error("Failed to unsave deck:", err);
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
      if (selectedFolderId === deletingFolder.id) setSelectedFolderId("all");
      setDeletingFolder(null);
    } catch (err) {
      console.error("Failed to delete folder:", err);
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
    [actions]
  );

  const handleSaveEditFolder = useCallback(
    async (name: string, color: string, tagNames: string[]) => {
      if (!editingFolder) return;
      await actions.updateFolder(editingFolder, name, color, tagNames);
      setEditingFolder(null);
      setIsCreateFolderModalOpen(false);
    },
    [editingFolder, actions]
  );

  // --- Loading / empty states ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20 bg-background h-full min-h-[calc(100vh-140px)]">
        <Loader2 className="animate-spin text-[#54e98a]" size={32} />
      </div>
    );
  }

  if (decks.length === 0 && folders.length === 0) {
    return (
      <div className="min-h-[calc(100vh-140px)] bg-background overflow-hidden">
        <SavedDeckEmptyState onCreateFolder={() => setIsCreateFolderModalOpen(true)} />
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
              ? { name: editingFolder.name, color: editingFolder.color, tags: editingFolder.tags.map((t) => t.name) }
              : null
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-140px)] bg-background">
      <main className="overflow-y-auto custom-scrollbar">
        <div className="p-6 md:p-12 space-y-16 w-full max-w-[1600px] mx-auto pb-32">

          {/* Main Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-8">
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#54e98a]">
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
                    : "bg-white/5 border-white/10 text-[#bbcbbb]/60 hover:text-white"
                )}
              >
                <Filter size={14} />
                Filter By
              </button>
              <button
                onClick={() => setIsManageTagsModalOpen(true)}
                className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 text-xs font-bold text-[#bbcbbb]/60 hover:text-white transition-all"
              >
                <Tag size={14} />
                Manage Tags
              </button>
            </div>
          </div>

          {/* Filter Expandable */}
          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 bg-surface-low border border-white/5 flex flex-col md:flex-row gap-6">
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
                            onClick={() => setSelectedTagId(isSelected ? null : tag.id)}
                            className={cn(
                              "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all border",
                              isSelected
                                ? "border-transparent text-[#131313]"
                                : "bg-surface-container border-white/10 hover:border-white/20"
                            )}
                            style={{
                              backgroundColor: isSelected ? tag.color : undefined,
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
                          className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all bg-surface-container border border-red-500/20 text-red-400 hover:bg-red-500/10"
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
              <h2 className="text-xl font-headline font-bold text-[#e5e2e1]">Active Folders</h2>
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
                  onClick={() =>
                    setSelectedFolderId(selectedFolderId === folder.id ? "all" : folder.id)
                  }
                  onEdit={(f) => {
                    setEditingFolder(f);
                    setIsCreateFolderModalOpen(true);
                  }}
                  onDelete={(f) => setDeletingFolder(f)}
                />
              ))}
            </div>
          </div>

          {/* Documents */}
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-8 h-1 bg-[#54e98a] rounded-full opacity-40" />
                <h2 className="text-xl font-headline font-bold text-[#e5e2e1]">
                  {selectedFolderId === "all"
                    ? "Uncategorized Docs"
                    : folders.find((f) => f.id === selectedFolderId)?.name}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#bbcbbb]/20">
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
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-32 text-center"
                  >
                    <div className="w-20 h-20 bg-surface-low flex items-center justify-center text-[#54e98a]/20 mx-auto border border-white/5 mb-6">
                      <span className="material-symbols-outlined text-4xl">inventory_2</span>
                    </div>
                    <p className="text-[#bbcbbb]/40 font-bold">
                      No documents matching the current filter
                    </p>
                  </motion.div>
                ) : (
                  filteredDecks.map((deck) => (
                    <DocumentRow
                      key={deck.library_id}
                      deck={deck}
                      folders={folders}
                      tags={tags}
                      onMoveToFolder={(folderId) => actions.moveDeck(deck.library_id, folderId)}
                      onUpdateTags={(tagIds) => actions.updateDeckTags(deck.library_id, tagIds)}
                      onUnsave={() => setUnsaveTarget(deck)}
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
      <ConfirmModal
        isOpen={!!unsaveTarget}
        onClose={() => setUnsaveTarget(null)}
        onConfirm={handleConfirmUnsave}
        isLoading={isUnsavingInProgress}
        title="Remove Document"
        message={`Remove "${unsaveTarget?.title}" from your library? Your private notes will be lost.`}
        confirmText="Remove Now"
        variant="danger"
      />

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
            ? { name: editingFolder.name, color: editingFolder.color, tags: editingFolder.tags.map((t) => t.name) }
            : null
        }
      />

      <ManageTagsModal
        isOpen={isManageTagsModalOpen}
        onClose={() => setIsManageTagsModalOpen(false)}
        tags={tags}
        onCreate={(name, color) => actions.createTag(name, color).then(() => undefined)}
        onUpdate={actions.updateTag}
        onDelete={actions.deleteTag}
      />

      <ConfirmModal
        isOpen={!!deletingFolder}
        onClose={() => setDeletingFolder(null)}
        onConfirm={handleConfirmDeleteFolder}
        isLoading={isDeletingInProgress}
        title="Delete Folder"
        message={`Are you sure you want to delete "${deletingFolder?.name}"? Documents inside will not be deleted but will become Uncategorized.`}
        confirmText="Delete Folder"
        variant="danger"
      />
    </div>
  );
}
