import { useState, useEffect, useCallback, useMemo } from "react";
import { deckService } from "../services/deckService";
import { organizerService } from "../services/organizerService";
import { LibraryFolder, LibraryTag, SavedDeckOrganized } from "../types";
import { useAuth } from "../contexts/AuthContext";
import {
  Loader2,
  Filter,
  Tag
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmModal } from "./common/ConfirmModal";
import { SavedDeckEmptyState } from "./saved-decks/SavedDeckEmptyState";
import { CreateFolderModal } from "./saved-decks/CreateFolderModal";
import { FolderCard } from "./saved-decks/FolderCard";
import { DocumentRow } from "./saved-decks/DocumentRow";
import { ManageTagsModal } from "./saved-decks/ManageTagsModal";

export function SavedDecksView() {
  const { session } = useAuth();
  const [decks, setDecks] = useState<SavedDeckOrganized[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [tags, setTags] = useState<LibraryTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unsaveTarget, setUnsaveTarget] = useState<SavedDeckOrganized | null>(null);
  const [isUnsavingInProgress, setIsUnsavingInProgress] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isManageTagsModalOpen, setIsManageTagsModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<LibraryFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<LibraryFolder | null>(null);
  const [isDeletingInProgress, setIsDeletingInProgress] = useState(false);

  // Filter State
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all'>('all');
  const [selectedTagId, _setSelectedTagId] = useState<string | null>(null);
  const [searchQuery, _setSearchQuery] = useState("");

  const fetchLibraryData = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      // Use Promise.allSettled to prevent one failure from breaking the whole view
      const results = await Promise.allSettled([
        organizerService.getSavedDecksOrganized(),
        organizerService.getFolders(),
        organizerService.getTags()
      ]);

      if (results[0].status === 'fulfilled') setDecks(results[0].value);
      if (results[1].status === 'fulfilled') setFolders(results[1].value);
      if (results[2].status === 'fulfilled') setTags(results[2].value);
      
      // Log errors if any
      results.forEach((res, i) => {
        if (res.status === 'rejected') {
          console.error(`Failed to fetch library data part ${i}:`, res.reason);
        }
      });
    } catch (err) {
      console.error("Critical failure during fetchLibraryData:", err);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchLibraryData();
  }, [fetchLibraryData]);

  const filteredDecks = useMemo(() => {
    return decks.filter(deck => {
      // Folder filter
      const matchesFolder = 
        selectedFolderId === 'all' || 
        deck.folder_id === selectedFolderId;
      
      // Tag filter
      const matchesTag = 
        selectedTagId === null || 
        deck.tags.some(t => t.id === selectedTagId);
      
      // Search filter
      const matchesSearch = 
        searchQuery === '' || 
        deck.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesFolder && matchesTag && matchesSearch;
    });
  }, [decks, selectedFolderId, selectedTagId, searchQuery]);


  const handleConfirmUnsave = async () => {
    if (!unsaveTarget) return;

    setIsUnsavingInProgress(true);
    try {
      await deckService.removeFromLibrary(unsaveTarget.library_id);
      setDecks((prev) => prev.filter((d) => d.library_id !== unsaveTarget.library_id));
      setUnsaveTarget(null);
    } catch (err) {
      console.error("Failed to unsave deck:", err);
    } finally {
      setIsUnsavingInProgress(false);
    }
  };

  const handleUnsaveClick = (deck: SavedDeckOrganized) => {
    setUnsaveTarget(deck);
  };

  const handleUpdateTags = async (deckId: string, tagIds: string[]) => {
    try {
      await organizerService.updateDeckTags(deckId, tagIds);
      const newTags = tags.filter(t => tagIds.includes(t.id));
      setDecks((prev) => 
        prev.map((d) => 
          d.library_id === deckId ? { ...d, tags: newTags } : d
        )
      );
    } catch (err) {
      console.error("Failed to update tags:", err);
    }
  };

  const handleCreateFolder = async (name: string, color: string, tagNames: string[]) => {
    try {
      const newFolder = await organizerService.createFolder(name, color, tagNames);
      setFolders((prev) => [...prev, newFolder]);
      setIsCreateFolderModalOpen(false);
      // Refresh tags because creation might generate new tags
      await updateTagsList();
    } catch (err) {
      console.error("Failed to create folder:", err);
      throw err;
    }
  };

  const handleSaveEditFolder = async (name: string, color: string, tagNames: string[]) => {
    if (!editingFolder) return;
    try {
      const updatedFolder = await organizerService.updateFolder(editingFolder.id, name, color, tagNames);
      setFolders((prev) => prev.map(f => f.id === updatedFolder.id ? { ...f, name: updatedFolder.name, color: updatedFolder.color, tags: updatedFolder.tags } : f));
      setEditingFolder(null);
      setIsCreateFolderModalOpen(false);
      // Refresh tags because update might generate new tags
      await updateTagsList();
    } catch (err) {
      console.error("Failed to update folder:", err);
      throw err;
    }
  };

  const handleConfirmDeleteFolder = async () => {
    if (!deletingFolder) return;
    setIsDeletingInProgress(true);
    try {
      await organizerService.deleteFolder(deletingFolder.id);
      setFolders((prev) => prev.filter(f => f.id !== deletingFolder.id));
      if (selectedFolderId === deletingFolder.id) setSelectedFolderId('all');
      setDeletingFolder(null);
    } catch (err) {
      console.error("Failed to delete folder:", err);
    } finally {
      setIsDeletingInProgress(false);
    }
  };

  const updateTagsList = async () => {
    try {
      const refreshedTags = await organizerService.getTags();
      setTags(refreshedTags);
    } catch (err) {
      console.error("Failed to refresh tags:", err);
    }
  };

  const handleCreateTag = async (name: string, color: string) => {
    await organizerService.createTag(name, color);
    await updateTagsList();
  };

  const handleUpdateTag = async (id: string, name: string, color: string) => {
    await organizerService.updateTag(id, name, color);
    await updateTagsList();
    setFolders(prev => prev.map(f => ({
      ...f,
      tags: f.tags.map(t => t.id === id ? { ...t, name, color } : t)
    })));
    setDecks(prev => prev.map(d => ({
      ...d,
      tags: d.tags ? d.tags.map(t => t.id === id ? { ...t, name, color } : t) : []
    })));
  };

  const handleDeleteTag = async (id: string) => {
    await organizerService.deleteTag(id);
    await updateTagsList();
    setFolders(prev => prev.map(f => ({
      ...f,
      tags: f.tags.filter(t => t.id !== id)
    })));
    setDecks(prev => prev.map(d => ({
      ...d,
      tags: d.tags ? d.tags.filter(t => t.id !== id) : []
    })));
  };

  const handleMoveDeck = async (deckId: string, folderId: string | null) => {
    try {
      await organizerService.updateDeckFolder(deckId, folderId);
      setDecks((prev) => 
        prev.map((d) => 
          d.library_id === deckId ? { ...d, folder_id: folderId } : d
        )
      );
    } catch (err) {
      console.error("Failed to move deck:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20 bg-[#131313] h-full min-h-[calc(100vh-140px)]">
        <Loader2 className="animate-spin text-[#54e98a]" size={32} />
      </div>
    );
  }

  // Global Empty State (Zero decks and folders)
  if (decks.length === 0 && folders.length === 0 && !isLoading) {
    return (
      <div className="min-h-[calc(100vh-140px)] bg-[#131313] overflow-hidden">
        <SavedDeckEmptyState onCreateFolder={() => setIsCreateFolderModalOpen(true)} />
        <CreateFolderModal 
          isOpen={isCreateFolderModalOpen}
          onClose={() => { setIsCreateFolderModalOpen(false); setEditingFolder(null); }}
          onCreate={editingFolder ? handleSaveEditFolder : handleCreateFolder}
          existingTags={tags}
          initialData={editingFolder ? { name: editingFolder.name, color: editingFolder.color, tags: editingFolder.tags.map(t => t.name) } : null}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-140px)] bg-deckly-background">
      <main className="overflow-y-auto custom-scrollbar">
        <div className="p-6 md:p-12 space-y-16 w-full max-w-[1600px] mx-auto pb-32">
          
          {/* Main Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-8">
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#54e98a]">Asset Repository</span>
              <h1 className="text-6xl font-headline font-extrabold text-[#e5e2e1] tracking-tighter">
                Saved Data
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <button className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-[#bbcbbb]/60 hover:text-white transition-all">
                <Filter size={14} />
                Filter By
              </button>
              <button 
                onClick={() => setIsManageTagsModalOpen(true)}
                className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-[#bbcbbb]/60 hover:text-white transition-all"
              >
                <Tag size={14} />
                Manage Tags
              </button>
            </div>
          </div>

          {/* Active Folders Section */}
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-8 h-1 bg-[#54e98a] rounded-full" />
              <h2 className="text-xl font-headline font-bold text-[#e5e2e1]">Active Folders</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <FolderCard isNew onClick={() => { setEditingFolder(null); setIsCreateFolderModalOpen(true); }} />
              {folders.map(folder => (
                <FolderCard 
                  key={folder.id} 
                  folder={folder} 
                  isActive={selectedFolderId === folder.id}
                  onClick={() => setSelectedFolderId(selectedFolderId === folder.id ? 'all' : folder.id)}
                  onEdit={(f) => { setEditingFolder(f); setIsCreateFolderModalOpen(true); }}
                  onDelete={(f) => setDeletingFolder(f)}
                />
              ))}
            </div>
          </div>

          {/* Documents Section */}
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-8 h-1 bg-[#54e98a] rounded-full opacity-40" />
                <h2 className="text-xl font-headline font-bold text-[#e5e2e1]">
                  {selectedFolderId === 'all' 
                    ? "Uncategorized Docs" 
                    : folders.find(f => f.id === selectedFolderId)?.name
                  }
                </h2>
              </div>
              
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#bbcbbb]/20">Total Inventory</p>
                <p className="text-lg font-headline font-bold text-[#e5e2e1]">{decks.length} Active Decks</p>
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
                    <div className="w-20 h-20 bg-[#161616] rounded-3xl flex items-center justify-center text-[#54e98a]/20 mx-auto border border-white/5 mb-6">
                      <span className="material-symbols-outlined text-4xl">inventory_2</span>
                    </div>
                    <p className="text-[#bbcbbb]/40 font-bold">No documents matching the current filter</p>
                  </motion.div>
                ) : (
                  filteredDecks.map((deck) => (
                    <DocumentRow
                      key={deck.library_id}
                      deck={deck}
                      folders={folders}
                      tags={tags}
                      onMoveToFolder={(folderId) => handleMoveDeck(deck.library_id, folderId)}
                      onUpdateTags={(tagIds) => handleUpdateTags(deck.library_id, tagIds)}
                      onUnsave={() => handleUnsaveClick(deck)}
                      isUnsaving={unsaveTarget?.library_id === deck.library_id}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Removed Floating Action Button */}


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
        onClose={() => { setIsCreateFolderModalOpen(false); setEditingFolder(null); }}
        onCreate={editingFolder ? handleSaveEditFolder : handleCreateFolder}
        existingTags={tags}
        initialData={editingFolder ? { name: editingFolder.name, color: editingFolder.color, tags: editingFolder.tags.map(t => t.name) } : null}
      />

      <ManageTagsModal
        isOpen={isManageTagsModalOpen}
        onClose={() => setIsManageTagsModalOpen(false)}
        tags={tags}
        onCreate={handleCreateTag}
        onUpdate={handleUpdateTag}
        onDelete={handleDeleteTag}
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
