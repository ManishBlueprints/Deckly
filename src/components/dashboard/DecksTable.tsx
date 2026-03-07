import React from "react";
import { DashboardCard } from "../ui/DashboardCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { BarChart3, Pencil, Trash2, FileText, Check } from "lucide-react";
import { Link } from "react-router-dom";

interface Deck {
  id: string;
  title: string;
  slug: string;
  created_at: string;
  total_views: number;
  last_viewed_at: string | null;
  file_url: string;
  save_count: number;
}

interface DecksTableProps {
  decks: Deck[];
  userHandle: string;
  loading?: boolean;
  onDelete?: (deck: Deck) => Promise<void>;
}

import { ConfirmModal } from "../common/ConfirmModal";

export function DecksTable({
  decks,
  userHandle,
  loading,
  onDelete,
}: DecksTableProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Deck | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleCopyLink = (slug: string, id: string) => {
    const url = `${window.location.origin}/${userHandle}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      if (onDelete) await onDelete(deleteTarget);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = (deck: Deck) => {
    setDeleteTarget(deck);
  };

  return (
    <DashboardCard className="mt-8 border-white/5 shadow-2xl glass-shiny">
      {/* ─── Mobile Card List ─── */}
      <div className="md:hidden divide-y divide-white/5">
        {loading ? (
          Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="p-6 space-y-4">
                <div className="h-4 w-40 bg-white/5 animate-pulse rounded-lg" />
                <div className="h-3 w-24 bg-white/5 animate-pulse rounded-lg" />
              </div>
            ))
        ) : decks.length === 0 ? (
          <p className="p-12 text-center text-slate-500 text-sm font-bold uppercase tracking-widest">
            No decks uploaded yet
          </p>
        ) : (
          decks.map((deck) => (
            <div
              key={deck.id}
              className={clsx(
                "p-6 flex items-center gap-4",
                deleteTarget?.id === deck.id &&
                  "opacity-50 pointer-events-none",
              )}
            >
              <div className="p-3 bg-white/5 rounded-2xl text-slate-400 shrink-0 border border-white/5">
                <FileText size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  to={`/${userHandle}/${deck.slug}`}
                  target="_blank"
                  className="font-bold text-slate-200 text-sm truncate block hover:text-deckly-primary transition-colors"
                >
                  {deck.title}
                </Link>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                  {deck.total_views} views · {deck.save_count} saves
                  {deck.last_viewed_at
                    ? ` · ${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(deck.last_viewed_at)).replace(/\//g, "-")}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCopyLink(deck.slug, deck.id)}
                  className={clsx(
                    "p-3 rounded-xl transition-all border",
                    copiedId === deck.id
                      ? "bg-deckly-primary border-deckly-primary text-slate-950 shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                      : "bg-white/5 border-white/10 text-slate-400 hover:text-white",
                  )}
                  title="Copy Link"
                >
                  {copiedId === deck.id ? (
                    <Check size={16} strokeWidth={3} />
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-1">
                      Copy
                    </span>
                  )}
                </button>
                <Link
                  to={`/analytics/${deck.id}`}
                  className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 rounded-xl transition-all"
                >
                  <BarChart3 size={18} />
                </Link>
                <Link
                  to={`/edit/${deck.id}`}
                  className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/20 rounded-xl transition-all"
                >
                  <Pencil size={18} />
                </Link>
                <button
                  onClick={() => handleDeleteClick(deck)}
                  disabled={deleteTarget?.id === deck.id}
                  className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 rounded-xl transition-all disabled:opacity-30"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── Desktop Table ─── */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-white/5">
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 py-8 px-12">
                Name
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 py-8">
                Upload Date
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 py-8 text-center">
                Link
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 py-8 text-center">
                Views
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 py-8 text-center">
                Saves
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 py-8 text-center">
                Last Viewed
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 py-8 text-right px-12">
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
                      <div className="h-4 w-40 bg-white/5 animate-pulse rounded-lg" />
                    </TableCell>
                    <TableCell className="py-8">
                      <div className="h-4 w-24 bg-white/5 animate-pulse rounded-lg" />
                    </TableCell>
                    <TableCell className="py-8">
                      <div className="h-10 w-32 bg-white/5 animate-pulse rounded-xl mx-auto" />
                    </TableCell>
                    <TableCell className="py-8">
                      <div className="h-4 w-8 bg-white/5 animate-pulse rounded mx-auto" />
                    </TableCell>
                    <TableCell className="py-8">
                      <div className="h-4 w-8 bg-white/5 animate-pulse rounded mx-auto" />
                    </TableCell>
                    <TableCell className="py-8">
                      <div className="h-4 w-24 bg-white/5 animate-pulse rounded mx-auto" />
                    </TableCell>
                    <TableCell className="px-12 py-8 text-right">
                      <div className="h-10 w-24 bg-white/5 animate-pulse rounded-xl ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
            ) : decks.length === 0 ? (
              <TableRow className="border-transparent">
                <TableCell
                  colSpan={7}
                  className="p-32 text-center text-slate-500 font-bold uppercase tracking-widest text-xs"
                >
                  No decks uploaded yet
                </TableCell>
              </TableRow>
            ) : (
              decks.map((deck) => (
                <TableRow
                  key={deck.id}
                  className={clsx(
                    "group hover:bg-white/[0.02] border-white/5 transition-colors",
                    deleteTarget?.id === deck.id &&
                      "opacity-50 pointer-events-none",
                  )}
                >
                  <TableCell className="px-12 py-8">
                    <Link
                      to={`/${userHandle}/${deck.slug}`}
                      target="_blank"
                      className="flex items-center gap-4 transition-all group/title"
                    >
                      <div className="p-3 bg-white/5 rounded-2xl text-slate-400 group-hover:text-deckly-primary transition-colors group-hover/title:bg-deckly-primary/10 border border-white/5 shadow-lg">
                        <FileText size={20} />
                      </div>
                      <span className="font-bold text-slate-200 group-hover/title:text-deckly-primary transition-colors tracking-tight">
                        {deck.title}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="py-8 text-slate-500 font-bold text-xs">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                      .format(new Date(deck.created_at))
                      .replace(/\//g, "-")}
                  </TableCell>
                  <TableCell className="py-8 text-center">
                    <button
                      onClick={() => handleCopyLink(deck.slug, deck.id)}
                      className={clsx(
                        "text-[10px] font-bold uppercase tracking-[0.2em] px-5 py-3 rounded-xl transition-all flex items-center gap-2 mx-auto border",
                        copiedId === deck.id
                          ? "bg-deckly-primary border-deckly-primary text-slate-950 shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                          : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20",
                      )}
                    >
                      {copiedId === deck.id ? (
                        <>
                          <Check size={14} strokeWidth={3} /> Copied
                        </>
                      ) : (
                        "Copy Link"
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="py-8 text-center font-bold text-white text-lg">
                    {deck.total_views}
                  </TableCell>
                  <TableCell className="py-8 text-center font-bold text-white text-lg">
                    {deck.save_count}
                  </TableCell>
                  <TableCell className="py-8 text-center text-slate-500 font-bold text-xs">
                    {deck.last_viewed_at
                      ? new Intl.DateTimeFormat("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                          .format(new Date(deck.last_viewed_at))
                          .replace(/\//g, "-")
                      : "-"}
                  </TableCell>
                  <TableCell className="px-12 py-8 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        to={`/analytics/${deck.id}`}
                        className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 rounded-xl transition-all shadow-lg group/icon"
                        title="View Detailed Analytics"
                      >
                        <BarChart3
                          size={20}
                          className="group-hover/icon:scale-110 transition-transform"
                        />
                      </Link>
                      <Link
                        to={`/edit/${deck.id}`}
                        className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/20 rounded-xl transition-all shadow-lg group/icon"
                        title="Edit Deck"
                      >
                        <Pencil
                          size={20}
                          className="group-hover/icon:scale-110 transition-transform"
                        />
                      </Link>
                      <button
                        onClick={() => handleDeleteClick(deck)}
                        disabled={deleteTarget?.id === deck.id}
                        className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 rounded-xl transition-all shadow-lg group/icon disabled:opacity-30"
                        title="Delete Deck"
                      >
                        <Trash2
                          size={20}
                          className="group-hover/icon:scale-110 transition-transform"
                        />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Delete Deck"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone and all analytics will be lost.`}
        confirmText="Delete Deck"
        variant="danger"
      />
    </DashboardCard>
  );
}

function clsx(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
