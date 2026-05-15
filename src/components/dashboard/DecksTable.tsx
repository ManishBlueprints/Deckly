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
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Power,
  Tag,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getDeckPreviewPath } from "../../utils/url";
import { DeckLink, DeckWithAnalytics, LibraryTag } from "../../types";
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
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { cn } from "../../utils/cn";
import { normalizeSlug } from "../../utils/slug";
import { deckLinkService } from "../../services/deckLinkService";
import {
  useCreateDeckLink,
  useDeckLinks,
  useDeleteDeckLink,
  useDisableDeckLink,
  useEnableDeckLink,
} from "../../hooks/useDeckLinks";
import { canCopyPrimaryDeckLink, getDeckLinkSummary, getPrimaryDeckLink } from "./deckLinkUi";
import { formatLinkCreatedAt, splitShareUrl } from "./deckLinkFormatting";

interface DecksTableProps {
  decks: DeckWithAnalytics[];
  workspaceSlug: string;
  loading?: boolean;
  onDelete?: (deck: DeckWithAnalytics) => Promise<void>;
  availableTags?: LibraryTag[];
  onUpdateTags?: (deckId: string, tagIds: string[]) => Promise<void> | void;
  emptyMessage?: string;
}

function getLinkLabel(link: DeckLink, primaryLinkId?: string): string {
  if (link.is_primary || primaryLinkId === link.id) {
    return "Default Link";
  }

  return `Private Link`;
}

function DeckLinksPanel({
  deck,
  workspaceSlug,
  isOpen,
}: {
  deck: DeckWithAnalytics;
  workspaceSlug: string;
  isOpen: boolean;
}) {
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [draftLinkName, setDraftLinkName] = React.useState("");
  const [draftLinkAlias, setDraftLinkAlias] = React.useState("");
  const [createFormError, setCreateFormError] = React.useState<string | null>(null);
  const [disableTarget, setDisableTarget] = React.useState<DeckLink | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<DeckLink | null>(null);
  const userCanManageLinks = Boolean(workspaceSlug);

  const {
    data: links = [],
    isLoading,
    error,
  } = useDeckLinks(deck.id, deck.user_id, { enabled: isOpen });
  const createMutation = useCreateDeckLink(deck.id, deck.user_id);
  const enableMutation = useEnableDeckLink(deck.id, deck.user_id);
  const disableMutation = useDisableDeckLink(deck.id, deck.user_id);
  const deleteMutation = useDeleteDeckLink(deck.id, deck.user_id);

  const primaryLink = React.useMemo(() => getPrimaryDeckLink(links), [links]);

  const handleCreateLink = async () => {
    const trimmedName = draftLinkName.trim();
    const normalizedAlias = normalizeSlug(draftLinkAlias);

    if (!trimmedName) {
      setCreateFormError("Link name is required.");
      return;
    }

    if (normalizedAlias.length < 3) {
      setCreateFormError("Custom link must be at least 3 characters long.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        linkName: trimmedName,
        linkAlias: normalizedAlias,
      });
      setCreateDialogOpen(false);
      setDraftLinkName("");
      setDraftLinkAlias("");
      setCreateFormError(null);
    } catch (createError) {
      console.error("Failed to create deck link:", createError);
      toast.error(
        createError instanceof Error
          ? createError.message
          : "Failed to create link. Please try again.",
      );
    }
  };

  const handleEnableLink = async (linkId: string) => {
    try {
      await enableMutation.mutateAsync(linkId);
    } catch (enableError) {
      console.error("Failed to enable deck link:", enableError);
      toast.error(
        enableError instanceof Error
          ? enableError.message
          : "Failed to enable link. Please try again.",
      );
    }
  };

  const handleDisableLink = async (linkId: string) => {
    try {
      await disableMutation.mutateAsync(linkId);
      setDisableTarget(null);
    } catch (disableError) {
      console.error("Failed to disable deck link:", disableError);
      toast.error(
        disableError instanceof Error
          ? disableError.message
          : "Failed to disable link. Please try again.",
      );
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      await deleteMutation.mutateAsync(linkId);
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error("Failed to delete deck link:", deleteError);
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete link. Please try again.",
      );
    }
  };

  const requestDisableLink = (link: DeckLink) => {
    if (link.is_primary) {
      setDisableTarget(link);
      return;
    }

    void handleDisableLink(link.id);
  };

  return (
    <>
      <div
        className="border border-white/10 bg-[#101010] text-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]"
        data-testid={`deck-link-panel-${deck.id}`}
      >
        <div className="border-b border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-deckly-primary/70">
                  Link Control
                </p>
                <h3 className="mt-2 text-lg font-bold text-white">{deck.title}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Open, copy, disable, or remove each deck link from one place.
                </p>
              </div>

            <Button
              type="button"
              onClick={() => {
                setDraftLinkName(`Link ${links.length + 1}`);
                setDraftLinkAlias("");
                setCreateFormError(null);
                setCreateDialogOpen(true);
              }}
              disabled={createMutation.isPending || !userCanManageLinks}
              className="bg-deckly-primary text-slate-950 hover:bg-deckly-primary/90"
              data-testid={`create-deck-link-${deck.id}`}
                title={
                  userCanManageLinks
                    ? "Create Link"
                    : "Set your workspace slug before creating deck links"
                }
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    Create Link
                  </>
                )}
              </Button>
            </div>
        </div>

        {!userCanManageLinks && (
          <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-xs text-red-200">
            Set your workspace slug in profile settings before creating or copying deck links.
          </div>
        )}

        <div className="max-h-[420px] overflow-y-auto p-3 custom-scrollbar">
          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-200">
              {error instanceof Error ? error.message : "Failed to load deck links."}
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-xl border border-white/5 bg-white/[0.03]"
                />
              ))}
            </div>
          ) : links.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-deckly-primary/20 bg-deckly-primary/10 text-deckly-primary">
                <Link2 size={22} />
              </div>
              <h4 className="mt-4 text-lg font-bold text-white">No links yet</h4>
              <p className="mt-2 max-w-sm text-sm text-slate-400">
                Create a private link first, then enable it when you are ready to share.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map((link) => {
                const isPrimary = primaryLink?.id === link.id;
                const isPending =
                  (enableMutation.isPending && enableMutation.variables === link.id) ||
                  (disableMutation.isPending && disableMutation.variables === link.id) ||
                  (deleteMutation.isPending && deleteMutation.variables === link.id);
                const { origin, pathWithQuery } = splitShareUrl(link.share_url);

                return (
                  <div
                    key={link.id}
                    className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-4"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-white">
                            {link.link_name || getLinkLabel(link, primaryLink?.id)}
                          </span>
                          {isPrimary && (
                            <span className="rounded-full border border-deckly-primary/20 bg-deckly-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-deckly-primary">
                              Default
                            </span>
                          )}
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                              link.is_enabled
                                ? "border-deckly-primary/20 bg-deckly-primary/10 text-deckly-primary"
                                : "border-white/10 bg-white/[0.03] text-slate-500",
                            )}
                          >
                            {link.is_enabled ? "Active" : "Private"}
                          </span>
                        </div>

                        <div className="mt-3 flex min-w-0 items-center border border-white/10 bg-black/20">
                          <span className="shrink-0 border-r border-white/10 px-3 py-3 text-xs text-slate-500">
                            {origin}
                          </span>
                          <span className="min-w-0 flex-1 truncate px-3 py-3 text-sm text-white">
                            {pathWithQuery}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>Created {formatLinkCreatedAt(link.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <a
                          href={link.share_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-10 w-10 items-center justify-center rounded-none border border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                          aria-label={`Open link for ${deck.title}`}
                        >
                          <ExternalLink size={14} />
                        </a>

                        <Button
                          type="button"
                          onClick={() =>
                            link.is_enabled
                              ? requestDisableLink(link)
                              : void handleEnableLink(link.id)
                          }
                          disabled={isPending || !userCanManageLinks}
                          className={cn(
                            "rounded-none border text-white",
                            link.is_enabled
                              ? "border-red-500/40 bg-red-500 text-white hover:bg-red-500/90"
                              : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]",
                            (isPending || !userCanManageLinks) && "cursor-not-allowed opacity-60",
                          )}
                          data-testid={`${link.is_enabled ? "disable" : "enable"}-deck-link-${link.id}`}
                        >
                          {isPending &&
                          ((enableMutation.isPending && enableMutation.variables === link.id) ||
                            (disableMutation.isPending && disableMutation.variables === link.id)) ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Power size={14} />
                          )}
                          {link.is_enabled ? "Disable" : "Enable"}
                        </Button>

                        <Button
                          type="button"
                          onClick={() => setDeleteTarget(link)}
                          disabled={isPending || !userCanManageLinks}
                          className={cn(
                            "rounded-none border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white",
                            (isPending || !userCanManageLinks) && "cursor-not-allowed opacity-60",
                          )}
                          data-testid={`delete-deck-link-${link.id}`}
                        >
                          {deleteMutation.isPending && deleteMutation.variables === link.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!disableTarget} onOpenChange={(open) => !open && setDisableTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Default Link</AlertDialogTitle>
            <AlertDialogDescription>
              Disabling the default link will immediately block new bare-route access for this deck.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault();
                if (disableTarget) {
                  void handleDisableLink(disableTarget.id);
                }
              }}
            >
              Disable Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setCreateFormError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Link</AlertDialogTitle>
            <AlertDialogDescription>
              Set a saved link name and custom alias for this deck link. The generated share URL will keep the secure link token attached automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Link Name</label>
              <input
                value={draftLinkName}
                onChange={(event) => setDraftLinkName(event.currentTarget.value)}
                placeholder="Investor Follow-up"
                className="w-full border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-deckly-primary/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Custom Link</label>
              <div className="flex min-w-0 items-center border border-white/10 bg-black/20">
                <span className="shrink-0 border-r border-white/10 px-3 py-3 text-xs text-slate-500">
                  {workspaceSlug ? `/${workspaceSlug}/` : "/your-workspace/"}
                </span>
                <input
                  value={draftLinkAlias}
                  onChange={(event) => setDraftLinkAlias(event.currentTarget.value)}
                  placeholder="custom-room-link"
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none"
                />
              </div>
              <p className="text-xs text-slate-500">
                Saved as <span className="font-mono text-slate-300">{normalizeSlug(draftLinkAlias) || "custom-room-link"}</span>
              </p>
            </div>

            {createFormError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {createFormError}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-deckly-primary text-slate-950 hover:bg-deckly-primary/90"
              onClick={(event) => {
                event.preventDefault();
                void handleCreateLink();
              }}
            >
              {createMutation.isPending ? "Creating..." : "Create Link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Link</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.is_primary
                ? "Deleting the default link will remove the legacy bare-route sharing path for this deck immediately."
                : "Deleting this link will permanently remove it and stop access through it immediately."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) {
                  void handleDeleteLink(deleteTarget.id);
                }
              }}
            >
              Delete Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
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
  const deckTagIds = React.useMemo(
    () => (deck.tags ?? []).map((tag) => tag.id),
    [deck.tags],
  );
  const [tagFilterQuery, setTagFilterQuery] = React.useState("");
  const [selectedTagIds, setSelectedTagIds] =
    React.useState<string[]>(deckTagIds);
  const selectedTagIdsRef = React.useRef<string[]>(selectedTagIds);
  const updateSeqRef = React.useRef(0);
  const pendingUpdatePromiseRef = React.useRef<Promise<void> | null>(null);
  const queuedTagIdsRef = React.useRef<string[] | null>(null);

  const setOptimisticSelectedTagIds = (nextIds: string[]) => {
    selectedTagIdsRef.current = nextIds;
    setSelectedTagIds(nextIds);
  };

  const rollbackSelectedTagIds = () => {
    setOptimisticSelectedTagIds(deckTagIds);
  };

  React.useEffect(() => {
    setOptimisticSelectedTagIds(deckTagIds);
    queuedTagIdsRef.current = null;
  }, [deck.id, deckTagIds]);

  const flushPendingUpdates = React.useCallback(async () => {
    if (pendingUpdatePromiseRef.current) {
      return pendingUpdatePromiseRef.current;
    }

    const runUpdates = async () => {
      while (queuedTagIdsRef.current) {
        const nextSnapshot = queuedTagIdsRef.current;
        queuedTagIdsRef.current = null;

        try {
          await onUpdateTags(deck.id, nextSnapshot);
        } catch (error) {
          if (queuedTagIdsRef.current) {
            continue;
          }
          throw error;
        }
      }
    };

    pendingUpdatePromiseRef.current = runUpdates().finally(() => {
      pendingUpdatePromiseRef.current = null;
      if (queuedTagIdsRef.current) {
        void flushPendingUpdates();
      }
    });

    return pendingUpdatePromiseRef.current;
  }, [deck.id, onUpdateTags]);

  const commitTagSelection = async (requestSeq: number, nextIds: string[]) => {
    queuedTagIdsRef.current = nextIds;

    try {
      await flushPendingUpdates();
    } catch (error) {
      console.error("Failed to update deck tags:", error);
      if (requestSeq === updateSeqRef.current) {
        rollbackSelectedTagIds();
      }
      toast.error("Failed to update tags. Please try again.");
    }
  };

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
    await commitTagSelection(requestSeq, nextIds);
  };

  const handleClearAll = async () => {
    const requestSeq = updateSeqRef.current + 1;

    updateSeqRef.current = requestSeq;
    setOptimisticSelectedTagIds([]);
    await commitTagSelection(requestSeq, []);
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
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    void handleTagToggle(tag.id, !isSelected);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-all",
                    isSelected
                      ? "border-emerald-500/25 bg-emerald-500/10"
                      : "border-transparent hover:border-white/10 hover:bg-white/[0.04]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <TagChip tag={tag} size="md" className="shrink-0" />
                      {isSelected && (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
                          Applied
                        </span>
                      )}
                    </div>
                  </div>
                </button>
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
  workspaceSlug,
  loading,
  onDelete,
  availableTags = [],
  onUpdateTags,
  emptyMessage = "No decks uploaded yet",
}: DecksTableProps) {
  const [deleteTarget, setDeleteTarget] =
    React.useState<DeckWithAnalytics | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [openDeckLinkPanelId, setOpenDeckLinkPanelId] = React.useState<string | null>(null);
  const [copyingPrimaryDeckId, setCopyingPrimaryDeckId] = React.useState<string | null>(null);
  const [copiedPrimaryDeckId, setCopiedPrimaryDeckId] = React.useState<string | null>(null);

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

  const handleCopyPrimaryLink = async (deck: DeckWithAnalytics) => {
    if (!workspaceSlug) {
      toast.error("Set your workspace slug before copying deck links.");
      return;
    }

    setCopyingPrimaryDeckId(deck.id);

    try {
      const links = await deckLinkService.listDeckLinks(deck.id, deck.user_id);
      const primaryLink = links.find((link) => link.is_primary && link.is_enabled);

      if (!primaryLink) {
        toast.error("Enable the default link before copying it.");
        return;
      }

      await navigator.clipboard.writeText(primaryLink.share_url);
      setCopiedPrimaryDeckId(deck.id);
      setTimeout(() => setCopiedPrimaryDeckId((currentId) => (currentId === deck.id ? null : currentId)), 2000);
    } catch (copyError) {
      console.error("Failed to copy primary deck link:", copyError);
      toast.error("Failed to copy link. Please try again.");
    } finally {
      setCopyingPrimaryDeckId(null);
    }
  };

  const renderLinkSummary = (
    deck: DeckWithAnalytics,
    options?: { showSummary?: boolean; showHelper?: boolean; showCopyButton?: boolean },
  ) => {
    const summary = getDeckLinkSummary(
      deck.total_link_count ?? 0,
      deck.active_link_count ?? 0,
    );
    const showSummary = options?.showSummary ?? true;
    const showHelper = options?.showHelper ?? true;
    const showCopyButton = options?.showCopyButton ?? true;
    const canQuickCopy = canCopyPrimaryDeckLink(deck) && Boolean(workspaceSlug);
    const isCopying = copyingPrimaryDeckId === deck.id;
    const isCopied = copiedPrimaryDeckId === deck.id;

    return (
      <div className="space-y-2">
        {showSummary && (
          <p
            className={cn(
              "text-[11px] mt-1",
              summary.isActive ? "text-deckly-primary" : "text-slate-500",
            )}
          >
            {summary.summary}
          </p>
        )}
        {showHelper && (
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-600">
            {summary.helper}
          </p>
        )}

        {showCopyButton && (
          <div>
            <button
              type="button"
              onClick={() => void handleCopyPrimaryLink(deck)}
              disabled={!canQuickCopy || isCopying}
              className={cn(
                "inline-flex items-center gap-2 rounded-none border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all",
                canQuickCopy
                  ? "border-deckly-primary/20 bg-deckly-primary/10 text-deckly-primary hover:bg-deckly-primary/15"
                  : "cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-500",
              )}
              data-testid={`copy-primary-link-${deck.id}`}
            >
              {isCopying ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
              {isCopied ? "Copied" : "Copy Link"}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderDesktopRow = (deck: DeckWithAnalytics) => {
    const isExpanded = openDeckLinkPanelId === deck.id;

    return (
      <React.Fragment key={deck.id}>
        <TableRow
          className={cn(
            "group hover:bg-surface-low border-border transition-colors",
            deleteTarget?.id === deck.id &&
              "opacity-50 pointer-events-none",
          )}
        >
          <TableCell className="px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOpenDeckLinkPanelId(isExpanded ? null : deck.id)}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-none border transition-all",
                  isExpanded
                    ? "border-deckly-primary/30 bg-deckly-primary/10 text-deckly-primary"
                    : "border-border bg-surface-lowest text-slate-400 hover:bg-surface-high hover:text-white",
                )}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} links for ${deck.title}`}
                data-testid={`manage-deck-links-${deck.id}`}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
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
            </div>
            {renderLinkSummary(deck, { showCopyButton: false })}
          </TableCell>
          <TableCell className="py-4">{renderAppliedTags(deck)}</TableCell>
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
            {renderLinkSummary(deck, { showSummary: false, showHelper: false, showCopyButton: true })}
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
                onClick={() => setDeleteTarget(deck)}
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
        {isExpanded && (
          <TableRow className="border-border bg-surface-low/40">
            <TableCell colSpan={8} className="px-6 py-0">
              <div className="py-3">
                <DeckLinksPanel
                  deck={deck}
                  workspaceSlug={workspaceSlug}
                  isOpen={isExpanded}
                />
              </div>
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    );
  };

  return (
    <DashboardCard className="mt-8 bg-surface-card border border-border rounded-lg">
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
          decks.map((deck) => {
            const isExpanded = openDeckLinkPanelId === deck.id;

            return (
              <div
                key={deck.id}
                className={cn(
                  "p-4 flex flex-col gap-4",
                  deleteTarget?.id === deck.id &&
                    "opacity-50 pointer-events-none",
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setOpenDeckLinkPanelId(isExpanded ? null : deck.id)}
                    className={cn(
                      "mt-0.5 flex h-10 w-10 items-center justify-center rounded-none border transition-all",
                      isExpanded
                        ? "border-deckly-primary/30 bg-deckly-primary/10 text-deckly-primary"
                        : "border-border bg-surface-lowest text-slate-400 hover:bg-surface-high hover:text-white",
                    )}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} links for ${deck.title}`}
                    data-testid={`manage-deck-links-${deck.id}`}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
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
                        ? ` · ${new Intl.DateTimeFormat("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                            .format(new Date(deck.last_viewed_at))
                            .replace(/\//g, "-")}`
                        : ""}
                    </p>
                    {renderLinkSummary(deck, { showCopyButton: false })}
                  </div>
                </div>

                {isExpanded && (
                  <DeckLinksPanel
                    deck={deck}
                    workspaceSlug={workspaceSlug}
                    isOpen={isExpanded}
                  />
                )}

                <div className="flex items-center gap-1.5 flex-wrap">
                  {renderTagMenu(deck)}
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
                    onClick={() => setDeleteTarget(deck)}
                    disabled={deleteTarget?.id === deck.id}
                    className="p-2.5 bg-surface-low border border-border text-slate-400 hover:bg-surface-high hover:text-white rounded-none transition-all disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

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
              decks.map((deck) => renderDesktopRow(deck))
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
                void handleConfirmDelete();
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
