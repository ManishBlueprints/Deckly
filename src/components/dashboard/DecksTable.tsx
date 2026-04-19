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
import { getDeckShareUrl, getDeckPreviewPath } from "../../utils/url";
import { DeckWithAnalytics } from "../../types";
import { deckService } from "../../services/deckService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { cn } from "../../utils/cn";

interface DecksTableProps {
  decks: DeckWithAnalytics[];
  userHandle: string;
  loading?: boolean;
  onDelete?: (deck: DeckWithAnalytics) => Promise<void>;
}

export function DecksTable({
  decks,
  userHandle,
  loading,
  onDelete,
}: DecksTableProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<DeckWithAnalytics | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [publishedIds, setPublishedIds] = React.useState<Set<string>>(
    new Set(),
  );

  const handleCopyLink = async (deck: DeckWithAnalytics) => {
    try {
      const url = getDeckShareUrl(userHandle, deck.slug);
      await deckService.publishDeck(deck.id);
      await navigator.clipboard.writeText(url);
      setPublishedIds((prev) => new Set(prev).add(deck.id));
      setCopiedId(deck.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy public link:", err);
    }
  };

  const isDeckPublic = (deck: DeckWithAnalytics) =>
    !!deck.is_public || publishedIds.has(deck.id);

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

  const handleDeleteClick = (deck: DeckWithAnalytics) => {
    setDeleteTarget(deck);
  };

  return (
    <DashboardCard className="mt-8 bg-surface-card border border-border rounded-lg">
      {/* ─── Mobile Card List ─── */}
      <div className="md:hidden divide-y divide-border">
        {loading ? (
          Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="p-4 space-y-3">
                <div className="h-4 w-40 bg-surface-lowest animate-pulse rounded-none" />
                <div className="h-3 w-24 bg-surface-lowest animate-pulse rounded-none" />
              </div>
            ))
        ) : decks.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-sm">
            No decks uploaded yet
          </p>
        ) : (
          decks.map((deck) => (
            <div
              key={deck.id}
              className={cn(
                "p-4 flex items-center gap-3",
                deleteTarget?.id === deck.id &&
                  "opacity-50 pointer-events-none",
              )}
            >
              <div className="p-2.5 bg-surface-low rounded-none text-slate-500 shrink-0 border border-border">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  to={getDeckPreviewPath(deck.id)}
                  target="_blank"
                  className="font-medium text-slate-200 text-sm truncate block hover:text-deckly-primary transition-colors"
                >
                  {deck.title}
                </Link>
                <p className="text-xs text-slate-500 mt-1">
                  {deck.total_views} views · {deck.save_count} saves
                  {deck.last_viewed_at
                    ? ` · ${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(deck.last_viewed_at)).replace(/\//g, "-")}`
                    : ""}
                </p>
                <p className="text-[11px] mt-1 text-slate-500">
                  {isDeckPublic(deck)
                    ? "Public link active"
                    : "Copy link to make it public"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => void handleCopyLink(deck)}
                  className={cn(
                    "p-2.5 rounded-none transition-all border",
                    copiedId === deck.id
                      ? "bg-deckly-primary/10 border-deckly-primary/30 text-deckly-primary"
                      : "bg-green-500 border-green-500 text-slate-950 hover:bg-green-400 hover:border-green-400",
                  )}
                  title="Copy Link"
                >
                  {copiedId === deck.id ? (
                    <Check size={16} />
                  ) : (
                    <span className="text-xs px-1">Copy</span>
                  )}
                </button>
                <Link
                  to={`/analytics/${deck.id}`}
                  className="p-2.5 bg-surface-low border border-border text-slate-400 hover:text-white rounded-none transition-all"
                >
                  <BarChart3 size={16} />
                </Link>
                <Link
                  to={`/edit/${deck.id}`}
                  className="p-2.5 bg-surface-low border border-border text-slate-400 hover:text-white rounded-none transition-all"
                >
                  <Pencil size={16} />
                </Link>
                <button
                  onClick={() => handleDeleteClick(deck)}
                  disabled={deleteTarget?.id === deck.id}
                  className="p-2.5 bg-surface-low border border-border text-slate-400 hover:text-white rounded-none transition-all disabled:opacity-50"
                >
                  <Trash2 size={16} />
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
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-xs font-semibold text-slate-400 py-4 px-6 capitalize">
                Name
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-400 py-4 capitalize">
                Upload Date
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-400 py-4 text-center capitalize">
                Link
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-400 py-4 text-center capitalize">
                Views
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-400 py-4 text-center capitalize">
                Saves
              </TableHead>
              <TableHead className="text-xs font-semibold text-slate-400 py-4 text-center capitalize">
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
                  <TableRow key={i} className="border-border">
                    <TableCell className="px-6 py-4">
                      <div className="h-4 w-40 bg-surface-lowest animate-pulse rounded-none" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="h-4 w-24 bg-surface-lowest animate-pulse rounded-none" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="h-8 w-24 bg-surface-lowest animate-pulse rounded-none mx-auto" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="h-4 w-8 bg-surface-lowest animate-pulse rounded-none mx-auto" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="h-4 w-8 bg-surface-lowest animate-pulse rounded-none mx-auto" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="h-4 w-24 bg-surface-lowest animate-pulse rounded-none mx-auto" />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="h-8 w-20 bg-surface-lowest animate-pulse rounded-none ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
            ) : decks.length === 0 ? (
              <TableRow className="border-transparent">
                <TableCell
                  colSpan={7}
                  className="p-20 text-center text-slate-500 text-sm"
                >
                  No decks uploaded yet
                </TableCell>
              </TableRow>
            ) : (
              decks.map((deck) => (
                <TableRow
                  key={deck.id}
                  className={cn(
                    "group hover:bg-surface-low border-border transition-colors",
                    deleteTarget?.id === deck.id &&
                      "opacity-50 pointer-events-none",
                  )}
                >
                  <TableCell className="px-6 py-4">
                    <Link
                      to={getDeckPreviewPath(deck.id)}
                      target="_blank"
                      className="flex items-center gap-3 transition-all group/title"
                    >
                      <div className="p-2 bg-surface-lowest rounded-none text-slate-500 group-hover:text-deckly-primary transition-colors border border-border">
                        <FileText size={16} />
                      </div>
                      <span className="font-medium text-slate-300 group-hover/title:text-deckly-primary transition-colors">
                        {deck.title}
                      </span>
                    </Link>
                    <p className="text-[11px] mt-1 text-slate-500">
                      {isDeckPublic(deck)
                        ? "Public link active"
                        : "Copy link to make it public"}
                    </p>
                  </TableCell>
                  <TableCell className="py-4 text-slate-500 text-xs">
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                      .format(new Date(deck.created_at))
                      .replace(/\//g, "-")}
                  </TableCell>
                  <TableCell className="py-4 text-center">
                    <button
                      onClick={() => void handleCopyLink(deck)}
                      className={cn(
                        "text-xs px-4 py-2 rounded-none transition-all flex items-center gap-2 mx-auto border",
                        copiedId === deck.id
                          ? "bg-deckly-primary/10 border-deckly-primary/30 text-deckly-primary"
                          : "bg-green-500 border-green-500 text-slate-950 hover:bg-green-400 hover:border-green-400",
                      )}
                    >
                      {copiedId === deck.id ? (
                        <>
                          <Check size={14} /> Copied
                        </>
                      ) : (
                        "Copy Link"
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="py-4 text-center text-sm text-slate-300">
                    {deck.total_views}
                  </TableCell>
                  <TableCell className="py-4 text-center text-sm text-slate-300">
                    {deck.save_count}
                  </TableCell>
                  <TableCell className="py-4 text-center text-slate-500 text-xs">
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
                  <TableCell className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/analytics/${deck.id}`}
                        data-tour="analytics-btn"
                        className="p-2 bg-surface-lowest border border-border text-slate-400 hover:bg-surface-high hover:text-white rounded-none transition-all"
                        title="View Detailed Analytics"
                      >
                        <BarChart3 size={16} />
                      </Link>
                      <Link
                        to={`/edit/${deck.id}`}
                        data-tour="edit-btn"
                        className="p-2 bg-surface-lowest border border-border text-slate-400 hover:bg-surface-high hover:text-white rounded-none transition-all"
                        title="Edit Deck"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        onClick={() => handleDeleteClick(deck)}
                        data-tour="delete-btn"
                        disabled={deleteTarget?.id === deck.id}
                        className="p-2 bg-surface-lowest border border-border text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-900/50 rounded-none transition-all disabled:opacity-50"
                        title="Delete Deck"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deck</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This
              action cannot be undone and all analytics will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Deck"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardCard>
  );
}
