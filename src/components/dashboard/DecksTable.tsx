import React from "react";
import { toast } from "sonner";
import { DashboardCard } from "../ui/DashboardCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  BarChart3,
  Pencil,
  Trash2,
  FileText,
  Check,
  Loader2,
  Tag,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getDeckShareUrl, getDeckPreviewPath } from "../../utils/url";
import { DeckWithAnalytics } from "../../types";
import { deckService } from "../../services/deckService";
import { LibraryTag } from "../../types";
import { TagChip } from "../saved-decks/TagChip";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../../utils/cn";

interface DecksTableProps {
  decks: DeckWithAnalytics[];
  userHandle: string;
  loading?: boolean;
  onDelete?: (deck: DeckWithAnalytics) => Promise<void>;
  availableTags?: LibraryTag[];
  onUpdateTags?: (deckId: string, tagIds: string[]) => Promise<void> | void;
  emptyMessage?: string;
}

function DeckTagMenu({
  deck,
  availableTags,
  onUpdateTags,
}: {
  deck: DeckWithAnalytics;
  availableTags: LibraryTag[];
  onUpdateTags: (deckId: string, tagIds: string[]) => Promise<void> | void;
}) {
  const getDeckTagIds = () => (deck.tags ?? []).map((tag) => tag.id);
  const [tagFilterQuery, setTagFilterQuery] = React.useState("");
  const [selectedTagIds, setSelectedTagIds] =
    React.useState<string[]>(getDeckTagIds);
  const selectedTagIdsRef = React.useRef<string[]>(selectedTagIds);
  const updateSeqRef = React.useRef(0);

  const setOptimisticSelectedTagIds = (nextIds: string[]) => {
    selectedTagIdsRef.current = nextIds;
    setSelectedTagIds(nextIds);
  };

  const rollbackSelectedTagIds = () => {
    setOptimisticSelectedTagIds(getDeckTagIds());
  };

  React.useEffect(() => {
    setOptimisticSelectedTagIds(getDeckTagIds());
  }, [deck.id, deck.tags]);

  const filteredTags = availableTags.filter((tag) =>
    tagFilterQuery.trim()
      ? tag.name.toLowerCase().includes(tagFilterQuery.trim().toLowerCase())
      : true,
  );

  const handleTagToggle = async (tagId: string, checked: boolean) => {
    const currentSelectedTagIds = selectedTagIdsRef.current;
    const nextIds = checked
      ? Array.from(new Set([...currentSelectedTagIds, tagId]))
      : currentSelectedTagIds.filter((id) => id !== tagId);
    const requestSeq = updateSeqRef.current + 1;

    updateSeqRef.current = requestSeq;
    setOptimisticSelectedTagIds(nextIds);

    try {
      await onUpdateTags(deck.id, nextIds);
    } catch (error) {
      console.error("Failed to update deck tags:", error);
      if (requestSeq === updateSeqRef.current) {
        rollbackSelectedTagIds();
      }
      toast.error(
        error instanceof Error
          ? `Failed to update tags: ${error.message}`
          : "Failed to update tags. Please try again.",
      );
    }
  };

  const handleClearAll = async () => {
    const requestSeq = updateSeqRef.current + 1;

    updateSeqRef.current = requestSeq;
    setOptimisticSelectedTagIds([]);

    try {
      await onUpdateTags(deck.id, []);
    } catch (error) {
      console.error("Failed to clear deck tags:", error);
      if (requestSeq === updateSeqRef.current) {
        rollbackSelectedTagIds();
      }
      toast.error(
        error instanceof Error
          ? `Failed to clear tags: ${error.message}`
          : "Failed to clear tags. Please try again.",
      );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            selectedTagIds.length > 0
              ? `Manage tags for ${deck.title} (${selectedTagIds.length} selected)`
              : `Manage tags for ${deck.title}`
          }
          className="w-8 h-8 flex items-center justify-center bg-surface-lowest border border-border text-slate-400 hover:bg-surface-high hover:text-white rounded-md transition-all active:scale-95"
          title={
            selectedTagIds.length > 0
              ? `${selectedTagIds.length} tag(s) applied`
              : "Manage tags"
          }
        >
          <Tag size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 p-0 overflow-hidden border-white/10 bg-[#151515] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)]"
        onEscapeKeyDown={() => setTagFilterQuery("")}
      >
        <div className="border-b border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#bbcbbb]/40">
                Apply tags
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {selectedTagIds.length > 0
                  ? `${selectedTagIds.length} selected`
                  : "Pick one or more tags"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-300 transition-colors hover:border-white/20 hover:text-white"
            >
              Clear all
            </button>
          </div>

          <div className="mt-3">
            <input
              aria-label={`Filter tags for ${deck.title}`}
              value={tagFilterQuery}
              onChange={(e) => setTagFilterQuery(e.target.value)}
              placeholder="Search tags..."
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 custom-scrollbar">
          {filteredTags.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium text-slate-400">
                No tags found
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-slate-600">
                Try a different search
              </p>
            </div>
          ) : (
            filteredTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={isSelected}
                  onCheckedChange={(checked: boolean | "indeterminate") => {
                    void handleTagToggle(tag.id, checked === true);
                  }}
                  onSelect={(e) => e.preventDefault()}
                  className="text-[#bbcbbb]/60 data-[highlighted]:bg-[#1c1b1b] data-[highlighted]:text-white cursor-pointer px-4 py-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm font-bold">{tag.name}</span>
                  </div>
                </DropdownMenuCheckboxItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DecksTable({
  decks,
  userHandle,
  loading,
  onDelete,
  availableTags = [],
  onUpdateTags,
  emptyMessage = "No decks uploaded yet",
}: DecksTableProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<DeckWithAnalytics | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [publishingId, setPublishingId] = React.useState<string | null>(null);
  const [publishedIds, setPublishedIds] = React.useState<Set<string>>(
    new Set(),
  );

  const handleCopyLink = async (deck: DeckWithAnalytics) => {
    if (!userHandle) {
      toast.error("Please set a handle in your profile settings before sharing.");
      return;
    }
    setPublishingId(deck.id);
    try {
      const url = getDeckShareUrl(userHandle, deck.slug);
      await deckService.publishDeck(deck.id);
      await navigator.clipboard.writeText(url);
      setPublishedIds((prev) => new Set(prev).add(deck.id));
      setCopiedId(deck.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy public link:", err);
      toast.error(
        err instanceof Error
          ? `Failed to copy link: ${err.message}`
          : "Failed to activate public link. Please try again."
      );
    } finally {
      setPublishingId(null);
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

  const renderTagMenu = (deck: DeckWithAnalytics) => {
    if (!onUpdateTags || availableTags.length === 0) return null;

    return (
      <DeckTagMenu
        deck={deck}
        availableTags={availableTags}
        onUpdateTags={onUpdateTags}
      />
    );
  };

  const renderAppliedTags = (deck: DeckWithAnalytics) => {
    if (!deck.tags || deck.tags.length === 0) return null;

    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {deck.tags.slice(0, 2).map((tag) => (
          <TagChip key={tag.id} tag={tag} className="text-[8px] px-2 py-0.5" />
        ))}
        {deck.tags.length > 2 && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            +{deck.tags.length - 2} More
          </span>
        )}
      </div>
    );
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
            {emptyMessage}
          </p>
        ) : (
          decks.map((deck) => (
            <div
              key={deck.id}
              className={cn(
                "p-4 flex flex-col gap-4",
                deleteTarget?.id === deck.id &&
                  "opacity-50 pointer-events-none",
              )}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 bg-surface-low rounded-none text-slate-500 shrink-0 border border-border">
                  <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={getDeckPreviewPath(deck.id)}
                    target="_blank"
                    className="font-medium text-slate-200 text-sm truncate block hover:text-deckly-primary transition-colors"
                  >
                    {deck.title}
                  </Link>
                  {renderAppliedTags(deck)}
                  <p className="text-xs text-slate-500 mt-2 leading-tight">
                    {deck.total_views} views · {deck.save_count} saves
                    {deck.last_viewed_at
                      ? ` · ${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(deck.last_viewed_at)).replace(/\//g, "-")}`
                      : ""}
                  </p>
                  <p
                    className={cn(
                      "text-[11px] mt-1",
                      isDeckPublic(deck) ? "text-emerald-400" : "text-slate-500",
                    )}
                  >
                    {isDeckPublic(deck)
                      ? "Public link active"
                      : "Copy link to make it public"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {renderTagMenu(deck)}
                <button
                  onClick={() => void handleCopyLink(deck)}
                  disabled={publishingId === deck.id}
                  className={cn(
                    "p-2.5 rounded-none transition-all border",
                    publishingId === deck.id && "opacity-50 cursor-not-allowed",
                    copiedId === deck.id
                      ? "bg-deckly-primary/10 border-deckly-primary/30 text-deckly-primary"
                      : "bg-green-500 border-green-500 text-slate-950 hover:bg-green-400 hover:border-green-400",
                  )}
                  title="Copy Link"
                >
                  {publishingId === deck.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : copiedId === deck.id ? (
                    <Check size={16} />
                  ) : (
                    <span className="text-xs px-1">Copy</span>
                  )}
                </button>
                <Link
                  to={`/analytics/${deck.id}`}
                  className="p-2.5 bg-surface-low border border-border text-slate-400 hover:bg-surface-high hover:text-white rounded-none transition-all"
                >
                  <BarChart3 size={16} />
                </Link>
                <Link
                  to={`/edit/${deck.id}`}
                  className="p-2.5 bg-surface-low border border-border text-slate-400 hover:bg-surface-high hover:text-white rounded-none transition-all"
                >
                  <Pencil size={16} />
                </Link>
                <button
                  onClick={() => handleDeleteClick(deck)}
                  disabled={deleteTarget?.id === deck.id}
                  className="p-2.5 bg-surface-low border border-border text-slate-400 hover:bg-surface-high hover:text-white rounded-none transition-all disabled:opacity-50"
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
                Tags
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
                      <div className="h-4 w-28 bg-surface-lowest animate-pulse rounded-none" />
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
                  colSpan={8}
                  className="p-20 text-center text-slate-500 text-sm"
                >
                  {emptyMessage}
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
                      <span className="font-medium text-slate-300 group-hover/title:text-deckly-primary transition-colors block">
                        {deck.title}
                      </span>
                    </Link>
                    <p
                      className={cn(
                        "text-[11px] mt-1",
                        isDeckPublic(deck)
                          ? "text-emerald-400"
                          : "text-slate-500",
                      )}
                    >
                      {isDeckPublic(deck)
                        ? "Public link active"
                        : "Copy link to make it public"}
                    </p>
                  </TableCell>
                  <TableCell className="py-4">
                    {renderAppliedTags(deck)}
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
                      disabled={publishingId === deck.id}
                      className={cn(
                        "text-xs px-4 py-2 rounded-none transition-all flex items-center gap-2 mx-auto border",
                        publishingId === deck.id && "opacity-50 cursor-not-allowed",
                        copiedId === deck.id
                          ? "bg-deckly-primary/10 border-deckly-primary/30 text-deckly-primary"
                          : "bg-green-500 border-green-500 text-slate-950 hover:bg-green-400 hover:border-green-400",
                      )}
                    >
                      {publishingId === deck.id ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Publishing
                        </>
                      ) : copiedId === deck.id ? (
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
                      {renderTagMenu(deck)}
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
