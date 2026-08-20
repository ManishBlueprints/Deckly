import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Upload,
  Copy,
  Check,
  Plus,
  Link as LinkIcon,
  Image,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  EyeOff,
  Tags,
  FolderOpen,
} from "lucide-react";
import { useCheckDataRoomSlug } from "../hooks/useSlugValidation";
import { WorkspaceShell } from "../components/layout/WorkspaceShell";
import { DocumentPicker } from "../components/dashboard/DocumentPicker";
import { RoomDocumentList } from "../components/dashboard/RoomDocumentList";
import { AccessProtectionSection } from "../components/dashboard/form-sections/AccessProtectionSection";
import { DangerZoneSection } from "../components/dashboard/form-sections/DangerZoneSection";
import { DataRoomDocument } from "../types";
import { dataRoomService } from "../services/dataRoomService";
import { deckService } from "../services/deckService";
import { useDataRoomFolders } from "../hooks/useDataRoomFolders";
import { useAuth } from "../contexts/AuthContext";
import { DataRoomCreateTour } from "../components/tours/DataRoomCreateTour";
import { normalizeSlug } from "../utils/slug";
import { FolderColorKey } from "../constants/folderColors";
import { useQueryClient } from "@tanstack/react-query";
import { getDataRoomPreviewPath, getDataRoomShareUrl } from "../utils/url";
import { toast } from "sonner";
import { productAnalytics } from "../services/productAnalytics";
import * as Sentry from "@sentry/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { DataRoomFolderCard } from "../components/data-room/DataRoomFolderCard";
import { DataRoomFolderModal } from "../components/data-room/DataRoomFolderModal";
import { DataRoomTagsModal } from "../components/data-room/DataRoomTagsModal";
import { DataRoomFolderWithTags } from "../types";
import { useMyEntitlements, useTierFeatureAccess } from "../hooks/useTierEntitlements";
import { TierUpsellModal } from "../components/dashboard/TierUpsellModal";

function ManageDataRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const entitlements = useMyEntitlements(Boolean(profile), profile?.tier);
  const accessControls = useTierFeatureAccess(
    profile?.tier,
    "access_controls",
    Boolean(profile),
  );
  const isEditMode = !!roomId && roomId !== "new";
  const {
    folders,
    tags,
    isLoading: foldersLoading,
    actions: folderActions,
  } = useDataRoomFolders(isEditMode ? roomId : undefined);

  // Tier limit safety check for create mode
  useEffect(() => {
    if (isEditMode) return;

    let isMounted = true;
    const max = entitlements.data?.limits.maxDataRooms;
    if (max === undefined) return;

    if (max === -1) return;

    dataRoomService
      .getDataRooms()
      .then((rooms) => {
        if (isMounted && rooms.length >= max) {
          navigate("/rooms");
        }
      })
      .catch((err) => {
        console.error("Failed to check room limits", err);
      });

    return () => {
      isMounted = false;
    };
  }, [entitlements.data?.limits.maxDataRooms, isEditMode, navigate]);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState<string>("");
  const [iconPreview, setIconPreview] = useState<string>("");
  const [requireEmail, setRequireEmail] = useState(false);
  const [requirePassword, setRequirePassword] = useState(false);
  const [viewPassword, setViewPassword] = useState("");
  const [expiryEnabled, setExpiryEnabled] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<DataRoomDocument[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] =
    useState<DataRoomFolderWithTags | null>(null);
  const [deletingFolder, setDeletingFolder] =
    useState<DataRoomFolderWithTags | null>(null);
  const [isFolderDeletePending, setIsFolderDeletePending] = useState(false);

  // UI state
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAccessUpsell, setShowAccessUpsell] = useState(false);

  const { data: isSlugAvailable, isLoading: isCheckingSlug } =
    useCheckDataRoomSlug(slug, isEditMode ? roomId : undefined);

  // Load existing room data
  useEffect(() => {
    if (!isEditMode) return;

    async function load() {
      setLoading(true);
      try {
        const room = await dataRoomService.getDataRoomById(roomId!);
        if (!room) {
          navigate(isEditMode ? `/rooms/${roomId}` : "/rooms");
          return;
        }
        setName(room.name);
        setSlug(room.slug);
        setDescription(room.description || "");
        setIconUrl(room.icon_url || "");
        setIconPreview(room.icon_url || "");
        setRequireEmail(room.require_email || false);
        setRequirePassword(room.require_password || false);
        setViewPassword(room.view_password || "");
        setExpiryEnabled(!!room.expires_at);
        setExpiryDate(room.expires_at ? room.expires_at.split("T")[0] : "");
        setIsPublic(!!room.is_public);

        const docs = await dataRoomService.getDocuments(roomId!, {
          signThumbnails: true,
        });
        setDocuments(docs);
      } catch (err) {
        console.error("Failed to load room", err);
        toast.error("Failed to load data room");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [roomId, isEditMode, navigate]);

  const refreshDocuments = useCallback(async () => {
    if (!roomId) return;
    const docs = await dataRoomService.getDocuments(roomId, {
      signThumbnails: true,
    });
    setDocuments(docs);
  }, [roomId]);

  const folderDocumentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of documents) {
      if (!doc.folder_id) continue;
      counts.set(doc.folder_id, (counts.get(doc.folder_id) || 0) + 1);
    }
    return counts;
  }, [documents]);

  const folderLookup = useMemo(
    () =>
      new Map(
        folders.map((folder) => [
          folder.id,
          { id: folder.id, name: folder.name },
        ]),
      ),
    [folders],
  );

  // Auto-generate slug from name (only in create mode)
  useEffect(() => {
    if (!isEditMode && name) {
      setSlug(normalizeSlug(name));
    }
  }, [name, isEditMode]);

  // Icon upload handler
  const handleIconUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Preview
      const reader = new FileReader();
      reader.onload = () => setIconPreview(reader.result as string);
      reader.readAsDataURL(file);

      setUploadingIcon(true);
      try {
        const url = await dataRoomService.uploadRoomIcon(file);
        setIconUrl(url);
      } catch (err) {
        console.error("Failed to upload icon", err);
        toast.error("Failed to upload icon");
      } finally {
        setUploadingIcon(false);
      }
    },
    [],
  );

  // Add documents
  const handleAddDocuments = useCallback(
    async (deckIds: string[]) => {
      if (isEditMode) {
        try {
          await dataRoomService.addDocuments(roomId!, deckIds);
          queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
          const docs = await dataRoomService.getDocuments(roomId!, {
            signThumbnails: true,
          });
          setDocuments(docs);
        } catch (err) {
          console.error("Failed to add documents", err);
        }
      } else {
        // In create mode, keep the selected deck payload locally so the list can render titles/thumbnails.
        let availableDecks: Awaited<ReturnType<typeof deckService.getDecksByIds>> = [];
        try {
          availableDecks = await deckService.getDecksByIds(deckIds);
        } catch (err) {
          console.error(
            "Failed to hydrate create-mode documents via deckService.getDecksByIds",
            err,
          );
          toast.error("Failed to load full asset details. Documents were added without previews.");
          availableDecks = [];
        }
        const deckMap = new Map(availableDecks.map((deck) => [deck.id, deck]));
        const fakeDocs = deckIds.map((id, i) => ({
          id: `temp-${id}`,
          data_room_id: "",
          deck_id: id,
          folder_id: null,
          display_order: documents.length + i,
          added_at: new Date().toISOString(),
          deck: deckMap.get(id),
          tags: [],
        })) as DataRoomDocument[];
        setDocuments((prev) => [...prev, ...fakeDocs]);
      }
    },
    [isEditMode, roomId, documents.length, queryClient],
  );

  // Remove document
  const handleRemoveDocument = useCallback(
    async (deckId: string) => {
      if (isEditMode) {
        try {
          await dataRoomService.removeDocument(roomId!, deckId);
          queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
          setDocuments((prev) => prev.filter((d) => d.deck_id !== deckId));
        } catch (err) {
          console.error("Failed to remove document", err);
        }
      } else {
        setDocuments((prev) => prev.filter((d) => d.deck_id !== deckId));
      }
    },
    [isEditMode, roomId, queryClient],
  );

  // Reorder documents
  const handleReorder = useCallback(
    async (orderedDeckIds: string[]) => {
      // Reorder documents safely
      const reordered = orderedDeckIds
        .map((id, i) => {
          const doc = documents.find((d) => d.deck_id === id);
          return doc ? { ...doc, display_order: i } : null;
        })
        .filter((d): d is DataRoomDocument => d !== null);

      setDocuments(reordered);

      if (isEditMode) {
        try {
          await dataRoomService.reorderDocuments(roomId!, orderedDeckIds);
          queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
        } catch (err) {
          console.error("Failed to reorder", err);
        }
      }
    },
    [isEditMode, roomId, documents, queryClient],
  );

  const handleMoveDocumentToFolder = useCallback(
    async (deckId: string, folderId: string | null) => {
      if (!roomId) return;
      const previousDocuments = documents;
      const folderMeta = folderId ? folderLookup.get(folderId) : null;

      setDocuments((current) =>
        current.map((doc) =>
          doc.deck_id === deckId
            ? {
                ...doc,
                folder_id: folderId,
                folder_name: folderMeta?.name ?? null,
              }
            : doc,
        ),
      );

      try {
        await folderActions.moveDocumentToFolder(deckId, folderId);
        toast.success(folderId ? "Document moved." : "Document moved to Unorganized.");
      } catch (err) {
        console.error("Failed to move document to folder", err);
        setDocuments(previousDocuments);
        toast.error("Failed to move document");
      }
    },
    [documents, folderActions, folderLookup, roomId],
  );

  const handleSaveFolder = useCallback(
    async (input: { name: string; color: string; tagIds: string[] }) => {
      if (!roomId) return;
      if (editingFolder) {
        await folderActions.updateFolder(
          editingFolder.id,
          input.name,
          input.color,
          input.tagIds,
        );
      } else {
        await folderActions.createFolder(input.name, input.color, input.tagIds);
      }
      setEditingFolder(null);
      setFolderModalOpen(false);
    },
    [editingFolder, folderActions, roomId],
  );

  const handleDeleteFolder = useCallback(async () => {
    if (!deletingFolder) return;
    setIsFolderDeletePending(true);
    try {
      await folderActions.deleteFolder(deletingFolder.id);
      if (documents.some((doc) => doc.folder_id === deletingFolder.id)) {
        await refreshDocuments();
      }
      if (editingFolder?.id === deletingFolder.id) {
        setEditingFolder(null);
      }
      setDeletingFolder(null);
    } catch (err) {
      console.error("Failed to delete folder", err);
      toast.error("Failed to delete folder");
    } finally {
      setIsFolderDeletePending(false);
    }
  }, [deletingFolder, documents, editingFolder, folderActions, refreshDocuments]);

  const parsedExpiry = expiryEnabled && expiryDate ? expiryDate.split('-').map(Number) : null;
  const expiryInstant = parsedExpiry 
    ? new Date(Date.UTC(parsedExpiry[0], parsedExpiry[1] - 1, parsedExpiry[2], 23, 59, 59, 999)) 
    : null;
  const isExpired = expiryInstant ? expiryInstant.getTime() < Date.now() : false;

  // Save / Create
  const handleSave = async () => {
    // Basic validation
    if (!name.trim() || !slug.trim()) {
      toast.error("Room name and URL slug are required.");
      return;
    }

    if (isSlugAvailable === false) {
      toast.error("This URL slug is already taken. Please choose another.");
      return;
    }

    // Security validation
    if (requirePassword && !viewPassword.trim()) {
      toast.error("Security Key is required when 'Gate Access' is enabled.");
      return;
    }

    if (expiryEnabled && !expiryDate) {
      toast.error("Please select an expiration date.");
      return;
    }

    if (expiryEnabled && expiryDate && isExpired) {
      toast.error("Expiration date must be today or in the future.");
      return;
    }

    setSaving(true);

    try {
      const roomPayload = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        icon_url: iconUrl || undefined,
        require_email: requireEmail,
        require_password: requirePassword,
        view_password: requirePassword ? viewPassword : undefined,
        expires_at: expiryInstant ? expiryInstant.toISOString() : null,
      };

      if (isEditMode) {
        const updatedRoom = await dataRoomService.updateDataRoom(roomId!, roomPayload);
        setIsPublic(!!updatedRoom.is_public);
      } else {
        // Atomic creation with all settings
        const room = await dataRoomService.createDataRoom(roomPayload);
        setIsPublic(!!room.is_public);

        // Add documents after successful room initiation
        const deckIds = documents.map((d) => d.deck_id);
        if (deckIds.length > 0) {
          try {
            await dataRoomService.addDocuments(room.id, deckIds);
          } catch (docErr) {
            console.error("Room created but failed to add documents:", docErr);
            toast.warning(`Room created, but couldn't attach documents: ${docErr instanceof Error ? docErr.message : 'Unknown error'}. You can add them from the edit page.`);
          }
        }
      }

      // Invalidate queries to refresh dashboard/rooms
      queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
      queryClient.invalidateQueries({
          queryKey: ["user-total-stats", profile?.id],
      });
      
      navigate("/rooms");
    } catch (err: unknown) {
      console.error("Failed to save", err);
      Sentry.captureException(err);
      const e = err as { message?: string; code?: string };
      
      // Handle unique constraint violation for slug
      if (e?.code === '23505' || e?.message?.includes('unique constraint "data_rooms_user_id_slug_key"')) {
        toast.error("This URL slug is already taken. Please choose another.");
      } else {
        toast.error(e?.message || "Failed to save data room");
      }
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!isEditMode) return;
    setSaving(true);
    try {
      await dataRoomService.deleteDataRoom(roomId!);
      queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
      queryClient.invalidateQueries({
        queryKey: ["user-total-stats", profile?.id],
      });
      navigate("/rooms");
    } catch (err) {
      console.error("Failed to delete room", err);
      toast.error("Failed to delete data room");
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  // Copy link
  const handleCopyLink = async () => {
    if (!profile?.handle) {
      toast.error("Please set a handle in your profile settings before sharing.");
      return;
    }
    if (!roomId || !isEditMode) {
      toast.error("Save this data room before sharing it.");
      return;
    }

    setPublishing(true);
    try {
      await dataRoomService.publishDataRoom(roomId);
      setIsPublic(true);
      const url = getDataRoomShareUrl(profile.handle, slug);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Public link activated and copied.");
      productAnalytics.capture("data_room_link_copied", {
        workspace_id: profile.id,
        source_surface: "room_manager",
        room_id: roomId,
      });
    } catch (err) {
      console.error("Failed to publish data room", err);
      Sentry.captureException(err);
      toast.error("Failed to activate public link.");
    } finally {
      setPublishing(false);
    }
  };

  const handleMakePrivate = async () => {
    if (!roomId || !isEditMode) return;

    try {
      await dataRoomService.unpublishDataRoom(roomId);
      setIsPublic(false);
      toast.success("Public link disabled.");
    } catch (err) {
      console.error("Failed to disable data room link", err);
      toast.error("Failed to disable public link.");
    }
  };

  const shareUrl = profile?.handle
    ? getDataRoomShareUrl(profile.handle, slug)
    : "Set a handle in profile to enable sharing";

  if (loading) {
    return (
      <WorkspaceShell title="Data Rooms">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="text-deckly-primary animate-spin" />
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell title="Data Rooms">
      <DataRoomCreateTour isEditMode={isEditMode} />
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-24 pt-5 sm:px-6 sm:pt-6 md:space-y-6">
        {/* Back + Title */}
        <div className="relative z-10 flex items-center gap-3 border-b border-ui-border pb-5 sm:gap-4 sm:pb-6">
          <button
            onClick={() => navigate("/rooms")}
            className="flex size-10 flex-shrink-0 items-center justify-center rounded-md border border-ui-border bg-ui-surface text-ui-muted shadow-[var(--ui-shadow-control)] transition-colors hover:border-ui-primary/30 hover:bg-ui-subtle hover:text-ui-primary"
            title="Return to Rooms"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-ui-text md:text-xl">
              {isEditMode ? "Edit Data Room" : "Create Data Room"}
            </h1>
            <p className="mt-0.5 truncate text-xs text-ui-muted">
              {isEditMode ? "Data Room Configuration" : "Room Initiation"}  
            </p>
          </div>
        </div>

        {/* ──── Section 1: Room Identity ──── */}
        <div 
          data-tour="room-branding"
          className="relative overflow-hidden rounded-[10px] border border-ui-border bg-ui-surface shadow-[var(--ui-shadow-surface)]"
        >
          <div className="border-b border-ui-border bg-ui-subtle/60 px-4 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-ui-text">Room Branding</h2>
          </div>
          <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
            {/* Icon */}
            <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-4 sm:flex sm:gap-6">
              <div className="group relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-ui-border bg-ui-subtle">
                {iconPreview ? (
                  <>
                    <img
                      src={iconPreview}
                      alt="Room icon"
                      className="w-full h-full object-cover transition-all duration-300"
                    />
                    <button
                      onClick={() => {
                        setIconUrl("");
                        setIconPreview("");
                      }}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md backdrop-blur-sm"
                    >
                      <Trash2
                        size={18}
                        className="text-ui-primary-text transition-colors hover:text-ui-destructive"
                      />
                    </button>
                  </>
                ) : uploadingIcon ? (
                  <Loader2
                    size={20}
                    className="animate-spin text-ui-primary"
                  />
                ) : (
                  <Image
                    size={24}
                    className="text-ui-muted transition-colors duration-300 group-hover:text-ui-primary"
                  />
                )}
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-semibold text-ui-text">
                  Room Image
                </p>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <label
                    htmlFor="room-icon-upload"
                    className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-ui-border bg-ui-subtle px-3 text-sm font-medium text-ui-text transition-colors hover:border-ui-primary/30 hover:bg-ui-elevated sm:h-9 sm:w-auto sm:px-4"
                  >
                    <Upload size={14} className="mr-2 text-ui-primary" />
                    {iconPreview ? "Modify Image" : "Upload Image"}
                    <input
                      id="room-icon-upload"
                      name="room-icon-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleIconUpload}
                    />
                  </label>
                  <p className="text-[11px] leading-4 text-ui-muted sm:text-xs">
                    256×256 recommended · Max 1MB
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="room-display-name" className="text-xs font-semibold text-ui-text">
                Display Name <span className="text-ui-primary">*</span>
              </label>
              <input
                id="room-display-name"
                name="room-display-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Proposal: Alpha Series"
                className="h-11 w-full rounded-md border border-ui-border bg-ui-surface px-4 text-sm text-ui-text transition-colors placeholder:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-focus"
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <label htmlFor="room-internal-url" className="text-xs font-semibold text-ui-text">
                Internal URL <span className="text-ui-primary">*</span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <div className="relative flex h-11 min-w-0 flex-1 items-center overflow-hidden rounded-md border border-ui-border bg-ui-surface transition-colors focus-within:ring-2 focus-within:ring-ui-focus">
                  <span className="select-none whitespace-nowrap pl-3 pr-1 text-sm font-medium text-ui-primary">
                    /{profile?.handle}/room/
                  </span>
                  <input
                    id="room-internal-url"
                    name="room-internal-url"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                    placeholder="alpha-series"
                    className="h-full min-w-0 flex-1 bg-transparent pr-3 text-sm text-ui-text placeholder:text-ui-muted focus:outline-none"
                  />
                  {isCheckingSlug && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2
                        size={14}
                        className="animate-spin text-ui-muted"
                      />
                    </div>
                  )}
                </div>
                {slug && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() => void handleCopyLink()}
                      disabled={isExpired || publishing}
                      className="group relative flex size-11 shrink-0 items-center justify-center rounded-md border border-ui-border bg-ui-surface text-ui-muted transition-colors hover:border-ui-primary/30 hover:text-ui-primary disabled:cursor-not-allowed disabled:opacity-50"
                      title={isExpired ? "Link Expired" : "Copy share link"}
                    >
                      {copied ? (
                        <Check size={16} className="text-ui-primary" />
                      ) : (
                        <Copy size={16} />
                      )}
                      
                      {isExpired && (
                        <div className="absolute -top-1 whitespace-nowrap rounded bg-ui-destructive px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-tighter text-ui-primary-text">
                          Expired
                        </div>
                      )}
                    </button>

                    {isExpired && (
                      <button
                        onClick={() => {
                          const expiryEl = document.getElementById('security-section');
                          expiryEl?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="flex h-11 items-center gap-2 rounded-md border border-ui-destructive/25 bg-ui-destructive/10 px-4 text-xs font-bold text-ui-destructive transition-colors hover:bg-ui-destructive/15"
                      >
                        <Plus size={14} />
                        Reactivate Link
                      </button>
                    )}

                    {isEditMode && roomId && (
                      <button
                        onClick={() => window.open(getDataRoomPreviewPath(roomId), "_blank", "noopener,noreferrer")}
                        className="flex size-11 shrink-0 items-center justify-center rounded-md border border-ui-border bg-ui-surface text-ui-muted transition-colors hover:border-ui-primary/30 hover:text-ui-primary"
                        title="Open private preview"
                      >
                        <ExternalLink size={16} />
                      </button>
                    )}

                    {isEditMode && roomId && isPublic && (
                      <button
                        onClick={() => void handleMakePrivate()}
                        className="flex size-11 shrink-0 items-center justify-center rounded-md border border-ui-destructive/25 bg-ui-destructive/10 text-ui-destructive transition-colors hover:bg-ui-destructive/15"
                        title="Disable public link"
                      >
                        <EyeOff size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-ui-muted">
                {isPublic ? "Public link active" : "Private until you copy the link"}
              </p>
              <AnimatePresence>
                {!isEditMode &&
                  slug.length > 2 &&
                  isSlugAvailable === false &&
                  !isCheckingSlug && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex items-center gap-1.5 text-xs text-ui-destructive"
                    >
                      <AlertCircle size={14} />
                      This slug is already taken
                    </motion.p>
                  )}
                {!isEditMode &&
                  slug.length > 2 &&
                  isSlugAvailable === true &&
                  !isCheckingSlug && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-1.5 text-xs text-ui-primary"
                    >
                      <CheckCircle2 size={14} />
                      URL Available
                    </motion.p>
                  )}
              </AnimatePresence>
              {slug && (
                <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-ui-muted">
                  <LinkIcon size={12} className="shrink-0 text-ui-primary" />
                  <span className="truncate">{shareUrl}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="room-contextual-brief" className="text-xs font-semibold text-ui-text">
                Contextual Brief
              </label>
              <textarea
                id="room-contextual-brief"
                name="room-contextual-brief"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional room context..."
                rows={3}
                className="w-full resize-none rounded-md border border-ui-border bg-ui-surface px-4 py-3 text-sm text-ui-text transition-colors placeholder:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-focus"
              />
            </div>
          </div>
        </div>

        {/* ──── Section 2: Folders ──── */}
        {isEditMode && roomId && (
          <div className="bg-surface-card border border-white/5 rounded-lg overflow-hidden relative">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium text-white">
                  Folders & Tags
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Flat grouping only. Tags stay owner-only and do not appear in shared links.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTagModalOpen(true)}
                  className="flex items-center gap-2 h-8 px-3 bg-surface-container border border-white/10 hover:border-white/20 text-white rounded-md text-xs font-medium transition-all"
                >
                  <Tags size={14} />
                  Manage Tags
                </button>
                <button
                  onClick={() => {
                    setEditingFolder(null);
                    setFolderModalOpen(true);
                  }}
                  className="flex items-center gap-2 h-8 px-3 bg-deckly-primary text-slate-950 rounded-md text-xs font-semibold hover:bg-deckly-primary/90 transition-all"
                >
                  <FolderOpen size={14} />
                  New Folder
                </button>
              </div>
            </div>
            <div className="p-6">
              {foldersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="text-deckly-primary animate-spin" />
                </div>
              ) : folders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm text-slate-400 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-200">No folders yet</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Create a folder to organize documents and attach up to 4 tags.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingFolder(null);
                      setFolderModalOpen(true);
                    }}
                    className="h-10 px-4 rounded-md bg-deckly-primary text-slate-950 text-xs font-semibold hover:bg-deckly-primary/90 transition-colors"
                  >
                    New Folder
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DataRoomFolderCard
                    isNew
                    onClick={() => {
                      setEditingFolder(null);
                      setFolderModalOpen(true);
                    }}
                  />
                  {folders.map((folder) => (
                    <DataRoomFolderCard
                      key={folder.id}
                      folder={folder}
                      availableTags={tags}
                      onUpdateTags={async (next, tagIds) => {
                        await folderActions.updateFolder(
                          next.id,
                          next.name,
                          next.color,
                          tagIds,
                        );
                      }}
                      isActive={false}
                      documentCount={folderDocumentCounts.get(folder.id) || 0}
                      onEdit={(next) => {
                        setEditingFolder(next);
                        setFolderModalOpen(true);
                      }}
                      onDelete={(next) => setDeletingFolder(next)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──── Section 2: Documents ──── */}
        <div 
          data-tour="room-assets"
          className="relative overflow-hidden rounded-[10px] border border-ui-border bg-ui-surface shadow-[var(--ui-shadow-surface)]"
        >
          <div className="flex items-center justify-between border-b border-ui-border bg-ui-subtle/60 px-4 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-ui-text">Documents</h2>
            {documents.length > 0 && (
              <button
                onClick={() => setPickerOpen(true)}
                className="flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-surface px-3 text-xs font-medium text-ui-text transition-colors hover:border-ui-primary/30 hover:text-ui-primary"
              >
                <Plus size={14} />
                Add Assets
              </button>
            )}
          </div>
          <div className="p-4">
            {documents.length === 0 ? (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="group flex w-full cursor-pointer flex-col items-center gap-3 rounded-md border border-dashed border-ui-border bg-ui-subtle p-6 text-center transition-colors hover:border-ui-primary/40 hover:bg-ui-elevated focus-visible:ring-2 focus-visible:ring-ui-focus sm:gap-4 sm:p-8"
              >
                <div className="flex size-12 items-center justify-center rounded-md border border-ui-border bg-ui-surface transition-colors group-hover:border-ui-primary/30">
                  <Plus
                    size={24}
                    className="text-ui-muted transition-colors group-hover:text-ui-primary"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-ui-text">
                    Add documents to your room
                  </p>
                  <p className="text-xs text-ui-muted">
                    Existing assets will be bundled into a secure link
                  </p>
                </div>
                <span className="mt-1 inline-flex h-10 items-center rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-primary-text shadow-[var(--ui-shadow-control)] sm:mt-2">
                  Add Assets
                </span>
              </button>
            ) : (
                      <RoomDocumentList
                documents={documents}
                onRemove={handleRemoveDocument}
                onReorder={handleReorder}
                folderOptions={folders.map((folder) => ({
                  id: folder.id,
                  name: folder.name,
                }))}
                onMoveToFolder={handleMoveDocumentToFolder}
                availableTags={isEditMode ? tags : []}
                onUpdateDocumentTags={
                  isEditMode
                    ? (documentId, tagIds) => {
                        if (!roomId) return;

                        void (async () => {
                          try {
                            await folderActions.setDocumentTags(documentId, tagIds);
                        } catch (err) {
                          console.error("Failed to update document tags", err);
                          toast.error("Failed to update document tags");
                        } finally {
                          try {
                            await refreshDocuments();
                          } catch (err) {
                            console.error("Failed to refresh documents", err);
                          }
                        }
                      })();
                    }
                    : undefined
                }
              />
            )}
          </div>
        </div>

        {/* ──── Section 3: Access Controls ──── */}
        <div 
          id="security-section"
          data-tour="room-security"
          className="relative overflow-hidden rounded-[10px] border border-ui-border bg-ui-surface shadow-[var(--ui-shadow-surface)]"
        >
          <div className="border-b border-ui-border bg-ui-subtle/70 px-4 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-ui-text">
              Security & Access
            </h2>
          </div>
          <div className="p-4 sm:p-6">
            <AccessProtectionSection
              requireEmail={requireEmail}
              setRequireEmail={setRequireEmail}
              requirePassword={requirePassword}
              setRequirePassword={setRequirePassword}
              viewPassword={viewPassword}
              setViewPassword={setViewPassword}
              expiryEnabled={expiryEnabled}
              setExpiryEnabled={setExpiryEnabled}
              expiryDate={expiryDate}
              setExpiryDate={setExpiryDate}
              canUseAccessControls={accessControls.isLoading || accessControls.access.state === "available"}
              onAccessUpsell={() => setShowAccessUpsell(true)}
              showHeading={false}
            />
          </div>
        </div>

        {/* ──── Section 4: Danger Zone (edit only) ──── */}
        {isEditMode && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg overflow-hidden relative">
            <div className="px-6 py-4 border-b border-red-900/30">
              <h2 className="text-sm font-medium text-red-500">Danger Zone</h2>
            </div>
            <div className="p-6">
              <DangerZoneSection onDelete={() => setShowDeleteConfirm(true)} />
            </div>
          </div>
        )}

        {/* ──── Save Button ──── */}
        <div className="flex justify-end border-t border-ui-border pt-4">
          <button
            onClick={handleSave}
            disabled={
              saving ||
              !name.trim() ||
              !slug.trim() ||
              (!isEditMode && !isSlugAvailable)
            }
            className="flex h-11 w-full items-center justify-center rounded-md bg-ui-primary px-8 text-sm font-semibold text-ui-primary-text shadow-[var(--ui-shadow-control)] transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin mr-2" />
            ) : (
              <Check size={16} className="mr-2" />
            )}
            {isEditMode ? "Finalize Changes" : "Create Data Room"}
          </button>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setShowDeleteConfirm(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All visitor analytics will be
              permanently removed. Your decks remain safe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={saving}
            >
              {saving ? "Deleting..." : "Delete Room"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Document Picker Modal */}
      <DocumentPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={handleAddDocuments}
        excludeDeckIds={documents.map((d) => d.deck_id)}
      />

      <DataRoomFolderModal
        isOpen={folderModalOpen}
        onClose={() => {
          setFolderModalOpen(false);
          setEditingFolder(null);
        }}
        onSubmit={handleSaveFolder}
        existingTags={tags}
        initialData={
          editingFolder
          ? {
                name: editingFolder.name,
                color: editingFolder.color as FolderColorKey,
                tagIds: editingFolder.tags.map((tag) => tag.id),
              }
            : null
        }
      />

      <DataRoomTagsModal
        isOpen={tagModalOpen}
        onClose={() => setTagModalOpen(false)}
        tags={tags}
        onCreate={(name, color) => folderActions.createTag(name, color)}
        onUpdate={(tagId, name, color) =>
          folderActions.updateTag(tagId, name, color)
        }
        onDelete={folderActions.deleteTag}
      />

      <TierUpsellModal
        isOpen={showAccessUpsell}
        onClose={() => setShowAccessUpsell(false)}
        featureName="Email capture, password protection, and expiry"
        upgradeSource="data_room_access_gate"
      />

      <AlertDialog
        open={!!deletingFolder}
        onOpenChange={(open) => {
          if (!open && !isFolderDeletePending) {
            setDeletingFolder(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deletingFolder?.name}" permanently? Documents in it will
              fall back to Unorganized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isFolderDeletePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteFolder();
              }}
              disabled={isFolderDeletePending}
            >
              {isFolderDeletePending ? "Deleting..." : "Delete Folder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspaceShell>
  );
}

export default ManageDataRoom;
