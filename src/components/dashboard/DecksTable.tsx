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
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { TagAssignmentMenuContent } from "../shared/TagAssignmentMenuContent";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { normalizeSlug } from "../../utils/slug";
import { deckLinkService } from "../../services/deckLinkService";
import {
  useCreateDeckLink,
  useDeckLinks,
  useDeleteDeckLink,
  useDisableDeckLink,
  useEnableDeckLink,
} from "../../hooks/useDeckLinks";
import {
  canCopyPrimaryDeckLink,
  getDeckLinkSummary,
  getPrimaryDeckLink,
} from "./deckLinkUi";
import { formatLinkCreatedAt, splitShareUrl } from "./deckLinkFormatting";
import { productAnalytics } from "../../services/productAnalytics";

interface DecksTableProps {
  decks: DeckWithAnalytics[];
  workspaceSlug: string;
  loading?: boolean;
  onDelete?: (deck: DeckWithAnalytics) => Promise<void>;
  availableTags?: LibraryTag[];
  onUpdateTags?: (deckId: string, tagIds: string[]) => Promise<void> | void;
  emptyMessage?: string;
}

const CONTENT_ACTION_CLASS =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[4px] border border-ui-border bg-ui-surface text-ui-muted transition-colors hover:border-ui-primary/30 hover:bg-ui-subtle hover:text-ui-text active:scale-95";

const CONTENT_TAG_ACTION_CLASS =
  "border-ui-chart-3/25 bg-ui-chart-3/10 text-ui-chart-3 hover:border-ui-chart-3/40 hover:bg-ui-chart-3/15 hover:text-ui-chart-3";
const CONTENT_ANALYTICS_ACTION_CLASS =
  "border-ui-info/25 bg-ui-info/10 text-ui-info hover:border-ui-info/40 hover:bg-ui-info/15 hover:text-ui-info";
const CONTENT_EDIT_ACTION_CLASS =
  "border-ui-warning/25 bg-ui-warning/10 text-ui-warning hover:border-ui-warning/40 hover:bg-ui-warning/15 hover:text-ui-warning";
const CONTENT_DELETE_ACTION_CLASS =
  "border-ui-destructive/25 bg-ui-destructive/10 text-ui-destructive hover:border-ui-destructive/40 hover:bg-ui-destructive/15 hover:text-ui-destructive";

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
  const [copiedLinkId, setCopiedLinkId] = React.useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [draftLinkName, setDraftLinkName] = React.useState("");
  const [draftLinkAlias, setDraftLinkAlias] = React.useState("");
  const [createFormError, setCreateFormError] = React.useState<string | null>(
    null,
  );
  const [disableTarget, setDisableTarget] = React.useState<DeckLink | null>(
    null,
  );
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

  const handleCopyLink = async (link: DeckLink) => {
    if (!userCanManageLinks) {
      toast.error("Set your workspace slug before copying deck links.");
      return;
    }

    try {
      await navigator.clipboard.writeText(link.share_url);
      productAnalytics.capture("deck_link_copied", {
        workspace_id: deck.user_id,
        source_surface: "content_library",
        deck_id: deck.id,
        link_id: link.id,
        is_primary: link.is_primary,
      });
      setCopiedLinkId(link.id);
      setTimeout(() => {
        setCopiedLinkId((currentId) =>
          currentId === link.id ? null : currentId,
        );
      }, 2000);
    } catch (copyError) {
      console.error("Failed to copy deck link:", copyError);
      toast.error("Failed to copy link. Please try again.");
    }
  };

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
        className="overflow-hidden rounded-lg border border-ui-border bg-ui-surface text-ui-text shadow-[var(--ui-shadow-control)]"
        data-testid={`deck-link-panel-${deck.id}`}
      >
        <div className="border-b border-ui-border bg-ui-subtle px-4 py-2.5 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-ui-text">
              Link Control
            </p>

            <Button
              type="button"
              onClick={() => {
                setDraftLinkName(`Link ${links.length + 1}`);
                setDraftLinkAlias("");
                setCreateFormError(null);
                setCreateDialogOpen(true);
              }}
              disabled={createMutation.isPending || !userCanManageLinks}
              className="h-8 shrink-0 rounded-md bg-ui-primary px-3 text-ui-primary-text hover:bg-ui-primary/90"
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
          <div className="border-b border-ui-destructive/20 bg-ui-destructive/10 px-5 py-3 text-xs text-ui-destructive">
            Set your workspace slug in profile settings before creating or
            copying deck links.
          </div>
        )}

        <div className="max-h-[420px] overflow-y-auto p-2.5 custom-scrollbar sm:p-3">
          {error ? (
            <div className="rounded-lg border border-ui-destructive/20 bg-ui-destructive/10 px-4 py-4 text-sm text-ui-destructive">
              {error instanceof Error
                ? error.message
                : "Failed to load deck links."}
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-lg border border-ui-border bg-ui-subtle"
                />
              ))}
            </div>
          ) : links.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-ui-border bg-ui-subtle px-5 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-ui-primary/20 bg-ui-primary/10 text-ui-primary">
                <Link2 size={18} />
              </div>
              <h4 className="mt-3 text-base font-semibold text-ui-text">
                No links yet
              </h4>
              <p className="mt-1.5 max-w-sm text-xs text-ui-muted">
                Create a private link first, then enable it when you are ready
                to share.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {links.map((link) => {
                const isPrimary = primaryLink?.id === link.id;
                const isCopied = copiedLinkId === link.id;
                const isPending =
                  (enableMutation.isPending &&
                    enableMutation.variables === link.id) ||
                  (disableMutation.isPending &&
                    disableMutation.variables === link.id) ||
                  (deleteMutation.isPending &&
                    deleteMutation.variables === link.id);
                const { origin, pathWithQuery } = splitShareUrl(link.share_url);

                return (
                  <div
                    key={link.id}
                    className="rounded-md border border-ui-border bg-ui-elevated p-3"
                  >
                    <div className="grid gap-3 xl:grid-cols-[minmax(180px,0.7fr)_minmax(280px,1.35fr)_auto] xl:items-center">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ui-text">
                          {link.link_name ||
                            getLinkLabel(link, primaryLink?.id)}
                        </span>
                        {isPrimary && (
                          <span className="shrink-0 rounded-md border border-ui-primary/30 bg-ui-primary/10 px-2 py-0.5 text-[10px] font-semibold text-ui-text">
                            Primary
                          </span>
                        )}
                        <span
                          className={cn(
                            "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                            link.is_enabled
                              ? "border-ui-primary/30 bg-ui-primary/10 text-ui-text"
                              : "border-ui-border bg-ui-subtle text-ui-muted",
                          )}
                        >
                          {link.is_enabled ? "Active" : "Private"}
                        </span>
                      </div>

                      <div className="flex min-w-0 items-center overflow-hidden rounded-md border border-ui-border bg-ui-surface">
                        <span className="hidden shrink-0 border-r border-ui-border px-3 py-2 font-mono text-[11px] text-ui-muted sm:block">
                          {origin}
                        </span>
                        <span className="min-w-0 flex-1 truncate px-3 py-2 font-mono text-[11px] text-ui-text">
                          <span className="sm:hidden">{origin}</span>
                          {pathWithQuery}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-end">
                        <span className="text-[10px] text-ui-muted xl:whitespace-nowrap">
                          Created {formatLinkCreatedAt(link.created_at)}
                        </span>

                        <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[auto_auto_auto_auto] sm:justify-start xl:justify-end">
                          <Button
                            type="button"
                            onClick={() => void handleCopyLink(link)}
                            disabled={!link.is_enabled || !userCanManageLinks}
                            className={cn(
                              "h-9 rounded-md border border-ui-primary bg-ui-primary px-3 text-ui-primary-text hover:bg-ui-primary/90",
                              isCopied &&
                                "border-ui-primary bg-ui-primary/90",
                              (!link.is_enabled || !userCanManageLinks) &&
                                "cursor-not-allowed border-ui-border bg-ui-subtle text-ui-muted hover:bg-ui-subtle",
                            )}
                            data-testid={`copy-deck-link-${link.id}`}
                          >
                            <Copy size={14} />
                            {isCopied ? "Copied" : "Copy"}
                          </Button>

                          <a
                            href={link.share_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-ui-border bg-ui-surface text-ui-muted transition-colors hover:bg-ui-subtle hover:text-ui-text"
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
                              "h-9 rounded-md border px-3",
                              link.is_enabled
                                ? "border-ui-destructive/30 bg-ui-destructive text-ui-surface hover:opacity-90"
                                : "border-ui-border bg-ui-surface text-ui-text hover:bg-ui-subtle",
                              (isPending || !userCanManageLinks) &&
                                "cursor-not-allowed opacity-60",
                            )}
                            data-testid={`${link.is_enabled ? "disable" : "enable"}-deck-link-${link.id}`}
                          >
                            {isPending &&
                            ((enableMutation.isPending &&
                              enableMutation.variables === link.id) ||
                              (disableMutation.isPending &&
                                disableMutation.variables === link.id)) ? (
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
                              "h-9 rounded-md border border-ui-border bg-ui-surface px-3 text-ui-muted hover:bg-ui-subtle hover:text-ui-text",
                              (isPending || !userCanManageLinks) &&
                                "cursor-not-allowed opacity-60",
                            )}
                            data-testid={`delete-deck-link-${link.id}`}
                          >
                            {deleteMutation.isPending &&
                            deleteMutation.variables === link.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={!!disableTarget}
        onOpenChange={(open) => !open && setDisableTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Default Link</AlertDialogTitle>
            <AlertDialogDescription>
              Disabling the default link will immediately block new bare-route
              access for this deck.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-ui-destructive text-ui-surface hover:opacity-90"
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
              Set a saved link name and custom alias for this deck link. The
              generated share URL will keep the secure link token attached
              automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ui-text">
                Link Name
              </label>
              <input
                value={draftLinkName}
                onChange={(event) =>
                  setDraftLinkName(event.currentTarget.value)
                }
                placeholder="Investor Follow-up"
                className="w-full rounded-md border border-ui-border bg-ui-surface px-3 py-2.5 text-sm text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-ui-text">
                Custom Link
              </label>
              <div className="flex min-w-0 items-center overflow-hidden rounded-md border border-ui-border bg-ui-surface focus-within:border-ui-primary focus-within:ring-2 focus-within:ring-ui-primary/15">
                <span className="shrink-0 border-r border-ui-border px-3 py-2.5 text-xs text-ui-muted">
                  {workspaceSlug ? `/${workspaceSlug}/` : "/your-workspace/"}
                </span>
                <input
                  value={draftLinkAlias}
                  onChange={(event) =>
                    setDraftLinkAlias(event.currentTarget.value)
                  }
                  placeholder="custom-room-link"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-ui-text outline-none"
                />
              </div>
              <p className="text-xs text-ui-muted">
                Saved as{" "}
                <span className="font-mono text-ui-text">
                  {normalizeSlug(draftLinkAlias) || "custom-room-link"}
                </span>
              </p>
            </div>

            {createFormError && (
              <div className="rounded-lg border border-ui-destructive/20 bg-ui-destructive/10 px-3 py-2 text-sm text-ui-destructive">
                {createFormError}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-ui-primary text-ui-primary-text hover:bg-ui-primary/90"
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

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
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
              className="bg-ui-destructive text-ui-surface hover:opacity-90"
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
          className={cn(CONTENT_ACTION_CLASS, CONTENT_TAG_ACTION_CLASS)}
          title={
            selectedTagIds.length > 0
              ? `${selectedTagIds.length} tag(s) applied`
              : "Manage tags"
          }
        >
          <Tag size={14} />
        </button>
      </DropdownMenuTrigger>
      <TagAssignmentMenuContent
        itemLabel={deck.title}
        tags={availableTags}
        selectedTagIds={selectedTagIds}
        query={tagFilterQuery}
        onQueryChange={setTagFilterQuery}
        onClear={() => {
          void handleClearAll();
        }}
        onToggle={(tagId, selected) => {
          void handleTagToggle(tagId, selected);
        }}
      />
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
  const [openDeckLinkPanelId, setOpenDeckLinkPanelId] = React.useState<
    string | null
  >(null);
  const [copyingPrimaryDeckId, setCopyingPrimaryDeckId] = React.useState<
    string | null
  >(null);
  const [copiedPrimaryDeckId, setCopiedPrimaryDeckId] = React.useState<
    string | null
  >(null);

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
          <span className="text-[10px] font-semibold text-ui-muted">
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
      const primaryLink = links.find(
        (link) => link.is_primary && link.is_enabled,
      );

      if (!primaryLink) {
        toast.error("Enable the default link before copying it.");
        return;
      }

      await navigator.clipboard.writeText(primaryLink.share_url);
      productAnalytics.capture("deck_link_copied", {
        workspace_id: deck.user_id,
        source_surface: "content_library",
        deck_id: deck.id,
        link_id: primaryLink.id,
        is_primary: true,
      });
      setCopiedPrimaryDeckId(deck.id);
      setTimeout(
        () =>
          setCopiedPrimaryDeckId((currentId) =>
            currentId === deck.id ? null : currentId,
          ),
        2000,
      );
    } catch (copyError) {
      console.error("Failed to copy primary deck link:", copyError);
      toast.error("Failed to copy link. Please try again.");
    } finally {
      setCopyingPrimaryDeckId(null);
    }
  };

  const renderLinkSummary = (
    deck: DeckWithAnalytics,
    options?: {
      showSummary?: boolean;
      showHelper?: boolean;
      showCopyButton?: boolean;
    },
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
              summary.isActive ? "text-ui-primary" : "text-ui-muted",
            )}
          >
            {summary.summary}
          </p>
        )}
        {showHelper && (
          <p className="mt-1 text-[10px] text-ui-muted">
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
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[10px] font-semibold transition-colors",
                canQuickCopy
                  ? "border-ui-primary/20 bg-ui-primary/10 text-ui-primary hover:bg-ui-primary/15"
                  : "cursor-not-allowed border-ui-border bg-ui-subtle text-ui-muted",
              )}
              data-testid={`copy-primary-link-${deck.id}`}
            >
              {isCopying ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Copy size={12} />
              )}
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
            "group border-ui-border transition-colors hover:bg-ui-subtle",
            isExpanded && "bg-ui-subtle/70",
            deleteTarget?.id === deck.id && "opacity-50 pointer-events-none",
          )}
        >
          <TableCell className="px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setOpenDeckLinkPanelId(isExpanded ? null : deck.id)
                }
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-md border transition-colors",
                  isExpanded
                    ? "border-ui-primary/30 bg-ui-primary/10 text-ui-primary"
                    : "border-ui-border bg-ui-surface text-ui-muted hover:bg-ui-subtle hover:text-ui-text",
                )}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} links for ${deck.title}`}
                data-testid={`manage-deck-links-${deck.id}`}
              >
                {isExpanded ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>
              <Link
                to={getDeckPreviewPath(deck.id)}
                target="_blank"
                className="flex items-center gap-3 transition-all group/title"
              >
                <div className="rounded-md border border-ui-border bg-ui-subtle p-2 text-ui-muted transition-colors group-hover:text-ui-primary">
                  <FileText size={16} />
                </div>
                <span className="block truncate font-medium text-ui-text transition-colors group-hover/title:text-ui-primary">
                  {deck.title}
                </span>
              </Link>
            </div>
            {renderLinkSummary(deck, { showCopyButton: false })}
          </TableCell>
          <TableCell className="py-4">{renderAppliedTags(deck)}</TableCell>
          <TableCell className="py-4 text-xs text-ui-muted">
            {new Intl.DateTimeFormat("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
              .format(new Date(deck.created_at))
              .replace(/\//g, "-")}
          </TableCell>
          <TableCell className="py-4 text-center">
            {renderLinkSummary(deck, {
              showSummary: false,
              showHelper: false,
              showCopyButton: true,
            })}
          </TableCell>
          <TableCell className="py-4 text-center text-sm text-ui-text">
            {deck.total_views}
          </TableCell>
          <TableCell className="py-4 text-center text-sm text-ui-text">
            {deck.save_count}
          </TableCell>
          <TableCell className="whitespace-nowrap py-4 text-center text-xs text-ui-muted">
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
          <TableCell className="px-4 py-4 text-right">
            <div className="flex min-w-[168px] shrink-0 items-center justify-end gap-2">
              {renderTagMenu(deck)}
              <Link
                to={`/analytics/${deck.id}`}
                data-tour="analytics-btn"
                className={cn(
                  CONTENT_ACTION_CLASS,
                  CONTENT_ANALYTICS_ACTION_CLASS,
                )}
                title="View Detailed Analytics"
              >
                <BarChart3 size={16} />
              </Link>
              <Link
                to={`/edit/${deck.id}`}
                data-tour="edit-btn"
                className={cn(CONTENT_ACTION_CLASS, CONTENT_EDIT_ACTION_CLASS)}
                title="Edit Deck"
              >
                <Pencil size={16} />
              </Link>
              <button
                onClick={() => setDeleteTarget(deck)}
                data-tour="delete-btn"
                disabled={deleteTarget?.id === deck.id}
                className={cn(
                  CONTENT_ACTION_CLASS,
                  CONTENT_DELETE_ACTION_CLASS,
                  "disabled:opacity-50",
                )}
                title="Delete Deck"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </TableCell>
        </TableRow>
        {isExpanded && (
          <TableRow className="border-ui-border bg-ui-subtle/45 hover:bg-ui-subtle/45">
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
    <DashboardCard className="mt-2 overflow-hidden border-ui-border bg-ui-surface">
      <div className="divide-y divide-ui-border xl:hidden">
        {loading ? (
          Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="space-y-3 p-4">
                <div className="h-4 w-40 animate-pulse rounded-md bg-ui-subtle" />
                <div className="h-3 w-24 animate-pulse rounded-md bg-ui-subtle" />
              </div>
            ))
        ) : decks.length === 0 ? (
              <p className="p-8 text-center text-sm text-ui-muted">
            {emptyMessage}
          </p>
        ) : (
          decks.map((deck) => {
            const isExpanded = openDeckLinkPanelId === deck.id;

            return (
              <article
                key={deck.id}
                className={cn(
                  "flex flex-col gap-4 p-4 sm:p-5",
                  isExpanded && "bg-ui-subtle/45",
                  deleteTarget?.id === deck.id &&
                    "opacity-50 pointer-events-none",
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDeckLinkPanelId(isExpanded ? null : deck.id)
                    }
                    className={cn(
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isExpanded
                        ? "border-ui-primary/30 bg-ui-primary/10 text-ui-primary"
                        : "border-ui-border bg-ui-surface text-ui-muted hover:bg-ui-subtle hover:text-ui-text",
                    )}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} links for ${deck.title}`}
                    data-testid={`manage-deck-links-${deck.id}`}
                  >
                    {isExpanded ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>
                  <div className="shrink-0 rounded-md border border-ui-border bg-ui-subtle p-2.5 text-ui-muted">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={getDeckPreviewPath(deck.id)}
                      target="_blank"
                      className="block truncate text-sm font-semibold text-ui-text transition-colors hover:text-ui-primary"
                    >
                      {deck.title}
                    </Link>
                    {renderAppliedTags(deck)}
                    <p className="mt-2 text-xs leading-tight text-ui-muted">
                      Uploaded {new Intl.DateTimeFormat("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(deck.created_at))}
                      {" · "}{deck.total_views} views · {deck.save_count} saves
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

                <div className="flex flex-wrap items-center gap-2 border-t border-ui-border pt-3">
                  {renderTagMenu(deck)}
                  <button
                    type="button"
                    onClick={() => void handleCopyPrimaryLink(deck)}
                    disabled={!canCopyPrimaryDeckLink(deck) || !workspaceSlug}
                    className={cn(CONTENT_ACTION_CLASS, "w-auto gap-2 px-3 text-xs disabled:opacity-50")}
                  >
                    <Copy size={14} />
                    Copy link
                  </button>
                  <Link
                    to={`/analytics/${deck.id}`}
                    className={cn(
                      CONTENT_ACTION_CLASS,
                      CONTENT_ANALYTICS_ACTION_CLASS,
                    )}
                    aria-label={`View analytics for ${deck.title}`}
                  >
                    <BarChart3 size={16} />
                  </Link>
                  <Link
                    to={`/edit/${deck.id}`}
                    className={cn(
                      CONTENT_ACTION_CLASS,
                      CONTENT_EDIT_ACTION_CLASS,
                    )}
                    aria-label={`Edit ${deck.title}`}
                  >
                    <Pencil size={16} />
                  </Link>
                  <button
                    onClick={() => setDeleteTarget(deck)}
                    disabled={deleteTarget?.id === deck.id}
                    className={cn(
                      CONTENT_ACTION_CLASS,
                      CONTENT_DELETE_ACTION_CLASS,
                      "disabled:opacity-50",
                    )}
                    aria-label={`Delete ${deck.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="hidden overflow-x-auto xl:block">
        <Table className="min-w-[1120px] table-fixed">
          <TableHeader>
            <TableRow className="border-ui-border hover:bg-transparent">
              <TableHead className="w-[30%] px-6 py-4 text-xs font-semibold capitalize text-ui-muted">
                Name
              </TableHead>
              <TableHead className="w-[8%] py-4 text-xs font-semibold capitalize text-ui-muted">
                Tags
              </TableHead>
              <TableHead className="w-[112px] py-4 text-xs font-semibold capitalize text-ui-muted">
                Upload Date
              </TableHead>
              <TableHead className="w-[128px] py-4 text-center text-xs font-semibold capitalize text-ui-muted">
                Link
              </TableHead>
              <TableHead className="w-[64px] py-4 text-center text-xs font-semibold capitalize text-ui-muted">
                Views
              </TableHead>
              <TableHead className="w-[64px] py-4 text-center text-xs font-semibold capitalize text-ui-muted">
                Saves
              </TableHead>
              <TableHead className="w-[116px] py-4 text-center text-xs font-semibold capitalize text-ui-muted">
                Last Viewed
              </TableHead>
              <TableHead className="w-[192px] px-4 py-4 text-right text-xs font-semibold capitalize text-ui-muted">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(3)
                .fill(0)
                .map((_, i) => (
                  <TableRow key={i} className="border-ui-border">
                    <TableCell className="px-6 py-4">
                      <div className="h-4 w-40 animate-pulse rounded-md bg-ui-subtle" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="h-4 w-28 animate-pulse rounded-md bg-ui-subtle" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="h-4 w-24 animate-pulse rounded-md bg-ui-subtle" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="mx-auto h-8 w-24 animate-pulse rounded-md bg-ui-subtle" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="mx-auto h-4 w-8 animate-pulse rounded-md bg-ui-subtle" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="mx-auto h-4 w-8 animate-pulse rounded-md bg-ui-subtle" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="mx-auto h-4 w-24 animate-pulse rounded-md bg-ui-subtle" />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="ml-auto h-8 w-20 animate-pulse rounded-md bg-ui-subtle" />
                    </TableCell>
                  </TableRow>
                ))
            ) : decks.length === 0 ? (
              <TableRow className="border-transparent">
                <TableCell
                  colSpan={8}
                  className="p-20 text-center text-sm text-ui-muted"
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
              className="bg-ui-destructive text-ui-surface hover:opacity-90"
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
