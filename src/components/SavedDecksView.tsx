import { useState, useEffect, useCallback } from "react";
import { deckService } from "../services/deckService";
import { noteService } from "../services/noteService";
import { useAuth } from "../contexts/AuthContext";
import { DashboardCard } from "./ui/DashboardCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  BookmarkMinus,
  ExternalLink,
  FileText,
  Check,
  Loader2,
  Lock,
  Plus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../utils/cn";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmModal } from "./common/ConfirmModal";

export function SavedDecksView() {
  const { session } = useAuth();
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unsaveTarget, setUnsaveTarget] = useState<any>(null);
  const [isUnsavingInProgress, setIsUnsavingInProgress] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const fetchSavedDecks = useCallback(async () => {
    if (!session?.user?.id) return;
    setIsRefreshing(true);
    try {
      const savedDecks = await deckService.getSavedDecks();
      setDecks(savedDecks);
    } catch (err) {
      console.error("Failed to fetch saved decks:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchSavedDecks();
  }, [fetchSavedDecks]);

  const handleConfirmUnsave = async () => {
    if (!unsaveTarget) return;

    setIsUnsavingInProgress(true);
    try {
      await deckService.removeFromLibrary(unsaveTarget.id);
      setDecks((prev) => prev.filter((d) => d.id !== unsaveTarget.id));
      setUnsaveTarget(null);
    } catch (err) {
      console.error("Failed to unsave deck:", err);
    } finally {
      setIsUnsavingInProgress(false);
    }
  };

  const handleUnsaveClick = (deck: any) => {
    setUnsaveTarget(deck);
  };

  const startEditing = (deck: any) => {
    setEditingId(deck.id);
    setEditContent(deck.investor_note || "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveNote = async (deckId: string) => {
    setIsSavingNote(true);
    try {
      await noteService.saveNote(deckId, editContent);
      setDecks((prev) =>
        prev.map((d) =>
          d.id === deckId ? { ...d, investor_note: editContent } : d,
        ),
      );
      setEditingId(null);
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <div className="space-y-12 pb-12 animate-in fade-in duration-700 relative">
      <p className="text-slate-500 font-medium -mb-6 md:-mb-4">
        Saved decks from other founders. Always up to date.
      </p>
      {isRefreshing && !loading && (
        <div className="absolute top-0 right-0 py-2 flex items-center gap-2">
          <div className="w-2 h-2 bg-deckly-primary rounded-full animate-ping" />
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
            Syncing...
          </span>
        </div>
      )}

      <DashboardCard className="border-white/5 shadow-2xl glass-shiny overflow-hidden">
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-white/5">
          {loading ? (
            Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="p-6 space-y-4">
                  <div className="h-4 w-48 bg-white/5 animate-pulse rounded-lg" />
                  <div className="h-3 w-32 bg-white/5 animate-pulse rounded-lg" />
                </div>
              ))
          ) : decks.length === 0 ? (
            <div className="p-16 text-center space-y-6">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-slate-700 mx-auto border border-white/5 shadow-xl">
                <FileText size={40} />
              </div>
              <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] max-w-[200px] mx-auto leading-relaxed">
                Your library is currently empty.
              </p>
            </div>
          ) : (
            decks.map((deck) => {
              const updatedDate = new Date(deck.updated_at);
              const lastViewedDate = new Date(deck.last_viewed_at || 0);
              const isNewUpdate =
                updatedDate > lastViewedDate &&
                Date.now() - updatedDate.getTime() < 7 * 24 * 60 * 60 * 1000;

              return (
                <div
                  key={deck.id}
                  className={cn(
                    "p-6 flex flex-col gap-6",
                    unsaveTarget?.id === deck.id && "opacity-50",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/5 rounded-2xl text-slate-400 shrink-0 border border-white/5 shadow-lg">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/${deck.user_handle}/${deck.slug}`}
                          target="_blank"
                          className="font-black text-slate-200 text-sm truncate block hover:text-deckly-primary transition-colors"
                        >
                          {deck.title}
                        </Link>
                        {isNewUpdate && (
                          <span className="px-1.5 py-0.5 bg-deckly-primary text-slate-950 text-[8px] font-black uppercase rounded-md shadow-[0_0_10px_rgba(34,197,94,0.3)] shrink-0">
                            Update
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                        Saved{" "}
                        {new Date(deck.saved_at)
                          .toLocaleDateString("en-GB")
                          .replace(/\//g, "-")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleUnsaveClick(deck)}
                      className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 rounded-xl transition-all shadow-lg disabled:opacity-30"
                      title="Remove from Library"
                    >
                      <BookmarkMinus size={20} />
                    </button>
                  </div>

                  {/* Notes below the name (mobile) */}
                  <div className="group/note relative">
                    <AnimatePresence mode="wait">
                      {editingId === deck.id ? (
                        <motion.div
                          key="editing-mobile"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          className="bg-[#09090b] p-4 rounded-2xl border border-deckly-primary/30 shadow-xl space-y-4"
                        >
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-deckly-primary uppercase tracking-widest">
                            <Lock size={10} />
                            Private Note
                          </div>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-0 text-xs text-white min-h-[120px] resize-none p-0 placeholder:text-slate-600"
                            autoFocus
                            placeholder="Write your private investment thesis..."
                          />
                          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                            <button
                              onClick={cancelEditing}
                              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveNote(deck.id)}
                              disabled={isSavingNote}
                              className="px-6 py-2 bg-deckly-primary text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 disabled:opacity-50 shadow-lg active:scale-95 transition-all"
                            >
                              {isSavingNote ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} strokeWidth={3} />
                              )}
                              SAVE
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="view-mobile"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={() => startEditing(deck)}
                          className={cn(
                            "relative p-4 rounded-2xl border transition-all active:scale-[0.98]",
                            deck.investor_note
                              ? "bg-white/[0.03] border-white/5"
                              : "bg-transparent border-dashed border-white/10",
                          )}
                        >
                          <div className="absolute top-3 right-4 flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-full border border-white/5">
                            <Lock size={8} className="text-slate-500" />
                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest font-mono">
                              Private
                            </span>
                          </div>

                          <div className="flex items-start gap-3">
                            {!deck.investor_note && (
                              <div className="mt-0.5 p-1.5 bg-deckly-primary/10 rounded-lg text-deckly-primary">
                                <Plus size={14} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 pr-12">
                              <p
                                className={cn(
                                  "text-xs leading-relaxed font-medium tracking-tight",
                                  deck.investor_note
                                    ? "text-slate-200"
                                    : "text-slate-500 italic",
                                )}
                              >
                                {deck.investor_note ||
                                  "Add private investment thesis..."}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 py-8 px-12">
                  Name
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 py-8">
                  Personal Notes
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 py-8">
                  Saved On
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 py-8">
                  Last Viewed
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 py-8 text-right px-12">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(3)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i} className="border-white/5">
                      <TableCell className="px-12 py-8">
                        <div className="h-4 w-48 bg-white/5 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="py-8">
                        <div className="h-4 w-32 bg-white/5 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="py-8">
                        <div className="h-4 w-24 bg-white/5 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="py-8">
                        <div className="h-4 w-24 bg-white/5 animate-pulse rounded-lg" />
                      </TableCell>
                      <TableCell className="px-12 py-8 text-right">
                        <div className="h-10 w-10 bg-white/5 animate-pulse rounded-xl ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : decks.length === 0 ? (
                <TableRow className="border-transparent">
                  <TableCell colSpan={5} className="p-32 text-center">
                    <div className="flex flex-col items-center gap-6 text-slate-500">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-slate-700 shadow-2xl border border-white/5">
                        <FileText size={40} />
                      </div>
                      <p className="font-black uppercase tracking-[0.2em] max-w-xs mx-auto text-xs leading-relaxed">
                        Your library is currently empty. Start saving decks to
                        track them here.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                decks.map((deck) => {
                  const updatedDate = new Date(deck.updated_at);
                  const lastViewedDate = new Date(deck.last_viewed_at || 0);
                  const isNewUpdate =
                    updatedDate > lastViewedDate &&
                    Date.now() - updatedDate.getTime() <
                      7 * 24 * 60 * 60 * 1000;

                  return (
                    <TableRow
                      key={deck.id}
                      className={cn(
                        "group hover:bg-white/[0.02] border-white/5 transition-colors",
                        unsaveTarget?.id === deck.id &&
                          "opacity-50 pointer-events-none",
                      )}
                    >
                      <TableCell className="px-12 py-8">
                        <Link
                          to={`/${deck.user_handle}/${deck.slug}`}
                          target="_blank"
                          className="flex items-center gap-4 group/title"
                        >
                          <div className="p-3 bg-white/5 rounded-2xl text-slate-400 group-hover:text-deckly-primary transition-colors group-hover/title:bg-deckly-primary/10 border border-white/5 shadow-lg">
                            <FileText size={20} />
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                              <span className="font-black text-slate-200 group-hover/title:text-deckly-primary transition-colors tracking-tight">
                                {deck.title}
                              </span>
                              {isNewUpdate && (
                                <span className="px-1.5 py-0.5 bg-deckly-primary text-slate-950 text-[8px] font-black uppercase rounded-md shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                                  Update
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="py-8 min-w-[380px]">
                        <div className="group/note relative">
                          <AnimatePresence mode="wait">
                            {editingId === deck.id ? (
                              <motion.div
                                key="editing"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="bg-[#09090b] p-4 rounded-2xl border border-deckly-primary/30 shadow-2xl backdrop-blur-3xl z-30 space-y-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-deckly-primary uppercase tracking-widest">
                                    <Lock size={10} />
                                    Editing Private Note
                                  </div>
                                </div>
                                <textarea
                                  value={editContent}
                                  onChange={(e) =>
                                    setEditContent(e.target.value)
                                  }
                                  className="w-full bg-transparent border-none focus:ring-0 text-xs text-white min-h-[100px] resize-none p-0 placeholder:text-slate-600"
                                  autoFocus
                                  placeholder="Write your note for this document?"
                                />
                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                                  <button
                                    onClick={cancelEditing}
                                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveNote(deck.id)}
                                    disabled={isSavingNote}
                                    className="px-4 py-1.5 bg-deckly-primary text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2 disabled:opacity-50 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-deckly-primary/10"
                                  >
                                    {isSavingNote ? (
                                      <Loader2
                                        size={12}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Check size={12} strokeWidth={3} />
                                    )}
                                    Save Note
                                  </button>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="view"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                whileHover={{ scale: 1.01 }}
                                onClick={() => startEditing(deck)}
                                className={cn(
                                  "relative p-4 rounded-2xl border transition-all cursor-pointer group/card overflow-hidden",
                                  deck.investor_note
                                    ? "bg-white/[0.03] border-white/5 hover:border-white/20"
                                    : "bg-transparent border-dashed border-white/10 hover:border-deckly-primary/30 hover:bg-deckly-primary/[0.02]",
                                )}
                              >
                                {/* Private Badge */}
                                <div className="absolute top-3 right-4 flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-full border border-white/5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                  <Lock size={8} className="text-slate-500" />
                                  <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest font-mono">
                                    Private
                                  </span>
                                </div>

                                <div className="flex items-start gap-3">
                                  {!deck.investor_note && (
                                    <div className="mt-0.5 p-1.5 bg-white/5 rounded-lg text-slate-500 group-hover/card:text-deckly-primary group-hover/card:bg-deckly-primary/10 transition-colors">
                                      <Plus size={14} />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0 pr-12">
                                    <p
                                      className={cn(
                                        "text-xs leading-relaxed font-medium tracking-tight line-clamp-3 transition-colors",
                                        deck.investor_note
                                          ? "text-slate-300"
                                          : "text-slate-500 group-hover/card:text-slate-400",
                                      )}
                                    >
                                      {deck.investor_note ||
                                        "Click to add private investment notes, thesis or key takeaways..."}
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </TableCell>
                      <TableCell className="py-8 text-slate-500 font-bold text-xs uppercase tracking-widest">
                        {new Date(deck.saved_at)
                          .toLocaleDateString("en-GB")
                          .replace(/\//g, "-")}
                      </TableCell>
                      <TableCell className="py-8 text-slate-500 font-bold text-xs uppercase tracking-widest">
                        {deck.last_viewed_at
                          ? new Date(deck.last_viewed_at).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              },
                            )
                          : "Never"}
                      </TableCell>
                      <TableCell className="px-12 py-8 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            to={`/${deck.user_handle}/${deck.slug}`}
                            target="_blank"
                            className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 rounded-xl transition-all shadow-lg group/icon"
                            title="Open Deck"
                          >
                            <ExternalLink
                              size={20}
                              className="group-hover/icon:scale-110 transition-transform"
                            />
                          </Link>
                          <button
                            onClick={() => handleUnsaveClick(deck)}
                            className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 rounded-xl transition-all shadow-lg group/icon disabled:opacity-30"
                            title="Remove from Library"
                          >
                            <BookmarkMinus
                              size={20}
                              className="group-hover/icon:scale-110 transition-transform"
                            />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DashboardCard>
      <ConfirmModal
        isOpen={!!unsaveTarget}
        onClose={() => setUnsaveTarget(null)}
        onConfirm={handleConfirmUnsave}
        isLoading={isUnsavingInProgress}
        title="Remove from Library"
        message={`Are you sure you want to remove "${unsaveTarget?.title}" from your library?`}
        confirmText="Remove Deck"
        variant="danger"
      />
    </div>
  );
}
