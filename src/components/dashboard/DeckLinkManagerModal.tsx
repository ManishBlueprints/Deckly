import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Link2, Loader2, Plus, Power, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Deck, DeckLink } from "../../types";
import {
  useCreateDeckLink,
  useDeckLinks,
  useDisableDeckLink,
  useEnableDeckLink,
} from "../../hooks/useDeckLinks";
import { cn } from "../../lib/utils";
import { normalizeSlug } from "../../utils/slug";
import { getPrimaryDeckLink } from "./deckLinkUi";
import { formatLinkCreatedAt, splitShareUrl } from "./deckLinkFormatting";
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
import { Button } from "../ui/button";
import { productAnalytics } from "../../services/productAnalytics";

interface DeckLinkManagerModalProps {
  deck: Deck | null;
  workspaceSlug?: string | null;
  isOpen: boolean;
  initialIntent?: "manage" | "create";
  onClose: () => void;
}

function buildShareUrl(origin: string, pathWithQuery: string): string {
  const normalizedPath = pathWithQuery.startsWith("/")
    ? pathWithQuery
    : `/${pathWithQuery}`;

  const fallbackOrigin =
    origin || (typeof window !== "undefined" ? window.location.origin : "");

  if (!fallbackOrigin) {
    return normalizedPath;
  }

  try {
    return new URL(normalizedPath, fallbackOrigin).toString();
  } catch (err) {
    console.warn("Failed to build share URL; falling back to path.", {
      origin,
      normalizedPath,
      err,
    });
    return normalizedPath;
  }
}

function generateNextLinkAlias(deckSlug: string, links: DeckLink[]): string {
  const baseAlias = normalizeSlug(deckSlug) || "deck-link";
  const existingAliases = new Set(
    links.map((link) => link.link_alias).filter((alias): alias is string => Boolean(alias)),
  );

  let index = links.length + 1;
  let nextAlias = `${baseAlias}-link${index}`;

  while (existingAliases.has(nextAlias)) {
    index += 1;
    nextAlias = `${baseAlias}-link${index}`;
  }

  return nextAlias;
}

export function DeckLinkManagerModal({
  deck,
  workspaceSlug,
  isOpen,
  initialIntent = "manage",
  onClose,
}: DeckLinkManagerModalProps) {
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [disableTarget, setDisableTarget] = useState<DeckLink | null>(null);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const [createIntentHandled, setCreateIntentHandled] = useState(false);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const deckId = deck?.id;
  const userCanCopyLinks = Boolean(workspaceSlug);

  const {
    data: links = [],
    isLoading,
    error,
  } = useDeckLinks(deckId, deck?.user_id);
  const createMutation = useCreateDeckLink(deckId, deck?.user_id);
  const enableMutation = useEnableDeckLink(deckId, deck?.user_id);
  const disableMutation = useDisableDeckLink(deckId, deck?.user_id);

  const primaryLink = useMemo(() => getPrimaryDeckLink(links), [links]);

  useEffect(() => {
    setLinkDrafts((currentDrafts) => {
      const nextDrafts: Record<string, string> = {};
      let hasChanged = false;

      for (const link of links) {
        const nextDraftPath =
          currentDrafts[link.id] ?? splitShareUrl(link.share_url).pathWithQuery;
        nextDrafts[link.id] = nextDraftPath;

        if (currentDrafts[link.id] !== nextDraftPath) {
          hasChanged = true;
        }
      }

      if (Object.keys(currentDrafts).length !== Object.keys(nextDrafts).length) {
        hasChanged = true;
      }

      return hasChanged ? nextDrafts : currentDrafts;
    });
  }, [links]);

  const handleCopyLink = async (link: DeckLink) => {
    if (!userCanCopyLinks) {
      toast.error("Set your workspace slug before copying deck links.");
      return;
    }

    try {
      const { origin, pathWithQuery } = splitShareUrl(link.share_url);
      const draftPath = linkDrafts[link.id] ?? pathWithQuery;
      await navigator.clipboard.writeText(buildShareUrl(origin, draftPath));
      productAnalytics.capture("deck_link_copied", {
        workspace_id: deck?.user_id,
        source_surface: "content_library",
        deck_id: link.deck_id,
        link_id: link.id,
        is_primary: link.is_primary,
      });
      setCopiedLinkId(link.id);
      setTimeout(
        () => setCopiedLinkId((currentLinkId) => (currentLinkId === link.id ? null : currentLinkId)),
        2000,
      );
    } catch (copyError) {
      console.error("Failed to copy deck link:", copyError);
      toast.error("Failed to copy link. Please try again.");
    }
  };

  const handleCreateLink = useCallback(async () => {
    if (!deck) {
      return;
    }

    try {
      await createMutation.mutateAsync({
        linkAlias: generateNextLinkAlias(deck.slug, links),
      });
    } catch (createError) {
      console.error("Failed to create deck link:", createError);
      toast.error(
        createError instanceof Error
          ? createError.message
          : "Failed to create link. Please try again.",
      );
    }
  }, [createMutation, deck, links]);

  useEffect(() => {
    if (!isOpen) {
      setCreateIntentHandled(false);
      return;
    }

    if (
      initialIntent === "create" &&
      !createIntentHandled &&
      !createMutation.isPending &&
      !isLoading
    ) {
      setCreateIntentHandled(true);
      if (userCanCopyLinks) {
        void handleCreateLink();
      }
    }
  }, [
    createIntentHandled,
    createMutation.isPending,
    initialIntent,
    isLoading,
    isOpen,
    handleCreateLink,
    userCanCopyLinks,
  ]);

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

  const requestDisableLink = (link: DeckLink) => {
    if (link.is_primary) {
      setDisableTarget(link);
      setDisableConfirmOpen(true);
      return;
    }

    void handleDisableLink(link.id);
  };

  const handleDisableLink = async (linkId: string) => {
    try {
      await disableMutation.mutateAsync(linkId);
      setDisableConfirmOpen(false);
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

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  };

  if (!deck) {
    return null;
  }

  return (
    <>
      <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
        <AlertDialogContent
          className="max-w-3xl border-white/10 bg-[#101010] text-white"
          data-testid="deck-link-manager-modal"
        >
          <AlertDialogHeader>
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-deckly-primary/20 bg-deckly-primary/10 text-deckly-primary">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <AlertDialogTitle className="text-left text-2xl font-bold text-white">
                    Manage Deck Links
                  </AlertDialogTitle>
                  <AlertDialogDescription className="mt-2 text-left text-slate-400">
                    Create private links, enable the ones you want live, and copy active links.
                  </AlertDialogDescription>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {deck.title}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void handleCreateLink()}
                  disabled={createMutation.isPending || !userCanCopyLinks}
                  className="bg-deckly-primary text-slate-950 hover:bg-deckly-primary/90"
                  data-testid="create-deck-link"
                  title={
                    userCanCopyLinks
                      ? "Create Link"
                      : "Set your workspace slug before creating deck links"
                  }
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Link
                    </>
                  )}
                </Button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close manage deck links modal"
                  className="flex h-11 w-11 items-center justify-center rounded-none border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </AlertDialogHeader>

          {!userCanCopyLinks && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              Set your workspace slug in profile settings before creating or copying deck links.
            </div>
          )}

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-200">
              {error instanceof Error ? error.message : "Failed to load deck links."}
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
                />
              ))}
            </div>
          ) : links.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[28px] border border-white/5 bg-white/[0.03] px-8 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-deckly-primary/10 text-deckly-primary">
                <Link2 size={26} />
              </div>
              <h3 className="mt-5 text-xl font-bold text-white">No links yet</h3>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                Create your first private link, then enable it when you are ready to share.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map((link) => {
                const isPending =
                  (enableMutation.isPending && enableMutation.variables === link.id) ||
                  (disableMutation.isPending && disableMutation.variables === link.id);
                const isCopied = copiedLinkId === link.id;
                const isPrimary = primaryLink?.id === link.id;
                const { origin, pathWithQuery } = splitShareUrl(link.share_url);
                const draftPath = linkDrafts[link.id] ?? pathWithQuery;
                const resolvedDraftUrl = buildShareUrl(origin, draftPath);

                return (
                  <div
                    key={link.id}
                    className="rounded-[24px] border border-white/5 bg-white/[0.03] p-5"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {isPrimary && (
                              <span className="rounded-full border border-deckly-primary/20 bg-deckly-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-deckly-primary">
                                Primary
                              </span>
                            )}
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                                link.is_enabled
                                  ? "border-deckly-primary/20 bg-deckly-primary/10 text-deckly-primary"
                                  : "border-white/10 bg-white/[0.03] text-slate-500",
                              )}
                            >
                              {link.is_enabled ? "Active" : "Private"}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>Created {formatLinkCreatedAt(link.created_at)}</span>
                            <span>•</span>
                            <span className="font-mono text-[11px] text-slate-400 break-all">
                              {link.public_token}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => void handleCopyLink(link)}
                            disabled={!link.is_enabled || !userCanCopyLinks}
                            className={cn(
                              "border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white",
                              isCopied && "border-deckly-primary/30 bg-deckly-primary/10 text-deckly-primary",
                            )}
                            data-testid={`copy-deck-link-${link.id}`}
                          >
                            <Copy size={14} />
                            {isCopied ? "Copied" : "Copy"}
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              link.is_enabled
                                ? requestDisableLink(link)
                                : void handleEnableLink(link.id)
                            }
                            disabled={isPending || !userCanCopyLinks}
                            className="border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                            data-testid={`${link.is_enabled ? "disable" : "enable"}-deck-link-${link.id}`}
                          >
                            {isPending ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Power size={14} />
                            )}
                            {link.is_enabled ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </div>

                      <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/5 bg-black/20 px-3 py-3">
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {origin}
                        </span>
                        <input
                          type="text"
                          value={draftPath}
                          onChange={(event) => {
                            const nextValue = event.currentTarget.value;
                            setLinkDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [link.id]: nextValue,
                            }));
                          }}
                          onFocus={(event) => event.currentTarget.select()}
                          className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none"
                          aria-label={`Share URL for ${deck.title}`}
                        />
                        <a
                          href={resolvedDraftUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                          aria-label={`Open link for ${deck.title}`}
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={disableConfirmOpen} onOpenChange={setDisableConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Primary Link</AlertDialogTitle>
            <AlertDialogDescription>
              Disabling the primary link will immediately block new bare-route access for this deck.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
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
    </>
  );
}
