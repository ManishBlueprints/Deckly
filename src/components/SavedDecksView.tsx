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
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../utils/cn";

export function SavedDecksView() {
  const { session } = useAuth();
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unsavingId, setUnsavingId] = useState<string | null>(null);

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

  const handleUnsave = async (deckId: string) => {
    if (!window.confirm("Remove this deck from your library?")) return;
    setUnsavingId(deckId);
    try {
      await deckService.removeFromLibrary(deckId);
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
    } catch (err) {
      console.error("Failed to unsave deck:", err);
    } finally {
      setUnsavingId(null);
    }
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
                    unsavingId === deck.id && "opacity-50",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/5 rounded-2xl text-slate-400 shrink-0 border border-white/5 shadow-lg">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/${deck.slug}`}
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
                      onClick={() => handleUnsave(deck.id)}
                      className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 rounded-xl transition-all shadow-lg disabled:opacity-30"
                      title="Remove from Library"
                    >
                      <BookmarkMinus size={20} />
                    </button>
                  </div>

                  {/* Notes below the name (mobile) */}
                  <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 group/note relative transition-colors hover:border-white/10">
                    <div className="flex gap-2 items-start justify-start w-full">
                      <div className="flex-1 min-w-0">
                        {editingId === deck.id ? (
                          <div className="space-y-4">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full bg-[#09090b] border border-white/10 rounded-xl p-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-deckly-primary/30 min-h-[140px] shadow-inner"
                              autoFocus
                              placeholder="Write your private notes here..."
                            />
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={cancelEditing}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
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
                          </div>
                        ) : (
                          <p className="text-xs text-slate-300 leading-relaxed font-bold italic tracking-tight">
                            {deck.investor_note
                              ? `"${deck.investor_note}"`
                              : "No private notes yet..."}
                          </p>
                        )}
                      </div>

                      {editingId !== deck.id && (
                        <button
                          onClick={() => startEditing(deck)}
                          className="p-2 text-slate-500 hover:text-deckly-primary transition-all hover:bg-white/5 rounded-lg shrink-0"
                          title="Edit Note"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
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
                        unsavingId === deck.id &&
                          "opacity-50 pointer-events-none",
                      )}
                    >
                      <TableCell className="px-12 py-8">
                        <Link
                          to={`/${deck.slug}`}
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
                      <TableCell className="py-8">
                        <div className="flex items-start gap-3 group/note relative w-fit max-w-sm">
                          <div className="min-w-0">
                            {editingId === deck.id ? (
                              <div
                                className="flex items-start gap-3 min-w-[340px] bg-[#09090b] p-3 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-3xl z-30"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <textarea
                                  value={editContent}
                                  onChange={(e) =>
                                    setEditContent(e.target.value)
                                  }
                                  className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-white min-h-[100px] resize-none p-0"
                                  autoFocus
                                  placeholder="Private notes..."
                                />
                                <div className="flex flex-col gap-2">
                                  <button
                                    onClick={handleSaveNote.bind(null, deck.id)}
                                    disabled={isSavingNote}
                                    className="p-2 bg-deckly-primary text-slate-950 rounded-xl disabled:opacity-50 hover:scale-110 transition-transform shadow-lg"
                                    title="Save"
                                  >
                                    {isSavingNote ? (
                                      <Loader2
                                        size={14}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Check size={14} strokeWidth={3} />
                                    )}
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className="p-2 bg-white/5 text-slate-500 rounded-xl hover:text-white transition-colors border border-white/10"
                                    title="Cancel"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic font-bold tracking-tight line-clamp-2 leading-relaxed">
                                {deck.investor_note ||
                                  "Click to add private notes..."}
                              </p>
                            )}
                          </div>

                          {editingId !== deck.id && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                startEditing(deck);
                              }}
                              className="p-2 text-slate-600 hover:text-deckly-primary transition-all shrink-0 hover:bg-white/5 rounded-lg opacity-0 group-hover:opacity-100"
                              title="Edit Note"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
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
                            to={`/${deck.slug}`}
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
                            onClick={() => handleUnsave(deck.id)}
                            disabled={unsavingId === deck.id}
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
    </div>
  );
}
