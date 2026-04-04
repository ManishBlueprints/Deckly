import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, FileText } from "lucide-react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { Button } from "../components/ui/button";
import { DeckSettingsForm } from "../components/dashboard/DeckSettingsForm";
import { deckService } from "../services/deckService";
import { Deck } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

export default function EditDeck() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const queryClient = useQueryClient();
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
      <div className="flex-1 relative space-y-4 max-w-4xl mx-auto w-full md:px-6">
        {/* ═══════════════ HEADER SECTION ═══════════════ */}
        <div className="relative py-4 px-4 md:px-0 border-b border-white/5">
          <div className="flex items-center gap-4 relative z-10">
            {/* Back Button */}
            <button
              onClick={() => navigate("/content")}
              className="flex items-center justify-center w-10 h-10 rounded-md bg-surface-lowest border border-white/10 text-slate-400 hover:text-deckly-primary hover:bg-deckly-primary/5 transition-all shrink-0"
              title="Return to Content"
            >
              <ChevronLeft size={20} />
            </button>

            {/* Asset Preview Thumbnail */}
            <div className="w-16 h-12 rounded-md bg-[#2B2B2B] border border-white/10 flex items-center justify-center overflow-hidden shrink-0 group">
              {deck?.pages?.[0]?.image_url ? (
                <img
                  src={deck.pages[0].image_url}
                  alt={deck.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FileText size={16} className="text-slate-500" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Title */}
              <h1 className="text-lg md:text-xl font-semibold text-white tracking-tight truncate">
                Edit {deck?.title}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Refine visibility, security, and asset details.
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-0 pb-8">
          <div className="bg-surface-card border border-white/5 rounded-lg p-6 relative overflow-hidden shadow-sm">
            <div className="relative z-10">
              <DeckSettingsForm
                deck={deck}
                onUpdate={setDeck}
                onDelete={async (id) => {
                  const { dbDeleted, assetsDeleted } = await deckService.deleteDeck(id, deck.file_url, deck.slug);
                  
                  if (!dbDeleted) {
                    throw new Error("Failed to delete deck from database");
                  }

                  if (!assetsDeleted) {
                    console.warn("Deck removed from UI but storage cleanup failed.");
                  }

                  queryClient.invalidateQueries({ queryKey: ["decks", session?.user?.id] });
                  queryClient.invalidateQueries({
                    queryKey: ["user-total-stats", session?.user?.id],
                  });
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
