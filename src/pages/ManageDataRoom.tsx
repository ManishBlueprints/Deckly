import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { DocumentPicker } from "../components/dashboard/DocumentPicker";
import { RoomDocumentList } from "../components/dashboard/RoomDocumentList";
import { AccessProtectionSection } from "../components/dashboard/form-sections/AccessProtectionSection";
import { DangerZoneSection } from "../components/dashboard/form-sections/DangerZoneSection";
import { DataRoomDocument } from "../types";
import { dataRoomService } from "../services/dataRoomService";
import { useAuth } from "../contexts/AuthContext";
import { TIER_CONFIG, Tier } from "../constants/tiers";
import { normalizeSlug } from "../utils/slug";

function ManageDataRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isEditMode = !!roomId && roomId !== "new";

  // Tier limit safety check for create mode
  useEffect(() => {
    if (isEditMode) return;
    const tier: Tier = (profile?.tier as Tier) || "FREE";
    const max = TIER_CONFIG[tier].maxDataRooms;
    dataRoomService.getDataRooms().then((rooms) => {
      if (rooms.length >= max) navigate("/rooms");
    });
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
  const [error, setError] = useState("");

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
        setError("Failed to load data room");
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
        setError("Failed to upload icon");
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
    [isEditMode, roomId, documents.length],
  );

  // Remove document
  const handleRemoveDocument = useCallback(
    async (deckId: string) => {
      if (isEditMode) {
        try {
          await dataRoomService.removeDocument(roomId!, deckId);
          setDocuments((prev) => prev.filter((d) => d.deck_id !== deckId));
        } catch (err) {
          console.error("Failed to remove document", err);
        }
      } else {
        setDocuments((prev) => prev.filter((d) => d.deck_id !== deckId));
      }
    },
    [isEditMode, roomId],
  );

  // Reorder documents
  const handleReorder = useCallback(
    async (orderedDeckIds: string[]) => {
      // Optimistic reorder
      const reordered = orderedDeckIds.map((id, i) => {
        const doc = documents.find((d) => d.deck_id === id)!;
        return { ...doc, display_order: i };
      });
      setDocuments(reordered);

      if (isEditMode) {
        try {
          await dataRoomService.reorderDocuments(roomId!, orderedDeckIds);
        } catch (err) {
          console.error("Failed to reorder", err);
        }
      }
    },
    [isEditMode, roomId, documents],
  );

  // Save / Create
  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) {
      setError("Name and slug are required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (isEditMode) {
        await dataRoomService.updateDataRoom(roomId!, {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          icon_url: iconUrl || undefined,
          require_email: requireEmail,
          require_password: requirePassword,
          view_password: requirePassword ? viewPassword : undefined,
          expires_at:
            expiryEnabled && expiryDate
              ? new Date(expiryDate).toISOString()
              : null,
        });
        navigate(`/rooms/${roomId}`);
      } else {
        // Check slug availability
        const available = await dataRoomService.checkSlugAvailable(
          slug,
          isEditMode ? roomId : undefined,
        );
        if (!available) {
          setError("This slug is already taken. Please choose another.");
          setSaving(false);
          return;
        }

        const room = await dataRoomService.createDataRoom({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          icon_url: iconUrl || undefined,
        });

        // Update access settings
        if (requireEmail || requirePassword || expiryEnabled) {
          await dataRoomService.updateDataRoom(room.id, {
            require_email: requireEmail,
            require_password: requirePassword,
            view_password: requirePassword ? viewPassword : undefined,
            expires_at:
              expiryEnabled && expiryDate
                ? new Date(expiryDate).toISOString()
                : null,
          });
        }

        // Add documents
        const deckIds = documents.map((d) => d.deck_id);
        if (deckIds.length > 0) {
          await dataRoomService.addDocuments(room.id, deckIds);
        }

        navigate(`/rooms/${room.id}`);
      }
    } catch (err: any) {
      console.error("Failed to save", err);
      setError(err?.message || "Failed to save data room");
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!isEditMode) return;
    try {
      await dataRoomService.deleteDataRoom(roomId!);
      navigate("/rooms");
    } catch (err) {
      console.error("Failed to delete room", err);
    }
  };

  // Copy link
  const handleCopyLink = () => {
    const url = `${window.location.origin}/room/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareUrl = `${window.location.origin}/room/${slug}`;

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
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        {/* Back + Title */}
        <div className="flex items-center gap-5">
          <button
            onClick={() => navigate(isEditMode ? `/rooms/${roomId}` : "/rooms")}
            className="w-12 h-12 flex items-center justify-center text-slate-500 hover:text-white transition-all rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:shadow-xl group"
          >
            <ArrowLeft
              size={20}
              className="group-hover:-translate-x-1 transition-transform"
            />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-deckly-primary mb-1">
              {isEditMode ? "Data Room Configuration" : "Room Initiation"}
            </p>
            <h1 className="text-3xl font-bold text-white tracking-tight uppercase tracking-wider">
              {isEditMode ? "Modify Assets" : "Create Data Room"}
            </h1>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {/* ──── Section 1: Room Identity ──── */}
        <div className="glass-shiny bg-white/[0.03] backdrop-blur-xl rounded-[32px] border border-white/10 overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-deckly-primary/5 rounded-full blur-[80px] -mr-32 -mt-32" />

          <div className="px-8 py-6 border-b border-white/5 relative z-10">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Room Branding
            </h2>
          </div>
          <div className="p-8 space-y-8 relative z-10">
            {/* Icon */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="w-24 h-24 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 relative group shadow-inner">
                {iconPreview ? (
                  <>
                    <img
                      src={iconPreview}
                      alt="Room icon"
                      className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
                    />
                    <button
                      onClick={() => {
                        setIconUrl("");
                        setIconPreview("");
                      }}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl backdrop-blur-sm"
                    >
                      <Trash2
                        size={20}
                        className="text-red-400 hover:scale-110 transition-transform"
                      />
                    </button>
                  </>
                ) : uploadingIcon ? (
                  <Loader2
                    size={24}
                    className="text-deckly-primary animate-spin"
                  />
                ) : (
                  <Image
                    size={32}
                    className="text-slate-700 group-hover:text-deckly-primary transition-colors duration-500"
                  />
                )}
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  ROOM IMAGE
                </p>
                <label className="inline-flex items-center gap-3 px-6 py-2.5 bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 hover:border-deckly-primary/30 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer transition-all active:scale-95 shadow-lg">
                  <Upload size={14} className="text-deckly-primary" />
                  {iconPreview ? "Modify Badge" : "Upload Badge"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleIconUpload}
                  />
                </label>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-700">
                  Ideal size: 256x256 • Max 1MB
                </p>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">
                Display Name <span className="text-deckly-primary">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PROPOSAL: ALPHA SERIES"
                className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl text-sm text-white font-bold uppercase tracking-wider placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-deckly-primary/20 focus:border-deckly-primary/30 transition-all shadow-inner"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">
                Internal URL <span className="text-deckly-primary">*</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center bg-white/5 border border-white/5 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-deckly-primary/20 focus-within:border-deckly-primary/30 transition-all shadow-inner">
                  <span className="pl-6 pr-1 text-[11px] font-bold uppercase tracking-widest text-slate-600 select-none whitespace-nowrap">
                    /{profile?.handle}/room/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                    placeholder="alpha-series"
                    className="flex-1 py-4 pr-6 bg-transparent text-sm text-deckly-primary font-bold uppercase tracking-wider focus:outline-none placeholder:text-slate-700"
                  />
                </div>
                {slug && (
                  <button
                    onClick={handleCopyLink}
                    className="p-4 bg-white/5 border border-white/5 rounded-2xl text-slate-500 hover:text-deckly-primary hover:bg-deckly-primary/5 transition-all shadow-lg active:scale-95 group"
                    title="Copy share link"
                  >
                    {copied ? (
                      <Check size={20} className="text-deckly-primary" />
                    ) : (
                      <Copy
                        size={20}
                        className="group-hover:scale-110 transition-transform"
                      />
                    )}
                  </button>
                )}
              </div>
              {slug && (
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-700 mt-3 ml-1 flex items-center gap-2">
                  <LinkIcon size={12} className="text-deckly-primary" />
                  {shareUrl}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">
                Contextual Brief
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ADDITIONAL ROOM CONTEXT..."
                rows={3}
                className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl text-sm text-slate-400 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-deckly-primary/20 focus:border-deckly-primary/30 transition-all shadow-inner resize-none"
              />
            </div>
          </div>
        </div>

        {/* ──── Section 2: Documents ──── */}
        <div className="glass-shiny bg-white/[0.03] backdrop-blur-xl rounded-[32px] border border-white/10 overflow-hidden shadow-2xl">
          <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Bundle Composition
            </h2>
            {documents.length > 0 && (
              <button
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95"
              >
                <Plus size={14} />
                ADD ASSETS
              </button>
            )}
          </div>
          <div className="p-4">
            {documents.length === 0 ? (
              <div
                onClick={() => setPickerOpen(true)}
                className="group cursor-pointer border-2 border-dashed border-white/5 bg-white/[0.01] hover:border-deckly-primary/30 hover:bg-deckly-primary/[0.02] rounded-2xl p-12 text-center transition-all duration-500 flex flex-col items-center gap-4 m-2"
              >
                <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-deckly-primary/10 group-hover:border-deckly-primary/20 transition-all duration-500">
                  <Plus
                    size={32}
                    className="text-slate-600 group-hover:text-deckly-primary transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white uppercase tracking-wider">
                    Add documents to your room
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    Existing Assets will be bundled into a secure link
                  </p>
                </div>
                <button className="mt-2 px-8 py-3 bg-deckly-primary text-slate-950 font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-deckly-primary/90 transition-all shadow-xl shadow-deckly-primary/20 group-hover:scale-105 active:scale-95">
                  ADD ASSETS
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
        <div className="glass-shiny bg-white/[0.03] backdrop-blur-xl rounded-[32px] border border-white/10 overflow-hidden shadow-2xl">
          <div className="px-8 py-6 border-b border-white/5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Security Protocol
            </h2>
          </div>
          <div className="p-8">
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
          <div className="glass-shiny bg-red-500/[0.02] backdrop-blur-xl rounded-[32px] border border-red-500/10 overflow-hidden shadow-2xl">
            <div className="px-8 py-5 border-b border-red-500/10">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500/60">
                Danger Zone
              </h2>
            </div>
            <div className="p-8">
              <DangerZoneSection onDelete={handleDelete} />
            </div>
          </div>
        )}

        {/* ──── Save Button ──── */}
        <div className="flex justify-end pb-12">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !slug.trim()}
            className="flex items-center gap-3 px-12 py-5 bg-deckly-primary text-slate-950 font-bold text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-deckly-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] shadow-2xl shadow-deckly-primary/20"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Check size={18} />
            )}
            {isEditMode ? "Finalize Changes" : "Deploy Data Room"}
          </button>
        </div>
      </div>

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
