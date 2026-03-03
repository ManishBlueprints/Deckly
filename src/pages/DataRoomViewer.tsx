import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, AlertCircle, FileText, ChevronRight } from "lucide-react";
import ImageDeckViewer from "../components/ImageDeckViewer";
import DeckViewer from "../components/DeckViewer";
import AccessGate from "../components/AccessGate";
import { dataRoomService } from "../services/dataRoomService";
import { analyticsService } from "../services/analyticsService";
import { supabase } from "../services/supabase";
import { DataRoom, DataRoomDocument, Deck } from "../types";

function DataRoomViewer() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const [room, setRoom] = useState<DataRoom | null>(null);
  const [documents, setDocuments] = useState<DataRoomDocument[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [viewerEmail, setViewerEmail] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadRoom = useCallback(async () => {
    if (!slug || !username) return;
    try {
      setLoading(true);
      const data = await dataRoomService.getDataRoomByHandleAndSlug(
        username,
        slug,
      );
      if (!data) {
        setError("Data room not found");
        return;
      }

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError("This data room link has expired.");
        return;
      }

      setRoom(data);

      const docs = await dataRoomService.getDocuments(data.id);
      setDocuments(docs);

      // Auto-select first document
      if (docs.length > 0 && docs[0].deck) {
        setSelectedDeck(docs[0].deck);
      }

      // Check if current user is the owner
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const isOwner = session?.user?.id === data.user_id;

      // Skip access gate if no protection or user is owner
      if ((!data.require_email && !data.require_password) || isOwner) {
        setIsUnlocked(true);
      }
    } catch (err: any) {
      setError(err.message);
      console.error("Error loading data room:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  // Track view when a document is selected
  useEffect(() => {
    if (isUnlocked && selectedDeck) {
      analyticsService.trackDeckView(
        selectedDeck,
        viewerEmail ? { email_captured: viewerEmail } : undefined,
      );
    }
  }, [selectedDeck?.id, isUnlocked]);

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

  return (
    <div className="fixed inset-0 bg-[#090b10] flex flex-col items-stretch overflow-hidden">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-[#090b10]"
          >
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-white/5" />
              <div className="absolute inset-0 w-24 h-24 rounded-full border-t-4 border-deckly-primary animate-spin shadow-[0_0_20px_rgba(34,197,94,0.3)]" />
              <div className="absolute inset-4 rounded-full bg-deckly-primary/10 blur-[15px] animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-deckly-primary mb-2">
                SYNCHRONIZING SECURE BUNDLE
              </p>
              <h2 className="text-xl font-black text-white uppercase tracking-wider animate-pulse">
                Accessing Vault
              </h2>
            </div>
          </motion.div>
        ) : error || !room ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-[#090b10]"
          >
            <div className="max-w-md w-full glass-shiny border border-white/5 rounded-[3rem] p-12 text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-[80px] -mr-32 -mt-32" />
              <div className="w-24 h-24 bg-red-500/10 rounded-[2rem] flex items-center justify-center text-red-500 mx-auto mb-10 border border-red-500/20 shadow-2xl shadow-red-500/10">
                <AlertCircle size={48} />
              </div>
              <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-4">
                ACCESS SYSTEM ALERT
              </p>
              <h2 className="text-3xl font-black text-white tracking-tight uppercase tracking-wider mb-6">
                Entry Terminated
              </h2>
              <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest leading-relaxed mb-12 opacity-80">
                {error ||
                  "The data room you're looking for might have been moved or the link has expired."}
              </p>
              <Link to="/">
                <button className="w-full py-5 bg-white text-slate-950 font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-slate-200 transition-all active:scale-95 shadow-2xl">
                  RETURN TO BASE
                </button>
              </Link>
            </div>
          </motion.div>
        ) : !isUnlocked && roomAsDeck ? (
          <AccessGate
            deck={roomAsDeck}
            onAccessGranted={(email) => {
              setIsUnlocked(true);
              if (email) setViewerEmail(email);
            }}
            onVerifyPassword={(pass) =>
              dataRoomService.checkDataRoomPassword(room.slug, pass)
            }
          />
        ) : (
          <motion.div
            key="viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-stretch relative"
          >
            {/* ── Document Sidebar ── */}
            <div
              className={`${
                sidebarOpen ? "w-80" : "w-0"
              } bg-[#0e1117] border-r border-white/5 flex flex-col transition-all duration-500 overflow-hidden shrink-0 relative z-20 shadow-2xl`}
            >
              {/* Room Header */}
              <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-deckly-primary/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                    {room.icon_url ? (
                      <img
                        src={room.icon_url}
                        alt={room.name}
                        className="w-12 h-12 rounded-2xl object-cover border border-white/10 relative z-10"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 relative z-10 hover:border-deckly-primary/30 transition-colors">
                        <FileText size={20} className="text-deckly-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[11px] font-black text-white uppercase tracking-wider truncate">
                      {room.name}
                    </h2>
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest font-black mt-1">
                      {documents.length}{" "}
                      {documents.length === 1 ? "RESOURCE" : "RESOURCES"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Document List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {documents.map((doc) => {
                  const deck = doc.deck;
                  const isActive = selectedDeck?.id === deck?.id;

                  return (
                    <button
                      key={doc.deck_id}
                      onClick={() => deck && setSelectedDeck(deck)}
                      className={`w-full flex items-center gap-4 px-4 py-4 rounded-[1.25rem] border transition-all duration-300 group ${
                        isActive
                          ? "bg-deckly-primary/10 border-deckly-primary/30 shadow-[0_0_20px_rgba(34,197,94,0.05)]"
                          : "hover:bg-white/5 border-transparent hover:border-white/5"
                      }`}
                    >
                      {/* Thumbnail */}
                      <div
                        className={`w-12 h-10 rounded-xl bg-black/40 border overflow-hidden shrink-0 transition-all duration-500 ${isActive ? "border-deckly-primary/30 scale-105 shadow-lg shadow-deckly-primary/10" : "border-white/5 grayscale group-hover:grayscale-0"}`}
                      >
                        {deck?.pages?.[0]?.image_url ? (
                          <img
                            src={deck.pages[0].image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText size={16} className="text-slate-800" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[11px] font-black uppercase tracking-wider truncate transition-colors ${
                            isActive
                              ? "text-deckly-primary"
                              : "text-white group-hover:text-deckly-primary"
                          }`}
                        >
                          {deck?.title || "Untitled RESOURCE"}
                        </p>
                        <p
                          className={`text-[9px] font-black uppercase tracking-widest mt-0.5 transition-colors ${isActive ? "text-deckly-primary/60" : "text-slate-700"}`}
                        >
                          {deck?.pages?.length || 0} SLIDES
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/5">
                <p className="text-[9px] text-slate-600 text-center uppercase tracking-[0.15em] font-bold">
                  Powered by Deckly
                </p>
              </div>
            </div>

            {/* Toggle Sidebar Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="absolute top-1/2 -translate-y-1/2 z-30 w-8 h-12 flex items-center justify-center bg-[#0e1117] border-y border-r border-white/5 rounded-r-xl text-slate-700 hover:text-deckly-primary hover:bg-white/5 transition-all shadow-2xl"
              style={{ left: sidebarOpen ? "20rem" : "0" }}
            >
              <ChevronRight
                size={18}
                className={`transition-transform duration-500 ${sidebarOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* ── Main Viewer ── */}
            <div className="flex-1 flex flex-col items-stretch relative">
              {/* Back to room */}
              <Link to="/" className="absolute top-8 right-8 z-[100] group">
                <div className="flex items-center gap-4 px-8 py-4 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[1.25rem] text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all group-hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] active:scale-95">
                  <ArrowLeft
                    size={18}
                    className="group-hover:-translate-x-1 transition-transform"
                  />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Exit Room
                  </span>
                </div>
              </Link>

              <div className="flex-1 w-full h-full relative">
                {selectedDeck ? (
                  Array.isArray(selectedDeck.pages) &&
                  selectedDeck.pages.length > 0 ? (
                    <ImageDeckViewer
                      deck={selectedDeck}
                      viewerEmail={viewerEmail}
                    />
                  ) : (
                    <DeckViewer deck={selectedDeck} />
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
        )}
      </AnimatePresence>
    </div>
  );
}

export default DataRoomViewer;
