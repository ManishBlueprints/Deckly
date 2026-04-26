import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronRight,
  FileText,
  FolderOpen,
  MessageSquareText,
} from "lucide-react";
import ImageDeckViewer from "../components/viewer/ImageDeckViewer";
import DeckViewer from "../components/viewer/DeckViewer";
import { AuthModal } from "../components/auth/AuthModal";
import { RoomNotesSidebar } from "../components/viewer/RoomNotesSidebar";
import { DataRoomSidebar } from "../components/viewer/DataRoomSidebar";
import { buildDataRoomSidebarSections } from "../components/viewer/dataRoomSidebarUtils";
import { dataRoomService } from "../services/dataRoomService";
import { dataRoomFolderService } from "../services/dataRoomFolderService";
import { dataRoomLibraryService } from "../services/dataRoomLibraryService";
import { useAuth } from "../contexts/AuthContext";
import { DataRoom, DataRoomDocument, DataRoomFolderWithTags, Deck } from "../types";
import {
  useIsDataRoomSaved,
  useSaveDataRoomToLibraryMutation,
} from "../hooks/useDataRoomViewerQueries";

function OwnerDataRoomPreview() {
  const { roomId } = useParams<{ roomId: string }>();
  const { session } = useAuth();
  const [room, setRoom] = useState<DataRoom | null>(null);
  const [documents, setDocuments] = useState<DataRoomDocument[]>([]);
  const [folders, setFolders] = useState<DataRoomFolderWithTags[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "notes" | null>(null);

  const { data: isSaved = false } = useIsDataRoomSaved(room?.id, session?.user?.id);
  const saveToLibraryMutation = useSaveDataRoomToLibraryMutation(session?.user?.id);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadRoom() {
      if (!roomId) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        if (isMounted) {
          setLoading(true);
          setError(null);
        }
        const roomData = await dataRoomService.getDataRoomById(
          roomId,
          session?.user?.id,
        );
        if (!roomData) {
          if (isMounted) setError("Data room not found.");
          return;
        }

        const [docs, roomFolders] = await Promise.all([
          dataRoomService.getDocuments(roomId, { signUrls: true }),
          dataRoomFolderService.listFolders(roomId),
        ]);
        if (!isMounted) return;

        setRoom(roomData);
        setDocuments(docs);
        setFolders(roomFolders);
        setSelectedDeck(docs[0]?.deck || null);
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load preview.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRoom();
    return () => {
      isMounted = false;
    };
  }, [roomId, session?.user?.id]);

  useEffect(() => {
    if (!session || !room) return;

    const pendingSaveId = localStorage.getItem("pending_save_data_room_id");
    if (pendingSaveId === room.id) {
      localStorage.removeItem("pending_save_data_room_id");
      if (!isSaved) {
        void saveToLibraryMutation
          .mutateAsync({ dataRoomId: room.id, save: true, roomSnapshot: room })
          .then(() => {
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 3000);
          })
          .catch((err: unknown) => {
            console.error("[OwnerDataRoomPreview] pending save failed", err);
          });
      }
    }

    const pendingRoomAction = localStorage.getItem("pending_data_room_action");
    if (pendingRoomAction === "notes" && pendingAction === "notes") {
      localStorage.removeItem("pending_data_room_action");
      setIsNotesOpen(true);
      setPendingAction(null);
    }

    if (isSaved) {
      dataRoomLibraryService.updateLibraryLastViewed(room.id);
    }
  }, [session, room?.id, isSaved, saveToLibraryMutation, pendingAction, room]);

  const visibleDocuments = documents.filter((doc) =>
    activeFolderId === null ? !doc.folder_id : doc.folder_id === activeFolderId,
  );

  const sidebarSections = useMemo(
    () => buildDataRoomSidebarSections(documents, folders),
    [documents, folders],
  );

  useEffect(() => {
    if (visibleDocuments.length > 0) {
      setSelectedDeck(visibleDocuments[0].deck || null);
      return;
    }
    setSelectedDeck(null);
  }, [activeFolderId, documents, visibleDocuments]);

  const handleSave = () => {
    if (!room) return;

    if (!session) {
      localStorage.setItem("pending_save_data_room_id", room.id);
      setPendingAction("save");
      setShowAuthModal(true);
      return;
    }

    const nextSaveState = !isSaved;
    if (nextSaveState) {
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    }
    void saveToLibraryMutation.mutateAsync({
      dataRoomId: room.id,
      save: nextSaveState,
      roomSnapshot: room,
    });
  };

  const handleNotes = () => {
    if (!room) return;

    if (!session) {
      localStorage.setItem("pending_data_room_action", "notes");
      setPendingAction("notes");
      setShowAuthModal(true);
      return;
    }

    setIsNotesOpen(true);
  };

  return (
    <div className="fixed inset-0 bg-[#0d0d0d] flex flex-col items-stretch overflow-hidden">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0d0d0d]"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-[#222]" />
              <div className="absolute inset-0 w-12 h-12 rounded-full border-t-2 border-deckly-primary animate-spin" />
            </div>
            <p className="text-slate-500 text-xs font-semibold tracking-wider">
              Loading Private Room Preview...
            </p>
          </motion.div>
        ) : error || !room ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-[#0d0d0d]"
          >
            <div className="max-w-md w-full bg-[#111] border border-[#222] rounded-lg p-10 text-center shadow-xl">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">
                Preview Unavailable
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                {error || "This room preview could not be loaded."}
              </p>
              <Link to="/rooms">
                <button className="w-full px-6 py-3 bg-white text-black font-semibold rounded-md flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
                  <ArrowLeft size={18} />
                  Return to Rooms
                </button>
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-stretch relative"
          >
            <div className="hidden">
            <AnimatePresence>
              {isMobile && sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSidebarOpen(false)}
                  className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
                />
              )}
            </AnimatePresence>

            <div
              className={`
                ${sidebarOpen ? (isMobile ? "w-[240px]" : "w-64") : "w-0"}
                bg-[#111] border-r border-[#222] flex flex-col transition-all duration-500 overflow-hidden shrink-0 relative z-50 shadow-xl
                ${isMobile ? "absolute inset-y-0 left-0" : "relative"}
              `}
            >
              <div className="p-6 border-b border-[#222] bg-[#1a1a1a]/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-[#1a1a1a] flex items-center justify-center border border-[#333]">
                    <FileText size={18} className="text-deckly-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xs font-semibold text-slate-200 truncate">
                      {room.name}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {documents.length} {documents.length === 1 ? "Document" : "Documents"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                {visibleDocuments.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <FileText size={12} className="text-slate-500" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Documents
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      {visibleDocuments.map((doc) => {
                        const deck = doc.deck;
                        const isActive = deck?.id !== undefined && selectedDeck?.id !== undefined && selectedDeck.id === deck.id;

                        return (
                          <button
                            key={doc.deck_id}
                            onClick={() => deck && setSelectedDeck(deck)}
                            className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md border transition-all duration-200 group ${isActive ? "bg-deckly-primary/5 border-deckly-primary/30" : "hover:bg-[#1a1a1a] border-transparent"}`}
                          >
                            <div className={`w-9 h-7 rounded-sm bg-black/40 border overflow-hidden shrink-0 transition-all duration-500 ${isActive ? "border-deckly-primary/40" : "border-[#222] grayscale group-hover:grayscale-0"}`}>
                              {deck?.pages?.[0]?.image_url ? (
                                <img src={deck.pages[0].image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <FileText size={16} className="text-slate-800" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold truncate transition-colors ${isActive ? "text-deckly-primary" : "text-slate-300 group-hover:text-deckly-primary"}`}>
                                {deck?.title || "Untitled Resource"}
                              </p>
                              <p className={`text-[10px] font-medium mt-0.5 transition-colors ${isActive ? "text-deckly-primary/60" : "text-slate-600"}`}>
                                {deck?.pages?.length || 0} Slides
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {folders.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <FolderOpen size={12} className="text-deckly-primary" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Folders
                      </p>
                    </div>

                    {folders.map((folder) => {
                      const folderDocs = documents.filter((doc) => doc.folder_id === folder.id);
                      const isActive = activeFolderId === folder.id;
                      const isExpanded = expandedFolders[folder.id] ?? false;

                      return (
                        <section key={folder.id} className="space-y-2">
                          <div className="flex items-center justify-between gap-3 px-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveFolderId(folder.id);
                                  setExpandedFolders((prev) => ({
                                    ...prev,
                                    [folder.id]: !(prev[folder.id] ?? false),
                                  }));
                                }}
                                className="flex min-w-0 items-center gap-2 text-left"
                              >
                              <ChevronRight
                                size={13}
                                className={`text-deckly-primary shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              />
                              <h3 className={`text-[10px] font-bold uppercase tracking-[0.2em] truncate ${isActive ? "text-slate-100" : "text-slate-300"}`}>
                                {folder.name}
                              </h3>
                            </button>
                            <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold text-slate-400">
                              {folderDocs.length}
                            </span>
                          </div>

                          {isExpanded && (
                            <div className="space-y-1.5">
                              {folderDocs.map((doc) => {
                                const deck = doc.deck;
                                const docActive = selectedDeck?.id === deck?.id;

                                return (
                                  <button
                                    key={doc.deck_id}
                                    onClick={() => deck && setSelectedDeck(deck)}
                                    className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md border transition-all duration-200 group ${docActive ? "bg-deckly-primary/5 border-deckly-primary/30" : "hover:bg-[#1a1a1a] border-transparent"}`}
                                  >
                                    <div className={`w-9 h-7 rounded-sm bg-black/40 border overflow-hidden shrink-0 transition-all duration-500 ${docActive ? "border-deckly-primary/40" : "border-[#222] grayscale group-hover:grayscale-0"}`}>
                                      {deck?.pages?.[0]?.image_url ? (
                                        <img src={deck.pages[0].image_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <FileText size={16} className="text-slate-800" />
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <p className={`text-xs font-semibold truncate transition-colors ${docActive ? "text-deckly-primary" : "text-slate-300 group-hover:text-deckly-primary"}`}>
                                        {deck?.title || "Untitled Resource"}
                                      </p>
                                      <p className={`text-[10px] font-medium mt-0.5 transition-colors ${docActive ? "text-deckly-primary/60" : "text-slate-600"}`}>
                                        {deck?.pages?.length || 0} Slides
                                      </p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {!isMobile && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="absolute top-1/2 -translate-y-1/2 z-30 w-6 h-10 flex items-center justify-center bg-[#111] border border-[#222] rounded-r-md text-slate-500 hover:text-deckly-primary transition-all shadow-xl"
                style={{ left: sidebarOpen ? "16rem" : "0" }}
              >
                <ChevronRight
                  size={16}
                  className={`transition-transform duration-500 ${sidebarOpen ? "rotate-180" : ""}`}
                />
              </button>
            )}

            {isMobile && !sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="absolute top-6 left-4 z-[100] w-9 h-9 flex items-center justify-center bg-[#111] border border-[#333] rounded-md text-white shadow-xl active:scale-95"
              >
                <ChevronRight size={18} />
              </button>
            )}

            </div>

            <DataRoomSidebar
              roomName={room.name}
              roomIconUrl={room.icon_url}
              totalDocuments={documents.length}
              totalLabel="Documents"
              sections={sidebarSections}
              selectedDeckId={selectedDeck?.id || null}
              onSelectDeck={(deck) => setSelectedDeck(deck)}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
              isMobile={isMobile}
              emptyMessage="No resources found in this room."
            />

            <div className="flex-1 flex flex-col items-stretch relative">
              <div className="absolute top-4 left-4 md:top-6 md:left-6 z-[100] flex flex-wrap items-center gap-2 px-2 md:px-0">
                <Link
                  to="/rooms"
                  className="group"
                >
                  <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-[#111] border border-[#333] rounded-md text-slate-400 hover:text-white transition-all active:scale-95">
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    <span className="text-xs font-semibold">
                      {isMobile ? "Exit" : "Back to Rooms"}
                    </span>
                  </div>
                </Link>

                <button
                  onClick={handleSave}
                  disabled={saveToLibraryMutation.isPending}
                  className={`
                    flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 border transition-all active:scale-95 rounded-md
                    ${
                      isSaved
                        ? "bg-deckly-primary/10 border-deckly-primary/30 text-deckly-primary"
                        : "bg-[#111] border-[#333] text-slate-400 hover:text-white"
                    }
                  `}
                >
                  {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  <span className="text-xs font-semibold">
                    {saveToLibraryMutation.isPending
                      ? "Saving..."
                      : isSaved
                        ? "Saved"
                        : "Save"}
                  </span>
                </button>

                <button
                  onClick={handleNotes}
                  className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-[#111] border border-[#333] text-slate-400 hover:text-white transition-all rounded-md active:scale-95"
                >
                  <MessageSquareText size={16} />
                  <span className="text-xs font-semibold">Notes</span>
                </button>
              </div>

              <div className="flex-1 w-full h-full relative">
                {selectedDeck ? (
                  Array.isArray(selectedDeck.pages) && selectedDeck.pages.length > 0 ? (
                    <ImageDeckViewer deck={selectedDeck} isOwner dataRoomId={room.id} />
                  ) : (
                    <DeckViewer deck={selectedDeck} isOwner dataRoomId={room.id} />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <FileText size={48} className="mb-4 opacity-30" />
                    <p className="text-sm font-medium">Select a document to view</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        message="Sign up to save rooms or keep private room notes."
        redirectTo={window.location.href}
      />

      {room && (
        <RoomNotesSidebar
          isOpen={isNotesOpen}
          onClose={() => setIsNotesOpen(false)}
          dataRoomId={room.id}
          onRequireAuth={() => {
            setIsNotesOpen(false);
            localStorage.setItem("pending_data_room_action", "notes");
            setPendingAction("notes");
            setShowAuthModal(true);
          }}
        />
      )}

      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-3 px-5 py-3 bg-[#111] border border-[#333] text-white rounded-lg shadow-2xl"
          >
            <div className="w-6 h-6 bg-deckly-primary/10 border border-deckly-primary/20 rounded-full flex items-center justify-center text-deckly-primary">
              <Check size={14} strokeWidth={3} />
            </div>
            <span className="text-sm font-medium">Saved</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OwnerDataRoomPreview;
