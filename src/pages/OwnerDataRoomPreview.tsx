import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  FileText,
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
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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

  const sidebarSections = useMemo(
    () => buildDataRoomSidebarSections(documents, folders),
    [documents, folders],
  );

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
