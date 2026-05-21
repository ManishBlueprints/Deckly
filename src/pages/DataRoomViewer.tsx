import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Check,
  FileText,
  MessageSquareText,
} from "lucide-react";
import ImageDeckViewer from "../components/viewer/ImageDeckViewer";
import DeckViewer from "../components/viewer/DeckViewer";
import AccessGate from "../components/viewer/AccessGate";
import { AuthModal } from "../components/auth/AuthModal";
import { DataRoomSidebar } from "../components/viewer/DataRoomSidebar";
import { buildDataRoomSidebarSections } from "../components/viewer/dataRoomSidebarUtils";
import { RoomNotesSidebar } from "../components/viewer/RoomNotesSidebar";
import { dataRoomService } from "../services/dataRoomService";
import { dataRoomFolderService } from "../services/dataRoomFolderService";
import { dataRoomLibraryService } from "../services/dataRoomLibraryService";
import { analyticsService } from "../services/analyticsService";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { DataRoom, DataRoomDocument, Deck } from "../types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useIsDataRoomSaved,
  useSaveDataRoomToLibraryMutation,
} from "../hooks/useDataRoomViewerQueries";

function DataRoomViewer() {
  const { handle, slug } = useParams<{ handle: string; slug: string }>();
  const { session } = useAuth();
  const [room, setRoom] = useState<DataRoom | null>(null);
  const [documents, setDocuments] = useState<DataRoomDocument[]>([]);
  const [folderGroups, setFolderGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [viewerEmail, setViewerEmail] = useState<string | undefined>();
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

  // Handle responsive sidebar and screen size
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

  // Fetches public data room details, enforces slugs, and checks expiry
  // Also validates if the current user is the owner to bypass the access gate
  const loadRoom = useCallback(async () => {
    if (!slug || !handle) {
      setError("Data room not found");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await dataRoomService.getDataRoomByHandleAndSlug(
        handle,
        slug,
      );
      if (!data) {
        setError("Data room not found");
        return;
      }

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError("LINK_EXPIRED");
        setRoom(data); // Keep room data for context
        return;
      }

      setRoom(data);

      // Check if current user is the owner
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const isOwner = session?.user?.id === data.user_id;

      let docsToSet: DataRoomDocument[] = [];
      let foldersToSet: { id: string; name: string }[] = [];

      if (isOwner) {
        const [ownerDocs, ownerFolders] = await Promise.all([
          dataRoomService.getDocuments(data.id, { signUrls: true }),
          dataRoomFolderService.listFolders(data.id),
        ]);
        docsToSet = ownerDocs;
        foldersToSet = ownerFolders.map((folder) => ({
          id: folder.id,
          name: folder.name,
        }));
        setIsUnlocked(true);
      } else if (!data.require_email && !data.require_password) {
        // Free public
        try {
          const payloadDocs = await dataRoomService.getDataRoomPayload(
            handle!,
            data.slug,
          );
          docsToSet = payloadDocs.map((deckObj: unknown, index: number) => {
            const deck = deckObj as Deck & {
              folder_id?: string | null;
              folder_name?: string | null;
            };
            return {
              id: deck.id,
              data_room_id: data.id,
              deck_id: deck.id,
              folder_id: deck.folder_id ?? null,
              folder_name: deck.folder_name ?? null,
              display_order: index,
              added_at: new Date().toISOString(),
              deck,
            } as DataRoomDocument;
          });
          foldersToSet = Array.from(
            new Map(
              docsToSet
                .filter((doc) => doc.folder_id)
                .map((doc) => [
                  doc.folder_id as string,
                  {
                    id: doc.folder_id as string,
                    name: doc.folder_name || "Folder",
                  },
                ]),
            ).values(),
          );
          setIsUnlocked(true);
        } catch {
          throw new Error("Failed to load documents payload.");
        }
      }

      setDocuments(docsToSet);
      setFolderGroups(foldersToSet);
       const initialDeck = docsToSet.find((doc) => !doc.folder_id)?.deck || docsToSet[0]?.deck || null;
       setSelectedDeck(initialDeck);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load data room.",
      );
      console.error("Error loading data room:", err);
    } finally {
      setLoading(false);
    }
  }, [slug, handle]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!session || !room) return;

    const pendingSaveId = localStorage.getItem("pending_save_data_room_id");
      if (pendingSaveId === room.id) {
        localStorage.removeItem("pending_save_data_room_id");
        if (!isSaved) {
          void saveToLibraryMutation
          .mutateAsync({
            dataRoomId: room.id,
            save: true,
            roomSnapshot: room,
            ownerHandle: handle,
          })
          .then(() => {
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 3000);
          })
          .catch((err: unknown) => {
            console.error("[DataRoomViewer] pending save failed", err);
            toast.error(
              err instanceof Error
                ? err.message
                : "Failed to save room. Please try again.",
            );
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
  }, [session, room?.id, isSaved, saveToLibraryMutation, pendingAction, room, handle]);

  // Track view when a document is selected
  useEffect(() => {
    if (isUnlocked && selectedDeck && room) {
      analyticsService.trackDeckView(
        selectedDeck,
        {
          ...(viewerEmail ? { email_captured: viewerEmail } : {}),
          data_room_id: room.id,
          data_room_slug: room.slug,
          data_room_name: room.name,
        },
      );
    }
    // Only fire on deck ID change, isUnlocked state, or data room ID changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeck?.id, isUnlocked, room?.id]);

  // Build a fake Deck object for AccessGate compatibility
  const roomAsDeck = room
    ? ({
        id: room.id,
        title: room.name,
        slug: room.slug,
        require_email: room.require_email,
        require_password: room.require_password,
        view_password: room.view_password,
      } as Deck)
    : null;

  const handleSave = useCallback(async () => {
    if (!room) return;

    if (!session) {
      localStorage.setItem("pending_save_data_room_id", room.id);
      setPendingAction("save");
      setShowAuthModal(true);
      return;
    }

    const nextSaveState = !isSaved;

    try {
      await saveToLibraryMutation.mutateAsync({
        dataRoomId: room.id,
        save: nextSaveState,
        roomSnapshot: room,
        ownerHandle: handle,
      });

      if (nextSaveState) {
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to save room. Please try again.",
      );
    }
  }, [room, session, isSaved, saveToLibraryMutation, handle]);

  const handleNotes = useCallback(() => {
    if (!room) return;

    if (!session) {
      localStorage.setItem("pending_data_room_action", "notes");
      setPendingAction("notes");
      setShowAuthModal(true);
      return;
    }

    setIsNotesOpen(true);
  }, [room, session]);

  const sidebarSections = useMemo(
    () => buildDataRoomSidebarSections(documents, folderGroups),
    [documents, folderGroups],
  );

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
              Loading Room...
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
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6",
                error === "LINK_EXPIRED" ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"
              )}>
                <AlertCircle size={32} />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">
                {error === "LINK_EXPIRED" ? "Link Expired" : "Access Restricted"}
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                {error === "LINK_EXPIRED" 
                  ? `The secure link for "${room?.name || 'this room'}" has reached its expiration date.` 
                  : (error || "The document you're looking for might have been moved or the link has expired.")
                }
              </p>
              {error === "LINK_EXPIRED" ? (
                <div className="space-y-3">
                  <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-md text-xs text-amber-500/80 italic">
                    Contact the room administrator to request a new access link.
                  </div>
                  <Link 
                    to="/"
                    className="w-full px-6 py-3 bg-surface-lowest text-white font-semibold rounded-md flex items-center justify-center gap-2 hover:bg-surface-low transition-colors border border-white/5"
                  >
                    <ArrowLeft size={18} />
                    Exit Room
                  </Link>
                </div>
              ) : (
                <Link 
                  to="/"
                  className="w-full px-6 py-3 bg-white text-black font-semibold rounded-md flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                >
                  <ArrowLeft size={18} />
                  Return to Dashboard
                </Link>
              )}
            </div>
          </motion.div>
        ) : !isUnlocked && roomAsDeck && room ? (
          <AccessGate
            deck={roomAsDeck}
            onAccessGranted={async (email, password) => {
          try {
                const payloadDocs = await dataRoomService.getDataRoomPayload(
                  handle!,
                  room.slug,
                  password,
                );
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const docsToSet = payloadDocs.map((deckObj: any, index: number) => {
                const deck = deckObj as Deck & {
                  folder_id?: string | null;
                  folder_name?: string | null;
                };
                return {
                  id: deck.id,
                  data_room_id: room.id,
                  deck_id: deck.id,
                  folder_id: deck.folder_id ?? null,
                  folder_name: deck.folder_name ?? null,
                  display_order: index,
                  added_at: new Date().toISOString(),
                  deck,
                } as DataRoomDocument;
                });
                setFolderGroups(Array.from(
                  new Map(
                    docsToSet
                      .filter((doc) => doc.folder_id)
                      .map((doc) => [
                        doc.folder_id as string,
                        {
                          id: doc.folder_id as string,
                          name: doc.folder_name || "Folder",
                        },
                      ]),
                  ).values(),
                ));
                
                setDocuments(docsToSet);
                const initialDeck = docsToSet.find((doc) => !doc.folder_id)?.deck || docsToSet[0]?.deck || null;
                setSelectedDeck(initialDeck);

                setIsUnlocked(true);
                if (email) setViewerEmail(email);
              } catch {
                setError("Failed to unlock data room payload.");
              }
            }}
            onVerifyPassword={(pass) =>
              dataRoomService.checkDataRoomPassword(handle!, room.slug, pass)
            }
          />
        ) : room ? (
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
              totalLabel="Resources"
              sections={sidebarSections}
              selectedDeckId={selectedDeck?.id || null}
              onSelectDeck={(deck) => setSelectedDeck(deck)}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
              isMobile={isMobile}
              emptyMessage="No resources found in this room."
            />

            {/* ── Main Viewer ── */}
            <div className="flex-1 flex flex-col items-stretch relative">
            <div className="absolute top-4 left-4 md:top-6 md:left-6 z-[100] flex flex-wrap items-center gap-2 px-2 md:px-0">
              <Link to="/" className="group">
                <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-[#111] border border-[#333] rounded-md text-slate-400 hover:text-white transition-all">
                  <ArrowLeft size={16} />
                  <span className="text-xs font-semibold">
                    {isMobile ? "Exit" : "Exit Room"}
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
                  Array.isArray(selectedDeck.pages) &&
                  selectedDeck.pages.length > 0 ? (
                    <ImageDeckViewer
                      deck={selectedDeck}
                      viewerEmail={viewerEmail}
                      dataRoomId={room.id}
                    />
                  ) : (
                    <DeckViewer deck={selectedDeck} dataRoomId={room.id} />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <FileText size={48} className="mb-4 opacity-30" />
                    <p className="text-sm font-medium">
                      Select a document to view
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
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

export default DataRoomViewer;
