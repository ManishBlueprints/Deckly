import { useState, useEffect, useCallback } from "react";
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
import ImageDeckViewer from "../components/ImageDeckViewer";
import DeckViewer from "../components/DeckViewer";
import AccessGate from "../components/AccessGate";
import { AuthModal } from "../components/AuthModal";
import { NotesSidebar } from "../components/viewer/NotesSidebar";
import { deckService } from "../services/deckService";
import { analyticsService } from "../services/analyticsService";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Deck } from "../types";
import Button from "../components/common/Button";

function Viewer() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const { session } = useAuth();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [viewerEmail, setViewerEmail] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  const loadDeck = useCallback(async () => {
    if (!slug || !username) return;
    try {
      setLoading(true);
      const data = await deckService.getDeckByHandleAndSlug(username, slug);
      setDeck(data);

      // Check if current user is the owner
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userIsOwner = session?.user?.id === data.user_id;
      setIsOwner(userIsOwner);

      // If no protection OR user is the owner, track view immediately and unlock
      if ((!data.require_email && !data.require_password) || userIsOwner) {
        setIsUnlocked(true);
        if (!userIsOwner) {
          analyticsService.trackDeckView(data);
        }
      }
    } catch (err: any) {
      setError(err.message);
      console.error("Error loading deck:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  // NEW: Check if deck is saved and handle pending save
  useEffect(() => {
    const checkSaved = async () => {
      if (session && deck) {
        // 1. Check if already saved
        const saved = await deckService.isDeckSaved(deck.id);
        setIsSaved(saved);

        // 2. Handle pending save from guest flow
        const pendingDeckId = localStorage.getItem("pending_save_deck_id");
        if (pendingDeckId === deck.id) {
          localStorage.removeItem("pending_save_deck_id");
          if (!saved) {
            handleSave();
          }
        }

        // 3. Mark as viewed if it's already in the library
        if (saved) {
          deckService.updateLibraryLastViewed(deck.id);
        }
      }
    };
    checkSaved();
  }, [session, deck?.id]);

  const handleSave = async () => {
    if (!deck) return;

    if (!session) {
      localStorage.setItem("pending_save_deck_id", deck.id);
      setShowAuthModal(true);
      return;
    }

    // Optimistic Update
    const previousSaved = isSaved;
    setIsSaved(!previousSaved);

    if (!previousSaved) {
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    }

    try {
      setIsSaving(true);
      if (previousSaved) {
        await deckService.removeFromLibrary(deck.id);
      } else {
        await deckService.saveToLibrary(deck.id);
      }
    } catch (err) {
      console.error("Save to library failed:", err);
      // Rollback on error
      setIsSaved(previousSaved);
      setShowSuccessToast(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#090b10] flex flex-col items-stretch overflow-hidden">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-white/5" />
              <div className="absolute inset-0 w-20 h-20 rounded-full border-t-4 border-deckly-primary animate-spin" />
            </div>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] animate-pulse">
              Loading Room Contents
            </p>
          </motion.div>
        ) : error || !deck ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-6"
          >
            <div className="max-w-md w-full bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[40px] p-12 text-center shadow-2xl">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto mb-8">
                <AlertCircle size={40} />
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-4">
                Access Restricted
              </h2>
              <p className="text-slate-400 font-medium leading-relaxed mb-10">
                The document you're looking for might have been moved or the
                link has expired.
              </p>
              <Link to="/">
                <Button size="large" fullWidth icon={ArrowLeft}>
                  Return to Dashboard
                </Button>
              </Link>
            </div>
          </motion.div>
        ) : !isUnlocked ? (
          <AccessGate
            deck={deck}
            onAccessGranted={(email) => {
              setIsUnlocked(true);
              if (email) {
                setViewerEmail(email);
                analyticsService.trackDeckView(deck, { email_captured: email });
              } else {
                analyticsService.trackDeckView(deck);
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
            <div className="absolute top-4 left-4 md:top-6 md:left-6 z-[100] flex flex-wrap items-center gap-2 md:gap-3 px-2 md:px-0">
              <Link to="/" className="group">
                <div className="flex items-center gap-2 md:gap-3 px-3 py-2 md:px-6 md:py-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-slate-400 hover:text-white hover:bg-black/60 transition-all group-hover:-translate-x-1">
                  <ArrowLeft size={16} className="md:w-[18px] md:h-[18px]" />
                  <span className="text-[10px] md:text-sm font-bold uppercase tracking-wider">
                    Leave
                  </span>
                </div>
              </Link>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`
                  flex items-center gap-2 md:gap-3 px-3 py-2 md:px-6 md:py-3 backdrop-blur-xl border transition-all active:scale-95 rounded-full
                  ${
                    isSaved
                      ? "bg-deckly-primary/20 border-deckly-primary/30 text-deckly-primary"
                      : "bg-black/40 border-white/10 text-slate-400 hover:text-white hover:bg-black/60"
                  }
                `}
              >
                {isSaved ? (
                  <BookmarkCheck
                    size={16}
                    className="md:w-[18px] md:h-[18px]"
                  />
                ) : (
                  <Bookmark size={16} className="md:w-[18px] md:h-[18px]" />
                )}
                <span className="text-[10px] md:text-sm font-bold uppercase tracking-wider">
                  {isSaving ? "Saving..." : isSaved ? "Saved" : "Save"}
                </span>
              </button>

              <button
                onClick={() => setIsNotesOpen(true)}
                className="flex items-center gap-2 md:gap-3 px-3 py-2 md:px-6 md:py-3 bg-black/40 backdrop-blur-xl border border-white/10 text-slate-400 hover:text-white hover:bg-black/60 transition-all rounded-full active:scale-95"
              >
                <MessageSquareText
                  size={16}
                  className="md:w-[18px] md:h-[18px]"
                />
                <span className="text-[10px] md:text-sm font-bold uppercase tracking-wider">
                  Notes
                </span>
              </button>
            </div>

            <div className="flex-1 w-full relative min-h-0">
              {deck.display_mode === "interactive" ||
              (Array.isArray(deck.pages) && deck.pages.length > 0) ? (
                deck.status === "PENDING" ? (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-[#0d0f14]">
                    <div className="w-16 h-16 border-4 border-deckly-primary/30 border-t-deckly-primary rounded-full animate-spin mb-6" />
                    <h2 className="text-2xl font-black text-white tracking-tight mb-2">
                      Optimizing for Presentation
                    </h2>
                    <p className="text-slate-400 font-medium">
                      We're converting your slides into an interactive
                      experience. This usually takes less than a minute.
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
                <DeckViewer deck={deck} isOwner={isOwner} />
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
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 bg-deckly-primary text-slate-950 rounded-2xl shadow-2xl font-bold"
          >
            <div className="w-6 h-6 bg-slate-950/10 rounded-full flex items-center justify-center">
              <Check size={14} strokeWidth={4} />
            </div>
            Deck saved to your library!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Viewer;
