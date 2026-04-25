import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import { FileText, Loader2 } from "lucide-react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { DocumentPicker } from "../components/dashboard/DocumentPicker";
import { DataRoom, DataRoomDocument } from "../types";
import { dataRoomService } from "../services/dataRoomService";
import { RoomDocumentList } from "../components/dashboard/RoomDocumentList";
import { deckService } from "../services/deckService";
import { useAuth } from "../contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  getRoomVisitorSignals,
  VisitorSignal,
} from "../services/interestSignalService";
import { getDataRoomPreviewPath, getDataRoomShareUrl } from "../utils/url";
import { useDataRoomFolders } from "../hooks/useDataRoomFolders";
import { DataRoomFolderModal } from "../components/data-room/DataRoomFolderModal";
import { DataRoomTagsModal } from "../components/data-room/DataRoomTagsModal";
import { FolderColorKey } from "../constants/folderColors";
import { DataRoomFolderWithTags, DataRoomTag } from "../types";
import { DataRoomDetailHeader } from "../components/data-room/detail/DataRoomDetailHeader";
import { DataRoomDetailTabs, DataRoomDetailTab } from "../components/data-room/detail/DataRoomDetailTabs";
import { DataRoomContentToolbar } from "../components/data-room/detail/DataRoomContentToolbar";
import { DataRoomFolderStrip } from "../components/data-room/detail/DataRoomFolderStrip";
import { DataRoomAnalyticsPanel } from "../components/data-room/detail/DataRoomAnalyticsPanel";
import { DataRoomSettingsPanel } from "../components/data-room/detail/DataRoomSettingsPanel";
import { MetadataSearchMenu } from "../components/search/MetadataSearchMenu";
import { useMetadataSearchState } from "../hooks/useMetadataSearchState";
import { filterDataRoomDocuments } from "../utils/metadataSearchAdapters";
import { reorderDataRoomDocuments } from "../utils/dataRoomOrdering";
import { analyticsService } from "../services/analyticsService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

/* ───────── main page ───────── */
function DataRoomDetail() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const {
    folders,
    tags,
    isLoading: foldersLoading,
    actions: folderActions,
  } = useDataRoomFolders(roomId);

  const [room, setRoom] = useState<DataRoom | null>(null);
  const [documents, setDocuments] = useState<DataRoomDocument[]>([]);
  const [signedThumbnails, setSignedThumbnails] = useState<Record<string, string>>({});
  const [analytics, setAnalytics] = useState<{
    totalVisitors: number;
    perDeck: { deckId: string; title: string; visitors: number }[];
  }>({ totalVisitors: 0, perDeck: [] });
  const [roomLocations, setRoomLocations] = useState<{
    countries: { name: string; count: number; code: string }[];
    cities: { name: string; count: number; country: string }[];
  }>({ countries: [], cities: [] });
  const [roomDocumentStats, setRoomDocumentStats] = useState<{
    deckId: string;
    title: string;
    totalViews: number;
    totalTimeSeconds: number;
    uniqueVisitors: number;
  }[]>([]);

  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] =
    useState<DataRoomFolderWithTags | null>(null);
  const [deletingFolder, setDeletingFolder] =
    useState<DataRoomFolderWithTags | null>(null);
  const [isFolderDeletePending, setIsFolderDeletePending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<DataRoomDetailTab>("content");
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isUpdatingShareState, setIsUpdatingShareState] = useState(false);
  const search = useMetadataSearchState("data_room");

  const [roomSignals, setRoomSignals] = useState<VisitorSignal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);

  const folderDocumentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of documents) {
      if (!doc.folder_id) continue;
      counts.set(doc.folder_id, (counts.get(doc.folder_id) || 0) + 1);
    }
    return counts;
  }, [documents]);

  const folderLookup = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  );

  const visibleDocuments = useMemo(() => {
    return filterDataRoomDocuments(documents, search.filter, activeFolderId);
  }, [activeFolderId, documents, search.filter]);

  const workspaceHandle = profile?.handle;
  const shareUrlLabel = workspaceHandle
    ? `/${workspaceHandle}/room/${room?.slug ?? ""}`
    : "Set handle in profile to share";

  /* ── load data ── */
  // useCallback is used here to memoize the loading of room data, documents, and analytics
  // This prevents unnecessary re-fetching when the component re-renders
  const loadAll = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const [roomData, docs, analyticsData] = await Promise.all([
        dataRoomService.getDataRoomById(roomId),
        dataRoomService.getDocuments(roomId),
        dataRoomService.getDataRoomAnalytics(roomId),
      ]);
      if (!roomData) {
        navigate("/rooms");
        return;
      }
      setRoom(roomData);
      setDocuments(docs);
      setAnalytics(analyticsData);

      setSignalsLoading(true);
      getRoomVisitorSignals(roomId)
        .then(setRoomSignals)
        .catch((err) => {
          console.error("Failed to load visitor signals", err);
          setRoomSignals([]);
        })
        .finally(() => setSignalsLoading(false));

      analyticsService
        .getDataRoomLocations(roomId)
        .then(setRoomLocations)
        .catch((err: unknown) => {
          console.error("Failed to load room locations", err);
          setRoomLocations({ countries: [], cities: [] });
        });

      analyticsService
        .getDataRoomDocumentStats(roomId)
        .then(setRoomDocumentStats)
        .catch((err: unknown) => {
          console.error("Failed to load room document stats", err);
          setRoomDocumentStats([]);
        });
    } catch (err) {
      console.error("Failed to load room", err);
    } finally {
      setLoading(false);
    }
  }, [roomId, navigate]);

  const totalRoomViews = useMemo(
    () => roomDocumentStats.reduce((acc, doc) => acc + doc.totalViews, 0),
    [roomDocumentStats],
  );
  const totalRoomTimeSeconds = useMemo(
    () => roomDocumentStats.reduce((acc, doc) => acc + doc.totalTimeSeconds, 0),
    [roomDocumentStats],
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Re-sign thumbnails whenever documents change
  useEffect(() => {
    if (documents.length === 0) return;
    let mounted = true;

    deckService.signOwnerThumbnails().then((thumbs) => {
      if (mounted) setSignedThumbnails(thumbs);
    }).catch((err) => {
      if (mounted) console.error("Failed to sign Data Room thumbnails", err);
    });

    return () => {
      mounted = false;
    };
  }, [documents]);

  /* ── actions ── */
  const handleCopyLink = async () => {
    if (!room) return;
    if (!profile?.handle) {
      alert("Please set a handle in your profile settings before sharing.");
      return;
    }
    try {
      setIsUpdatingShareState(true);
      let currentRoom = room;

      // Only publish if not already public
      if (!currentRoom.is_public) {
        currentRoom = await dataRoomService.publishDataRoom(room.id);
        setRoom(currentRoom);
      }

      const url = getDataRoomShareUrl(profile.handle, currentRoom.slug);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to activate public link", err);
      toast.error(
        err instanceof Error
          ? `Failed to copy link: ${err.message}`
          : "Failed to activate public link. Please try again."
      );
    } finally {
      setIsUpdatingShareState(false);
    }
  };

  const handleMakePrivate = async () => {
    if (!room) return;

    try {
      setIsUpdatingShareState(true);
      const updated = await dataRoomService.unpublishDataRoom(room.id);
      setRoom(updated);
    } catch (err) {
      console.error("Failed to disable public link", err);
      toast.error(
        err instanceof Error
          ? `Failed to disable public link: ${err.message}`
          : "Failed to disable public link. Please try again."
      );
    } finally {
      setIsUpdatingShareState(false);
    }
  };

  const handleAddDocuments = async (deckIds: string[]) => {
    if (!roomId) return;
    await dataRoomService.addDocuments(roomId, deckIds);
    queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
    loadAll();
  };

  const handleSaveFolder = useCallback(
    async (input: { name: string; color: string; tagIds: string[] }) => {
      if (!roomId) return;
      if (editingFolder) {
        await folderActions.updateFolder(
          editingFolder.id,
          input.name,
          input.color,
          input.tagIds,
        );
      } else {
        await folderActions.createFolder(input.name, input.color, input.tagIds);
      }
      setEditingFolder(null);
      setFolderModalOpen(false);
      toast.success(editingFolder ? "Folder updated" : "Folder created");
    },
    [editingFolder, folderActions, roomId],
  );

  const handleDeleteFolder = useCallback(async () => {
    if (!deletingFolder) return;
    setIsFolderDeletePending(true);
    try {
      await folderActions.deleteFolder(deletingFolder.id);
      setDeletingFolder(null);
      await loadAll();
      toast.success("Folder deleted");
    } catch (err) {
      console.error("Failed to delete folder", err);
      toast.error("Failed to delete folder");
    } finally {
      setIsFolderDeletePending(false);
    }
  }, [deletingFolder, folderActions, loadAll]);

  const handleCreateTag = async (name: string, color?: string) => {
    if (!roomId) throw new Error("Room not found");
    return folderActions.createTag(name, color);
  };

  const handleUpdateTag = async (
    tagId: string,
    name: string,
    color?: string,
  ) => folderActions.updateTag(tagId, name, color);

  const handleDeleteTag = async (tagId: string) => {
    await folderActions.deleteTag(tagId);
    toast.success("Tag deleted");
  };

  const handleRemoveDocument = async (deckId: string) => {
    if (!roomId) return;
    await dataRoomService.removeDocument(roomId, deckId);
    queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
    setDocuments((prev) => prev.filter((d) => d.deck_id !== deckId));
    setAnalytics((prev) => ({
      ...prev,
      perDeck: prev.perDeck.filter((p) => p.deckId !== deckId),
    }));
  };

  const handleMoveDocumentToFolder = useCallback(
    async (documentId: string, folderId: string | null) => {
      if (!roomId) return;

      if (folderId && !folderLookup.has(folderId)) {
        toast.error("Selected folder is no longer available.");
        return;
      }

      const previousDocuments = documents;
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId ? { ...doc, folder_id: folderId } : doc,
        ),
      );

      try {
        await folderActions.moveDocumentToFolder(documentId, folderId);
        queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
      } catch (err) {
        setDocuments(previousDocuments);
        console.error("Failed to move document to folder", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to move document.",
        );
      }
    },
    [documents, folderActions, folderLookup, queryClient, roomId],
  );

  const handleUpdateDocumentTags = useCallback(
    async (documentId: string, tagIds: string[]) => {
      const previousDocuments = documents;
      const selectedTags = tags.filter((tag) => tagIds.includes(tag.id));

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId ? { ...doc, tags: selectedTags } : doc,
        ),
      );

      try {
        await folderActions.setDocumentTags(documentId, tagIds);
        queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
      } catch (err) {
        setDocuments(previousDocuments);
        console.error("Failed to update document tags", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to update tags.",
        );
      }
    },
    [documents, folderActions, queryClient, tags],
  );

  const handleReorderDocuments = async (orderedDeckIds: string[]) => {
    if (!roomId) return;
    if (search.isActive) {
      toast.info("Clear search to reorder documents");
      return;
    }
    const nextDocuments = reorderDataRoomDocuments(documents, orderedDeckIds);
    setDocuments(nextDocuments);
    await dataRoomService.reorderDocuments(
      roomId,
      nextDocuments.map((doc) => doc.deck_id),
    );
    queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
  };

  const handleDeleteRoom = async () => {
    if (!roomId) return;
    setDeleting(true);
    try {
      await dataRoomService.deleteDataRoom(roomId);
      queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
      queryClient.invalidateQueries({
        queryKey: ["user-total-stats", profile?.id],
      });
      navigate("/rooms");
    } catch (err) {
      console.error("Failed to delete room", err);
      setConfirmDelete(false);
      setDeleting(false);
    }
  };

  /* ── loading state ── */
  if (loading) {
    return (
      <DashboardLayout title="Data Rooms" showFab={false}>
        <div className="flex items-center justify-center py-32">
          <Loader2 size={28} className="text-deckly-primary animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!room) return null;

  return (
    <DashboardLayout title="Data Rooms" showFab={false}>
      <div className="space-y-4 md:space-y-6 pb-28 md:pb-12">
        <DataRoomDetailHeader
          room={room}
          isPublic={!!room.is_public}
          copied={copied}
          isUpdatingShareState={isUpdatingShareState}
          onCopyLink={() => void handleCopyLink()}
          onOpenPreview={() =>
            window.open(
              getDataRoomPreviewPath(room.id),
              "_blank",
              "noopener,noreferrer",
            )
          }
        />

        <DataRoomDetailTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "content" && (
          <DataRoomContentSection
            folders={folders}
            foldersLoading={foldersLoading}
            folderDocumentCounts={folderDocumentCounts}
            activeFolderId={activeFolderId}
            onSelectFolder={setActiveFolderId}
            onNewDeck={() => navigate(`/upload?returnToRoom=${roomId}`)}
            onAddExisting={() => setPickerOpen(true)}
            onNewFolder={() => {
              setEditingFolder(null);
              setFolderModalOpen(true);
            }}
            onEditFolder={(nextFolder) => {
              setEditingFolder(nextFolder);
              setFolderModalOpen(true);
            }}
            onDeleteFolder={(nextFolder) => setDeletingFolder(nextFolder)}
            onEditTags={() => setTagModalOpen(true)}
            search={search}
            documents={documents}
            visibleDocuments={visibleDocuments}
            onRemoveDocument={handleRemoveDocument}
            onReorderDocuments={handleReorderDocuments}
            tags={tags}
            onUpdateDocumentTags={handleUpdateDocumentTags}
            onMoveDocumentToFolder={handleMoveDocumentToFolder}
            onViewAnalytics={(deckId) => navigate(`/analytics/${deckId}`)}
            onEditDeck={(deckId) => navigate(`/edit/${deckId}`)}
            signedThumbnails={signedThumbnails}
          />
        )}

        {activeTab === "analytics" && (
          <DataRoomAnalyticsPanel
            totalVisitors={analytics.totalVisitors}
            totalViews={totalRoomViews}
            totalTimeSeconds={totalRoomTimeSeconds}
            roomLocations={roomLocations}
            roomDocumentStats={roomDocumentStats}
            signalsLoading={signalsLoading}
            roomSignals={roomSignals}
          />
        )}

        {activeTab === "settings" && (
          <DataRoomSettingsPanel
            isPublic={!!room.is_public}
            onTogglePublic={() => {
              if (room.is_public) {
                void handleMakePrivate();
                return;
              }
              void handleCopyLink();
            }}
            onEditRoom={() => navigate(`/rooms/${roomId}/edit`)}
            onDeleteRoom={() => setConfirmDelete(true)}
            shareUrlLabel={shareUrlLabel}
          />
        )}
      </div>

      {/* ── Delete Confirmation ── */}
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setConfirmDelete(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {room.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this room? This action cannot be
              undone and all visitors will be revoked access. Your original
              decks remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                handleDeleteRoom();
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Room"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Document Picker */}
      <DocumentPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={handleAddDocuments}
        excludeDeckIds={documents.map((d) => d.deck_id)}
      />

      <DataRoomFolderModal
        isOpen={folderModalOpen}
        onClose={() => {
          setFolderModalOpen(false);
          setEditingFolder(null);
        }}
        onSubmit={handleSaveFolder}
        existingTags={tags}
        initialData={
          editingFolder
            ? {
                name: editingFolder.name,
                color: editingFolder.color as FolderColorKey,
                tagIds: editingFolder.tags.map((tag: DataRoomTag) => tag.id),
              }
            : null
        }
      />

      <DataRoomTagsModal
        isOpen={tagModalOpen}
        onClose={() => setTagModalOpen(false)}
        tags={tags}
        onCreate={handleCreateTag}
        onUpdate={handleUpdateTag}
        onDelete={handleDeleteTag}
      />

      <AlertDialog
        open={!!deletingFolder}
        onOpenChange={(open) => {
          if (!open && !isFolderDeletePending) {
            setDeletingFolder(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete "{deletingFolder?.name}" permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the folder, but documents inside will return to
              Unorganized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isFolderDeletePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteFolder();
              }}
              disabled={isFolderDeletePending}
            >
              {isFolderDeletePending ? "Deleting..." : "Delete Folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

function DataRoomContentSection({
  folders,
  foldersLoading,
  folderDocumentCounts,
  activeFolderId,
  onSelectFolder,
  onNewDeck,
  onAddExisting,
  onNewFolder,
  onEditFolder,
  onDeleteFolder,
  onEditTags,
  search,
  documents,
  visibleDocuments,
  onRemoveDocument,
  onReorderDocuments,
  tags,
  onUpdateDocumentTags,
  onMoveDocumentToFolder,
  onViewAnalytics,
  onEditDeck,
  signedThumbnails,
}: {
  folders: DataRoomFolderWithTags[];
  foldersLoading: boolean;
  folderDocumentCounts: Map<string, number>;
  activeFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onNewDeck: () => void;
  onAddExisting: () => void;
  onNewFolder: () => void;
  onEditFolder: (folder: DataRoomFolderWithTags) => void;
  onDeleteFolder: (folder: DataRoomFolderWithTags) => void;
  onEditTags: () => void;
  search: ReturnType<typeof useMetadataSearchState>;
  documents: DataRoomDocument[];
  visibleDocuments: DataRoomDocument[];
  onRemoveDocument: (deckId: string) => Promise<void>;
  onReorderDocuments: (orderedDeckIds: string[]) => Promise<void>;
  tags: DataRoomTag[];
  onUpdateDocumentTags: (documentId: string, tagIds: string[]) => Promise<void>;
  onMoveDocumentToFolder: (documentId: string, folderId: string | null) => Promise<void>;
  onViewAnalytics: (deckId: string) => void;
  onEditDeck: (deckId: string) => void;
  signedThumbnails: Record<string, string>;
}) {
  return (
    <div className="space-y-6 md:space-y-8">
      <DataRoomContentToolbar
        onNewDeck={onNewDeck}
        onAddExisting={onAddExisting}
        onNewFolder={onNewFolder}
        onEditTags={onEditTags}
        searchControl={
          <MetadataSearchMenu
            filter={search.filter}
            isActive={search.isActive}
            onModeChange={search.setMode}
            onQueryChange={search.setQuery}
            onDatePresetChange={search.setDatePreset}
            onCustomDateRangeChange={search.setCustomDateRange}
            onClear={search.resetFilter}
            resultCount={visibleDocuments.length}
            triggerLabel="Search"
            namePlaceholder="Search document titles..."
          />
        }
      />

      <DataRoomFolderStrip
        folders={folders}
        folderDocumentCounts={folderDocumentCounts}
        loading={foldersLoading}
        activeFolderId={activeFolderId}
        onSelectFolder={onSelectFolder}
        onCreateFolder={onNewFolder}
        onEditFolder={onEditFolder}
        onDeleteFolder={onDeleteFolder}
      />

      <div className="rounded-xl md:rounded-2xl border border-white/5 bg-[#111] overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={14} className="text-slate-400" />
            <h2 className="text-base sm:text-lg font-semibold text-[#e5e2e1] truncate">
              {activeFolderId
                ? folders.find((folder) => folder.id === activeFolderId)?.name ??
                  "Documents / Decks"
                : "Unorganized Documents"}
            </h2>
            <span className="inline-flex items-center rounded-full border border-white/5 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-slate-400">
              {visibleDocuments.length}
            </span>
          </div>
        </div>
        {visibleDocuments.length === 0 ? (
          <div className="px-4 py-16 sm:px-6 sm:py-20 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-600">
              <FileText size={22} />
            </div>
            <p className="text-sm font-bold text-slate-400">
              {documents.length === 0 ? "No assets yet" : "No matching assets"}
            </p>
            <p className="text-xs text-slate-500">
              {documents.length === 0
                ? "Add decks to gate them inside this room."
                : "Clear your search or date filter to see everything again."}
            </p>
            <button
              onClick={onNewDeck}
              className="mt-2 rounded-xl bg-[#54e98a] px-5 py-3 text-sm font-bold text-[#003919] transition-all hover:opacity-90"
            >
              New Deck
            </button>
          </div>
        ) : (
          <div className="p-3 sm:p-4">
            <RoomDocumentList
              documents={visibleDocuments}
              onRemove={onRemoveDocument}
              onReorder={onReorderDocuments}
              folderOptions={folders.map((folder) => ({
                id: folder.id,
                name: folder.name,
              }))}
              onMoveToFolder={onMoveDocumentToFolder}
              availableTags={tags}
              onUpdateDocumentTags={onUpdateDocumentTags}
              onViewAnalytics={onViewAnalytics}
              onEditDeck={onEditDeck}
              signedThumbnails={signedThumbnails}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default DataRoomDetail;

