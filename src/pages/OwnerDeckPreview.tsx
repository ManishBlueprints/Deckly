import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Check,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import ImageDeckViewer from "../components/viewer/ImageDeckViewer";
import DeckViewer from "../components/viewer/DeckViewer";
import { AuthModal } from "../components/auth/AuthModal";
import { NotesSidebar } from "../components/viewer/NotesSidebar";
import { AiSummarySidebar } from "../components/viewer/AiSummarySidebar";
import { TierUpsellModal } from "../components/dashboard/TierUpsellModal";
import { deckService } from "../services/deckService";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useAiSummaryPanel } from "../hooks/useAiSummaryPanel";
import { Deck } from "../types";
import type { Tier } from "../constants/tiers";
import {
  useIsDeckSaved,
  useSaveToLibraryMutation,
} from "../hooks/useViewerQueries";

function OwnerDeckPreview() {
  const { deckId } = useParams<{ deckId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, profile } = useAuth();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [viewerEmail, setViewerEmail] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    if (session?.user?.email) {
      setViewerEmail(session.user.email);
    } else {
      setViewerEmail(undefined);
    }
  }, [session]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDeck() {
      if (!deckId) {
        setDeck(null);
        setError(null);
        setLoading(false);
        return;
      }

      setError(null);
      setDeck(null);
      setLoading(true);

      try {
        const data = await deckService.getDeckById(deckId);
        if (controller.signal.aborted) return;
        setDeck(data);

        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        const userIsOwner = currentSession?.user?.id === data.user_id;
        setIsOwner(userIsOwner);

        if (userIsOwner) {
          const fullDeck = await deckService.getDeckById(data.id);
          if (controller.signal.aborted) return;
          setDeck(fullDeck);
        } else if (!data.require_email && !data.require_password) {
          try {
            const payload = await deckService.getDeckPayload(data.slug);
            const resolvedPayload = payload.signed_url
              ? { ...payload, file_url: payload.signed_url, expires_in: payload.expires_in }
              : payload;
            setDeck({ ...data, ...resolvedPayload });
          } catch {
            throw new Error("Failed to load document content.");
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load preview.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadDeck();
    return () => controller.abort();
  }, [deckId]);

  const { data: isSaved = false } = useIsDeckSaved(deck?.id, session?.user?.id);
  const saveToLibraryMutation = useSaveToLibraryMutation(session?.user?.id);
  const aiSummary = useAiSummaryPanel({
    onRequireAuth: () => {
      setShowAuthModal(true);
    },
    isGuest: false,
    tier: (profile?.tier as Tier) || "FREE",
  });

  useEffect(() => {
    if (session && deck) {
      const pendingDeckId = localStorage.getItem("pending_save_deck_id");
      if (pendingDeckId === deck.id) {
        localStorage.removeItem("pending_save_deck_id");
        if (!isSaved) {
          saveToLibraryMutation.mutate({ deckId: deck.id, save: true });
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 3000);
        }
      }

      if (isSaved) {
        deckService.updateLibraryLastViewed(deck.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, deck?.id, isSaved]);

  const handleSummarize = useCallback(async () => {
    if (!deck) return;

    try {
      const result = await aiSummary.requestSummary({
        scope_type: "deck",
        scope_id: deck.id,
        scope_label: deck.title,
      });

      if (result.status === "quota_limited" && result.usage.quota?.nextAction === "upgrade") {
        setShowUpgradeModal(true);
      }
    } catch (error) {
      const status = (error as { status?: number } | undefined)?.status;
      if (status === 401 || status === 403) {
        setShowAuthModal(true);
        return;
      }

      console.error("Failed to load AI summary", error);
      toast.error("Failed to load the AI summary. Please try again.");
    }
  }, [aiSummary, deck]);

  useEffect(() => {
    if (!deck) return;
    if (searchParams.get("ai") !== "summary") return;

    void handleSummarize();
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("ai");
      return next;
    }, { replace: true });
  }, [deck, handleSummarize, searchParams, setSearchParams]);

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
                Preview Unavailable
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                {error || "This preview could not be loaded."}
              </p>
              <Link to="/content">
                <button className="w-full px-6 py-3 bg-white text-black font-semibold rounded-md flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
                  <ArrowLeft size={18} />
                  Return to Content
                </button>
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-stretch relative"
          >
            <div className="absolute top-4 left-4 md:top-6 md:left-6 z-[100] flex flex-wrap items-center gap-2 px-2 md:px-0">
              <Link to="/content" className="group">
                <div className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-[#111] border border-[#333] rounded-md text-slate-400 hover:text-white transition-all">
                  <ArrowLeft size={16} />
                  <span className="text-xs font-semibold">Back to Content</span>
                </div>
              </Link>

              <button
                onClick={handleSave}
                disabled={saveToLibraryMutation.isPending}
                className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 border transition-all active:scale-95 rounded-md ${
                  isSaved
                    ? "bg-deckly-primary/10 border-deckly-primary/30 text-deckly-primary"
                    : "bg-[#111] border-[#333] text-slate-400 hover:text-white"
                }`}
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

              <button
                onClick={() => void handleSummarize()}
                className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-[#111] border border-deckly-primary/20 text-deckly-primary hover:text-white hover:border-deckly-primary/40 transition-all rounded-md active:scale-95"
              >
                <Sparkles size={16} />
                <span className="text-xs font-semibold">Summarize</span>
              </button>
            </div>

            <div className="flex-1 w-full relative min-h-0">
              {deck.display_mode === "interactive" || (Array.isArray(deck.pages) && deck.pages.length > 0) ? (
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
                  <ImageDeckViewer deck={deck} viewerEmail={viewerEmail} isOwner={isOwner} />
                )
              ) : (
                <DeckViewer deck={deck} isOwner={isOwner} viewerEmail={viewerEmail} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} redirectTo={window.location.href} />

      <AiSummarySidebar
        isOpen={aiSummary.state.isOpen}
        onClose={aiSummary.close}
        onRequireAuth={() => setShowAuthModal(true)}
        title="AI Summary"
        privacyLabel={isOwner ? "Owner view" : "Investor view"}
        description="Quick overview plus follow-up chat for this deck."
        summary={aiSummary.state.summary}
        isSummaryLoading={aiSummary.state.isSummaryLoading}
        summaryEmptyMessage="Summary will appear here when available."
        summaryMeta={aiSummary.state.summaryMeta}
        summaryNotice={aiSummary.state.summaryNotice}
        summaryNoticeTone={aiSummary.state.summaryNoticeTone}
        chatMessages={aiSummary.state.chatMessages}
        chatInputValue={aiSummary.state.chatInputValue}
        onChatInputChange={aiSummary.setChatInputValue}
        onChatSubmit={aiSummary.submitChat}
        isChatLoading={aiSummary.state.isChatLoading}
        isChatLocked={aiSummary.state.isChatLocked}
      />

      <TierUpsellModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName="AI summaries"
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

export default OwnerDeckPreview;
