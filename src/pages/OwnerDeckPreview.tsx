import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowLeft } from "lucide-react";
import ImageDeckViewer from "../components/viewer/ImageDeckViewer";
import DeckViewer from "../components/viewer/DeckViewer";
import { deckService } from "../services/deckService";
import { Deck } from "../types";

function OwnerDeckPreview() {
  const { deckId } = useParams<{ deckId: string }>();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDeck() {
      if (!deckId) return;

      try {
        setLoading(true);
        const data = await deckService.getDeckById(deckId);
        setDeck(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load preview.");
      } finally {
        setLoading(false);
      }
    }

    loadDeck();
  }, [deckId]);

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
              Loading Private Preview...
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
            </div>

            <div className="flex-1 w-full relative min-h-0">
              {deck.display_mode === "interactive" ||
              (Array.isArray(deck.pages) && deck.pages.length > 0) ? (
                deck.status === "PENDING" || deck.status === "CONVERTING" ? (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-[#0d0d0d]">
                    <div className="w-12 h-12 border-2 border-deckly-primary/20 border-t-deckly-primary rounded-full animate-spin mb-6" />
                    <h2 className="text-xl font-bold text-white mb-2">
                      {deck.status === "CONVERTING" ? "Converting Content" : "Preparing Deck"}
                    </h2>
                    <p className="text-slate-400 text-sm max-w-sm">
                      {deck.status === "CONVERTING"
                        ? "The server is converting this document into an interactive experience."
                        : "This deck is still being prepared for preview."}
                    </p>
                  </div>
                ) : (
                  <ImageDeckViewer deck={deck} isOwner />
                )
              ) : (
                <DeckViewer deck={deck} isOwner />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OwnerDeckPreview;
