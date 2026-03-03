import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, FileText } from "lucide-react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { Button } from "../components/ui/button";
import { DeckSettingsForm } from "../components/dashboard/DeckSettingsForm";
import { deckService } from "../services/deckService";
import { Deck } from "../types";
import { useAuth } from "../contexts/AuthContext";

export default function EditDeck() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (deckId && session?.user?.id) {
      setLoading(true);
      deckService
        .getDeckById(deckId)
        .then((data) => setDeck(data))
        .catch((err) => console.error("Failed to load deck:", err))
        .finally(() => setLoading(false));
    }
  }, [deckId, session]);

  if (loading) {
    return (
      <DashboardLayout title="Edit Asset">
        <div className="flex-1 flex flex-col items-center justify-center py-40 gap-4 text-slate-400">
          <div className="w-10 h-10 border-2 border-deckly-primary/20 border-t-deckly-primary rounded-full animate-spin" />
          <p className="font-medium font-bold uppercase tracking-widest text-[10px]">
            Loading Asset Details...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (!deck) {
    return (
      <DashboardLayout title="Edit Asset">
        <div className="flex-1 flex flex-col items-center justify-center py-40 gap-4 text-slate-400">
          <p className="font-medium font-bold uppercase tracking-widest text-xs">
            Asset not found.
          </p>
          <Button onClick={() => navigate("/")} variant="ghost">
            Return to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`${deck?.title || "Edit Asset"}`}>
      <div className="flex-1 -m-8 relative">
        {/* ═══════════════ HERO SECTION ═══════════════ */}
        <div className="relative pt-24 pb-32 px-6 overflow-hidden">
          {/* Animated Background Accents */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-deckly-primary/10 rounded-full blur-[120px] animate-pulse" />
            <div
              className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] animate-pulse"
              style={{ animationDelay: "2s" }}
            />
          </div>

          <div className="max-w-5xl mx-auto relative z-10">
            {/* Back Button */}
            <button
              onClick={() => navigate("/content")}
              className="flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-12 group transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-deckly-primary/10 group-hover:border-deckly-primary/20 transition-all">
                <ChevronLeft
                  size={14}
                  className="group-hover:-translate-x-0.5 transition-transform"
                />
              </div>
              Return to Content
            </button>

            <div className="flex flex-col items-center text-center">
              {/* Asset Preview Thumbnail */}
              <div className="w-32 h-24 md:w-40 md:h-28 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mb-8 shadow-2xl backdrop-blur-md relative group">
                <div className="absolute inset-0 bg-deckly-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                {deck?.pages?.[0]?.image_url ? (
                  <img
                    src={deck.pages[0].image_url}
                    alt={deck.title}
                    className="w-full h-full object-cover relative z-10 transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-500 group-hover:text-deckly-primary transition-colors duration-500 relative z-10">
                    <FileText size={32} />
                  </div>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4 uppercase tracking-[0.05em]">
                Edit {deck?.title}
              </h1>

              <p className="text-slate-500 text-[11px] font-bold uppercase tracking-[0.15em] max-w-md mb-8 leading-relaxed">
                Refine visibility, security, and asset details.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="glass-shiny bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-[3rem] p-6 md:p-16 shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <DeckSettingsForm
                deck={deck}
                onUpdate={setDeck}
                onDelete={async (id) => {
                  await deckService.deleteDeck(id, deck.file_url, deck.slug);
                  navigate("/");
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
