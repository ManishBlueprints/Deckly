import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { useCheckDataRoomSlug } from "../hooks/useSlugValidation";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { DocumentPicker } from "../components/dashboard/DocumentPicker";
import { RoomDocumentList } from "../components/dashboard/RoomDocumentList";
import { AccessProtectionSection } from "../components/dashboard/form-sections/AccessProtectionSection";
import { DangerZoneSection } from "../components/dashboard/form-sections/DangerZoneSection";
import { DataRoomDocument } from "../types";
import { dataRoomService } from "../services/dataRoomService";
import { useAuth } from "../contexts/AuthContext";
import { DataRoomCreateTour } from "../components/tours/DataRoomCreateTour";
import { TIER_CONFIG, Tier } from "../constants/tiers";
import { normalizeSlug } from "../utils/slug";
import { useQueryClient } from "@tanstack/react-query";
import { getDataRoomShareUrl } from "../utils/url";
import { toast } from "sonner";
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

function ManageDataRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isEditMode = !!roomId && roomId !== "new";

  // Tier limit safety check for create mode
  useEffect(() => {
    if (isEditMode) return;

    let isMounted = true;
    const tier: Tier = (profile?.tier as Tier) || "FREE";
    const max = TIER_CONFIG[tier].maxDataRooms;

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
  }, [isEditMode, profile, navigate]);

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

  // Documents
  const [documents, setDocuments] = useState<DataRoomDocument[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // UI state
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

        const docs = await dataRoomService.getDocuments(roomId!);
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
          const docs = await dataRoomService.getDocuments(roomId!);
          setDocuments(docs);
        } catch (err) {
          console.error("Failed to add documents", err);
        }
      } else {
        // In create mode, just track deck IDs locally (documents will be added after creation)
        const fakeDocs = deckIds.map((id, i) => ({
          id: `temp-${id}`,
          data_room_id: "",
          deck_id: id,
          display_order: documents.length + i,
          added_at: new Date().toISOString(),
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
        await dataRoomService.updateDataRoom(roomId!, roomPayload);
      } else {
        // Atomic creation with all settings
        const room = await dataRoomService.createDataRoom(roomPayload);

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
      const e = err as { message?: string; code?: string };
      
      // Handle unique constraint violation for slug
      if (e?.code === '23505' || e?.message?.includes('unique constraint "data_rooms_slug_key"')) {
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
  const handleCopyLink = () => {
    if (!profile?.handle) {
      alert("Please set a handle in your profile settings before sharing.");
      return;
    }
    const url = getDataRoomShareUrl(profile.handle, slug);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareUrl = profile?.handle
    ? getDataRoomShareUrl(profile.handle, slug)
    : "Set a handle in profile to enable sharing";

  if (loading) {
    return (
      <DashboardLayout title="Data Rooms" showFab={false}>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="text-deckly-primary animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Data Rooms" showFab={false}>
      <DataRoomCreateTour isEditMode={isEditMode} />
      <div className="max-w-3xl mx-auto w-full px-4 md:px-6 space-y-6 pb-20 pt-6">
        {/* Back + Title */}
        <div className="flex items-center gap-4 relative z-10 border-b border-white/5 pb-6">
          <button
            onClick={() => navigate("/rooms")}
            className="flex-shrink-0 w-10 h-10 rounded-md bg-surface-lowest border border-white/10 flex items-center justify-center text-slate-400 hover:text-deckly-primary hover:bg-deckly-primary/5 hover:border-deckly-primary/20 transition-all shadow-sm"
            title="Return to Rooms"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-xl font-semibold text-white tracking-tight truncate">
              {isEditMode ? "Edit Data Room" : "Create Data Room"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {isEditMode ? "Data Room Configuration" : "Room Initiation"}  
            </p>
          </div>
        </div>

        {/* ──── Section 1: Room Identity ──── */}
        <div 
          data-tour="room-branding"
          className="bg-surface-card border border-white/5 rounded-lg overflow-hidden relative"
        >
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-medium text-white">Room Branding</h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Icon */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="w-16 h-16 rounded-md bg-surface-container flex items-center justify-center overflow-hidden shrink-0 relative group">
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
                        className="text-white hover:text-red-400 transition-colors"
                      />
                    </button>
                  </>
                ) : uploadingIcon ? (
                  <Loader2
                    size={20}
                    className="text-deckly-primary animate-spin"
                  />
                ) : (
                  <Image
                    size={24}
                    className="text-slate-500 group-hover:text-deckly-primary transition-colors duration-300"
                  />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-300">
                  Room Image
                </p>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center justify-center h-9 px-4 bg-surface-container border border-white/10 hover:border-white/20 rounded-md text-sm font-medium text-white cursor-pointer transition-all">
                    <Upload size={14} className="mr-2 text-deckly-primary" />
                    {iconPreview ? "Modify Image" : "Upload Image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleIconUpload}
                    />
                  </label>
                  <p className="text-xs text-slate-500">
                    Ideal size: 256x256 • Max 1MB
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Display Name <span className="text-deckly-primary">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Proposal: Alpha Series"
                className="w-full h-11 px-4 bg-surface-container border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-1 focus:ring-deckly-primary transition-all placeholder:text-slate-500 focus:bg-surface-container"
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Internal URL <span className="text-deckly-primary">*</span>
              </label>
              <div className="flex gap-3">
                <div className="flex-1 flex items-center bg-surface-container border border-white/10 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-deckly-primary transition-all focus-within:bg-surface-container h-11 relative">
                  <span className="pl-3 pr-1 text-sm text-deckly-primary select-none whitespace-nowrap">
                    /{profile?.handle}/room/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                    placeholder="alpha-series"
                    className="flex-1 h-full pr-3 bg-transparent text-sm text-white focus:outline-none placeholder:text-slate-500"
                  />
                  {isCheckingSlug && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2
                        size={14}
                        className="text-slate-500 animate-spin"
                      />
                    </div>
                  )}
                </div>
                {slug && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyLink}
                      disabled={isExpired}
                      className="flex items-center justify-center w-11 h-11 bg-surface-container border border-white/10 rounded-md text-slate-400 hover:text-white transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed group relative"
                      title={isExpired ? "Link Expired" : "Copy share link"}
                    >
                      {copied ? (
                        <Check size={16} className="text-deckly-primary" />
                      ) : (
                        <Copy size={16} />
                      )}
                      
                      {isExpired && (
                        <div className="absolute -top-1 px-1.5 py-0.5 bg-red-500 text-[8px] text-white font-bold rounded uppercase tracking-tighter whitespace-nowrap">
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
                        className="h-11 px-4 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 rounded-md text-xs font-bold transition-all flex items-center gap-2"
                      >
                        <Plus size={14} />
                        Reactivate Link
                      </button>
                    )}
                  </div>
                )}
              </div>
              <AnimatePresence>
                {!isEditMode &&
                  slug.length > 2 &&
                  isSlugAvailable === false &&
                  !isCheckingSlug && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-xs text-red-500 flex items-center gap-1.5"
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
                      className="text-xs text-emerald-500 flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={14} />
                      URL Available
                    </motion.p>
                  )}
              </AnimatePresence>
              {slug && (
                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                  <LinkIcon size={12} className="text-deckly-primary" />
                  {shareUrl}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Contextual Brief
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional room context..."
                rows={3}
                className="w-full px-4 py-3 bg-surface-container border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-1 focus:ring-deckly-primary transition-all placeholder:text-slate-500 focus:bg-surface-container resize-none"
              />
            </div>
          </div>
        </div>

        {/* ──── Section 2: Documents ──── */}
        <div 
          data-tour="room-assets"
          className="bg-surface-card border border-white/5 rounded-lg overflow-hidden relative"
        >
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">YOUR ASSETS</h2>
            {documents.length > 0 && (
              <button
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-2 h-8 px-3 bg-surface-container border border-white/10 hover:border-white/20 text-white rounded-md text-xs font-medium transition-all"
              >
                <Plus size={14} />
                Add Assets
              </button>
            )}
          </div>
          <div className="p-4">
            {documents.length === 0 ? (
              <div
                onClick={() => setPickerOpen(true)}
                className="group cursor-pointer border border-dashed border-white/10 hover:border-deckly-primary/30 bg-surface-container hover:bg-surface-card rounded-md p-8 text-center transition-all flex flex-col items-center gap-4"
              >
                <div className="w-12 h-12 flex items-center justify-center transition-all">
                  <Plus
                    size={24}
                    className="text-slate-500 group-hover:text-deckly-primary transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    Add documents to your room
                  </p>
                  <p className="text-xs text-slate-500">
                    Existing assets will be bundled into a secure link
                  </p>
                </div>
                <button className="mt-2 h-9 px-4 bg-deckly-primary text-slate-950 font-semibold text-sm rounded-md hover:bg-deckly-primary/90 transition-all">
                  Add Assets
                </button>
              </div>
            ) : (
              <RoomDocumentList
                documents={documents}
                onRemove={handleRemoveDocument}
                onReorder={handleReorder}
              />
            )}
          </div>
        </div>

        {/* ──── Section 3: Access Controls ──── */}
        <div 
          id="security-section"
          data-tour="room-security"
          className="bg-surface-card border border-white/5 rounded-lg overflow-hidden relative"
        >
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-medium text-white">
              Security & Access
            </h2>
          </div>
          <div className="p-6">
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
        <div className="flex justify-end pt-4 border-t border-white/5">
          <button
            onClick={handleSave}
            disabled={
              saving ||
              !name.trim() ||
              !slug.trim() ||
              (!isEditMode && !isSlugAvailable)
            }
            className="flex items-center justify-center w-full sm:w-auto px-8 h-11 bg-deckly-primary text-slate-950 font-semibold text-sm rounded-md hover:bg-deckly-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
    </DashboardLayout>
  );
}

export default ManageDataRoom;
