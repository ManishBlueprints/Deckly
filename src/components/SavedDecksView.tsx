import { useState, useEffect, useCallback } from "react";
import { deckService } from "../services/deckService";
import { SavedDeck } from "../types";
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
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unsaveTarget, setUnsaveTarget] = useState<SavedDeck | null>(null);
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

  const handleUnsaveClick = (deck: SavedDeck) => {
    setUnsaveTarget(deck);
  };

  const startEditing = (deck: SavedDeck) => {
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
    <div className="space-y-8 pb-12 animate-in fade-in duration-700 relative">
      <p className="text-slate-400 text-sm font-medium -mb-4">
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

      <DashboardCard className="bg-[#111] border border-[#222] rounded-lg overflow-hidden">
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-[#222]">
          {loading ? (
            Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="p-4 space-y-3">
                  <div className="h-4 w-48 bg-[#1a1a1a] animate-pulse rounded-md" />
                  <div className="h-3 w-32 bg-[#1a1a1a] animate-pulse rounded-md" />
                </div>
              ))
          ) : decks.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-[#141414] rounded-full flex items-center justify-center text-slate-500 mx-auto border border-[#333]">
                <FileText size={32} />
              </div>
              <p className="text-slate-400 text-sm max-w-[200px] mx-auto">
                Your library is empty.
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
                    "p-4 flex flex-col gap-4",
                    unsaveTarget?.id === deck.id &&
                      "opacity-50 pointer-events-none",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-[#141414] rounded-md text-slate-500 shrink-0 border border-[#333]">
                      <FileText size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/${deck.user_handle}/${deck.slug}`}
                          target="_blank"
                          className="font-medium text-slate-200 text-sm truncate block hover:text-deckly-primary transition-colors"
                        >
                          {deck.title}
                        </Link>
                        {isNewUpdate && (
                          <span className="px-1.5 py-0.5 bg-deckly-primary/10 border border-deckly-primary/20 text-deckly-primary text-[10px] font-semibold rounded-md shrink-0">
                            Update
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Saved{" "}
                        {new Date(deck.saved_at)
                          .toLocaleDateString("en-GB")
                          .replace(/\//g, "-")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleUnsaveClick(deck)}
                      className="p-2.5 bg-[#141414] border border-[#333] text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-900/50 rounded-md transition-all shrink-0"
                      title="Remove from Library"
                    >
                      <BookmarkMinus size={18} />
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
                          className="bg-[#141414] p-4 rounded-lg border border-[#333] space-y-3"
                        >
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                            <Lock size={12} />
                            Private Note
                          </div>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-[#111] border border-[#222] rounded-md focus:outline-none focus:ring-1 focus:ring-deckly-primary text-sm text-slate-200 min-h-[100px] resize-none p-3 placeholder:text-slate-500"
                            autoFocus
                            placeholder="Write your private investment thesis..."
                          />
                          <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                              onClick={cancelEditing}
                              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveNote(deck.id)}
                              disabled={isSavingNote}
                              className="px-4 py-2 bg-deckly-primary text-slate-950 text-xs font-semibold rounded-md flex items-center gap-2 disabled:opacity-50 hover:bg-deckly-primary/90 transition-all"
                            >
                              {isSavingNote ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Check size={14} />
                              )}
                              Save
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
                            "relative p-3 rounded-lg border transition-all active:scale-[0.98] cursor-pointer block",
                            deck.investor_note
                              ? "bg-[#141414] border-[#333]"
                              : "bg-transparent border-dashed border-[#333] hover:border-[#444]",
                          )}
                        >
                          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 bg-[#222] rounded-md border border-[#333]">
                            <Lock size={10} className="text-slate-400" />
                            <span className="text-[10px] font-medium text-slate-400">
                              Private
                            </span>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 pt-0.5">
                              {!deck.investor_note && (
                                <div className="text-deckly-primary">
                                  <Plus size={16} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pr-16 py-0.5">
                              <p
                                className={cn(
                                  "text-sm leading-relaxed",
                                  deck.investor_note
                                    ? "text-slate-300"
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
              <TableRow className="hover:bg-transparent border-[#222]">
                <TableHead className="text-xs font-semibold text-slate-400 py-4 px-6 capitalize">
                  Name
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 py-4 capitalize">
                  Personal Notes
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 py-4 capitalize">
                  Saved On
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 py-4 capitalize">
                  Last Viewed
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 py-4 text-right px-6 capitalize">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(3)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i} className="border-[#222]">
                      <TableCell className="px-6 py-4">
                        <div className="h-4 w-48 bg-[#1a1a1a] animate-pulse rounded-md" />
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="h-4 w-64 bg-[#1a1a1a] animate-pulse rounded-md" />
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="h-4 w-24 bg-[#1a1a1a] animate-pulse rounded-md" />
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="h-4 w-24 bg-[#1a1a1a] animate-pulse rounded-md" />
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <div className="h-8 w-16 bg-[#1a1a1a] animate-pulse rounded-md ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : decks.length === 0 ? (
                <TableRow className="border-transparent">
                  <TableCell colSpan={5} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-500">
                      <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center text-slate-500 border border-[#333]">
                        <FileText size={32} />
                      </div>
                      <p className="text-sm">
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
                        "group hover:bg-[#141414] border-[#222] transition-colors",
                        unsaveTarget?.id === deck.id &&
                          "opacity-50 pointer-events-none",
                      )}
                    >
                      <TableCell className="px-6 py-4">
                        <Link
                          to={`/${deck.user_handle}/${deck.slug}`}
                          target="_blank"
                          className="flex items-center gap-3 group/title"
                        >
                          <div className="p-2 bg-[#1a1a1a] rounded-md text-slate-500 group-hover:text-deckly-primary transition-colors border border-[#333]">
                            <FileText size={16} />
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-300 group-hover/title:text-deckly-primary transition-colors">
                                {deck.title}
                              </span>
                              {isNewUpdate && (
                                <span className="px-1.5 py-0.5 bg-deckly-primary/10 border border-deckly-primary/20 text-deckly-primary text-[10px] font-semibold rounded-md">
                                  Update
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="py-4 min-w-[320px]">
                        <div className="group/note relative">
                          <AnimatePresence mode="wait">
                            {editingId === deck.id ? (
                              <motion.div
                                key="editing"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="bg-[#1a1a1a] p-3 rounded-lg border border-[#333] shadow-xl z-30 space-y-3 absolute top-0 -translate-y-2 left-0 right-0 w-[400px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                                    <Lock size={12} />
                                    Private Note
                                  </div>
                                </div>
                                <textarea
                                  value={editContent}
                                  onChange={(e) =>
                                    setEditContent(e.target.value)
                                  }
                                  className="w-full bg-[#111] border border-[#222] rounded-md focus:outline-none focus:ring-1 focus:ring-deckly-primary text-sm text-slate-200 min-h-[100px] resize-none p-3 placeholder:text-slate-500"
                                  autoFocus
                                  placeholder="Write your note for this document..."
                                />
                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <button
                                    onClick={cancelEditing}
                                    className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveNote(deck.id)}
                                    disabled={isSavingNote}
                                    className="px-4 py-1.5 bg-deckly-primary text-slate-950 text-xs font-semibold rounded-md flex items-center gap-2 disabled:opacity-50 hover:bg-deckly-primary/90 transition-all"
                                  >
                                    {isSavingNote ? (
                                      <Loader2
                                        size={14}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Check size={14} />
                                    )}
                                    Save
                                  </button>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="view"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                onClick={() => startEditing(deck)}
                                className={cn(
                                  "relative p-3 rounded-lg border transition-all cursor-pointer group/card overflow-hidden block",
                                  deck.investor_note
                                    ? "bg-[#141414] border-[#333] hover:border-[#444]"
                                    : "bg-transparent border-dashed border-[#333] hover:border-deckly-primary/30 hover:bg-deckly-primary/5",
                                )}
                              >
                                {/* Private Badge */}
                                <div className="absolute top-2.5 right-3 flex items-center gap-1.5 px-2 py-0.5 bg-[#222] rounded-md border border-[#333] opacity-0 group-hover/card:opacity-100 transition-opacity">
                                  <Lock size={10} className="text-slate-400" />
                                  <span className="text-[10px] font-medium text-slate-400">
                                    Private
                                  </span>
                                </div>

                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 pt-0.5">
                                    {!deck.investor_note && (
                                      <div className="text-slate-500 group-hover/card:text-deckly-primary transition-colors">
                                        <Plus size={16} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 pr-16 py-0.5">
                                    <p
                                      className={cn(
                                        "text-sm leading-relaxed line-clamp-3 transition-colors",
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
                      <TableCell className="py-4 text-slate-500 text-xs">
                        {new Date(deck.saved_at)
                          .toLocaleDateString("en-GB")
                          .replace(/\//g, "-")}
                      </TableCell>
                      <TableCell className="py-4 text-slate-500 text-xs">
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
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/${deck.user_handle}/${deck.slug}`}
                            target="_blank"
                            className="p-2 bg-[#1a1a1a] border border-[#333] text-slate-400 hover:bg-[#222] hover:text-white rounded-md transition-all group/icon"
                            title="Open Deck"
                          >
                            <ExternalLink size={16} />
                          </Link>
                          <button
                            onClick={() => handleUnsaveClick(deck)}
                            className="p-2 bg-[#1a1a1a] border border-[#333] text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-900/50 rounded-md transition-all disabled:opacity-50 group/icon"
                            title="Remove from Library"
                          >
                            <BookmarkMinus size={16} />
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
