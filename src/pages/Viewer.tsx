import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Check,
  MessageSquareText,
} from "lucide-react";
import ImageDeckViewer from "../components/viewer/ImageDeckViewer";
import DeckViewer from "../components/viewer/DeckViewer";
import AccessGate from "../components/viewer/AccessGate";
import { AuthModal } from "../components/auth/AuthModal";
import { NotesSidebar } from "../components/viewer/NotesSidebar";
import { deckService } from "../services/deckService";
import { analyticsService } from "../services/analyticsService";
import { useAuth } from "../contexts/AuthContext";
import { Deck } from "../types";
import {
  useIsDeckSaved,
  useSaveToLibraryMutation,
} from "../hooks/useViewerQueries";
import {
  loadViewerDeck,
  refreshViewerSignedUrl,
  SignedUrlMeta,
  unlockViewerDeck,
} from "./viewerPublicAccess";

function Viewer() {
  const { handle, slug } = useParams<{ handle: string; slug: string }>();
  const { session } = useAuth();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [viewerEmail, setViewerEmail] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  // UI States
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  // Tracks metadata needed to refresh the signed URL before it expires.
  // Stored in a ref so the refresh effect doesn't re-run on every render.
  const signedUrlMeta = useRef<SignedUrlMeta | null>(null);

  // Automatically refresh the signed URL ~60 s before it expires.
  useEffect(() => {
    if (!isUnlocked || !signedUrlMeta.current) return;
    const meta = signedUrlMeta.current;
    // Schedule refresh 60 s before expiry (minimum 5 s to avoid thrashing).
    const refreshMs = Math.max((meta.expiresIn - 60) * 1000, 5000);
    const timerId = setTimeout(async () => {
      try {
        const refreshed = await refreshViewerSignedUrl({ meta });
        if (refreshed.signedUrlMeta) {
          signedUrlMeta.current = refreshed.signedUrlMeta;
        }
        const nextFileUrl = refreshed.fileUrl;
        if (nextFileUrl) {
          setDeck((prev) =>
            prev ? { ...prev, file_url: nextFileUrl } : prev
          );
        }
      } catch {
        setError("The document is no longer available.");
        setIsUnlocked(false);
      }
    }, refreshMs);
    return () => clearTimeout(timerId);
  }, [isUnlocked, deck?.file_url]); // re-schedule whenever file_url is replaced by a refresh

  // TanStack Queries
  const { data: isSaved = false } = useIsDeckSaved(deck?.id, session?.user?.id);
  const saveToLibraryMutation = useSaveToLibraryMutation(session?.user?.id);

  // Initialize viewerEmail from session if available
  useEffect(() => {
    if (session?.user?.email) {
      setViewerEmail(session.user.email);
    } else {
      setViewerEmail(undefined);
    }
  }, [session]);

  const loadDeck = useCallback(async (silent = false) => {
    if (!slug || !handle) return;
    try {
      if (!silent) setLoading(true);
      setError(null);
      const result = await loadViewerDeck({ handle, slug });

      setDeck(result.deck);
      setIsOwner(result.isOwner);
      setIsUnlocked(result.isUnlocked);
      signedUrlMeta.current = result.signedUrlMeta ?? null;

      if (result.isUnlocked && result.analyticsDeck) {
        analyticsService.trackDeckView(result.analyticsDeck);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load deck.");
      console.error("Error loading deck:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [slug, handle]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  // Polling for processing presentation
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (deck?.status === "PENDING" || deck?.status === "CONVERTING") {
      timeoutId = setTimeout(() => {
        loadDeck(true);
      }, 5000);
    }
    return () => clearTimeout(timeoutId);
  }, [deck?.status, loadDeck]);

  // Handle pending save from guest flow and auto-update last viewed
  useEffect(() => {
    if (session && deck) {
      // 1. Handle pending save from guest flow
      const pendingDeckId = localStorage.getItem("pending_save_deck_id");
      if (pendingDeckId === deck.id) {
        localStorage.removeItem("pending_save_deck_id");
        if (!isSaved) {
          saveToLibraryMutation.mutate({ deckId: deck.id, save: true });
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 3000);
        }
      }

      // 2. Mark as viewed if it's already in the library
      if (isSaved) {
        deckService.updateLibraryLastViewed(deck.id);
      }
    }
  // deck.id, isSaved, and session are the actual triggers here; adding saveToLibraryMutation
  // or full deck object would cause infinite re-renders due to object reference instability
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, deck?.id, isSaved]);

  const handleSave = async () => {
    if (!deck) return;

    if (!session) {
      localStorage.setItem("pending_save_deck_id", deck.id);
      setShowAuthModal(true);
      return;
    }

    const nextSaveState = !isSaved;

    if (nextSaveState) {
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    }

    saveToLibraryMutation.mutate({ deckId: deck.id, save: nextSaveState });
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
              Loading Presentation...
            </p>
          </motion.div>
        ) : error || !deck ? (
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
                Access Restricted
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                The document you're looking for might have been moved or the
                link has expired.
              </p>
              <Link to="/">
                <button className="w-full px-6 py-3 bg-white text-black font-semibold rounded-md flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
                  <ArrowLeft size={18} />
                  Return to Dashboard
                </button>
              </Link>
            </div>
          </motion.div>
        ) : !isUnlocked ? (
          <AccessGate
            deck={deck}
            sessionEmail={viewerEmail}
            onVerifyPassword={(password) =>
              deckService.checkDeckPassword(handle ?? null, slug ?? deck.slug, password)
            }
            onAccessGranted={async (email, password) => {
              try {
                setError(null);
                const { resolvedDeck, signedUrlMeta: nextSignedUrlMeta } = await unlockViewerDeck({
                  handle: handle ?? null,
                  password,
                  slug: slug ?? deck.slug,
                });
                signedUrlMeta.current = nextSignedUrlMeta ?? null;
                setDeck((prev) => prev ? { ...prev, ...resolvedDeck } : prev);
                setIsUnlocked(true);
                if (email) {
                  setViewerEmail(email);
                  analyticsService.trackDeckView(deck, { email_captured: email });
                } else {
                  analyticsService.trackDeckView(deck);
                }
              } catch {
                setError("Failed to unlock document payload.");
              }
            }}
          />
        ) : (
          <motion.div
            key="viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-stretch relative"
          >
            <div className="absolute top-4 left-4 md:top-6 md:left-6 z-[100] flex flex-wrap items-center gap-2 px-2 md:px-0">
              <Link to="/" className="group">
                <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-[#111] border border-[#333] rounded-md text-slate-400 hover:text-white transition-all">
                  <ArrowLeft size={16} />
                  <span className="text-xs font-semibold">Leave</span>
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
                onClick={() => setIsNotesOpen(true)}
                className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-[#111] border border-[#333] text-slate-400 hover:text-white transition-all rounded-md active:scale-95"
              >
                <MessageSquareText size={16} />
                <span className="text-xs font-semibold">Notes</span>
              </button>
            </div>

            <div className="flex-1 w-full relative min-h-0">
              {deck.display_mode === "interactive" ||
              (Array.isArray(deck.pages) && deck.pages.length > 0) ? (
                (deck.status === "PENDING" || deck.status === "CONVERTING") ? (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-[#0d0d0d]">
                    <div className="w-12 h-12 border-2 border-deckly-primary/20 border-t-deckly-primary rounded-full animate-spin mb-6" />
                    <h2 className="text-xl font-bold text-white mb-2">
                      {deck.status === "CONVERTING" ? "Converting Content" : "Preparing Deck"}
                    </h2>
                    <p className="text-slate-400 text-sm max-w-sm">
                      {deck.status === "CONVERTING" 
                      ? "The server is currently converting your document into an interactive experience. This usually takes less than a minute." 
                      : "We're setting up the interactive experience for this pitch deck. Please wait a moment while we prepare the slides."}
                    </p>
                  </div>
                ) : (
                  <ImageDeckViewer
                    deck={deck}
                    viewerEmail={viewerEmail}
                    isOwner={isOwner}
                  />
                )
              ) : (
                <DeckViewer
                  deck={deck}
                  isOwner={isOwner}
                  viewerEmail={viewerEmail}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        redirectTo={window.location.href}
      />

      {deck && (
        <NotesSidebar
          isOpen={isNotesOpen}
          onClose={() => setIsNotesOpen(false)}
          deckId={deck.id}
          onRequireAuth={() => {
            setIsNotesOpen(false);
            setShowAuthModal(true);
          }}
        />
      )}

      {/* Success Toast */}
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

export default Viewer;
