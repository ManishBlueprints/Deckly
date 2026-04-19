import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  FileText,
  Calendar,
  Link as LinkIcon,
  Copy,
  Check,
  Pencil,
  Trash2,
  ExternalLink,
  EyeOff,
  Users,
  Loader2,
  Monitor,
} from "lucide-react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { DocumentPicker } from "../components/dashboard/DocumentPicker";
import { DataRoom, DataRoomDocument } from "../types";
import { cn } from "@/lib/utils";
import { dataRoomService } from "../services/dataRoomService";
import { RoomDocumentList } from "../components/dashboard/RoomDocumentList";
import { useAuth } from "../contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  getRoomVisitorSignals,
  VisitorSignal,
} from "../services/interestSignalService";
import { InterestSignalBadge } from "../components/dashboard/InterestSignalBadge";
import { getDataRoomPreviewPath, getDataRoomShareUrl } from "../utils/url";
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

/* ───────── helpers ───────── */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ───────── main page ───────── */
function DataRoomDetail() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [room, setRoom] = useState<DataRoom | null>(null);
  const [documents, setDocuments] = useState<DataRoomDocument[]>([]);
  const [analytics, setAnalytics] = useState<{
    totalVisitors: number;
    perDeck: { deckId: string; title: string; visitors: number }[];
  }>({ totalVisitors: 0, perDeck: [] });

  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isUpdatingShareState, setIsUpdatingShareState] = useState(false);

  const [roomSignals, setRoomSignals] = useState<VisitorSignal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);

  /* ── load data ── */
  // useCallback is used here to memoize the loading of room data, documents, and analytics
  // This prevents unnecessary re-fetching when the component re-renders
  const loadAll = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const [roomData, docs, analyticsData] = await Promise.all([
        dataRoomService.getDataRoomById(roomId),
        dataRoomService.getDocuments(roomId),
        dataRoomService.getDataRoomAnalytics(roomId),
      ]);
      if (!roomData) {
        navigate("/rooms");
        return;
      }
      setRoom(roomData);
      setDocuments(docs);
      setAnalytics(analyticsData);

      setSignalsLoading(true);
      getRoomVisitorSignals(roomId)
        .then(setRoomSignals)
        .catch((err) => {
          console.error("Failed to load visitor signals", err);
          setRoomSignals([]);
        })
        .finally(() => setSignalsLoading(false));
    } catch (err) {
      console.error("Failed to load room", err);
    } finally {
      setLoading(false);
    }
  }, [roomId, navigate]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ── actions ── */
  const handleCopyLink = async () => {
    if (!room) return;
    if (!profile?.handle) {
      alert("Please set a handle in your profile settings before sharing.");
      return;
    }
    try {
      setIsUpdatingShareState(true);
      const updated = await dataRoomService.publishDataRoom(room.id);
      setRoom(updated);
      const url = getDataRoomShareUrl(profile.handle, updated.slug);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to activate public link", err);
    } finally {
      setIsUpdatingShareState(false);
    }
  };

  const handleMakePrivate = async () => {
    if (!room) return;

    try {
      setIsUpdatingShareState(true);
      const updated = await dataRoomService.unpublishDataRoom(room.id);
      setRoom(updated);
    } catch (err) {
      console.error("Failed to disable public link", err);
    } finally {
      setIsUpdatingShareState(false);
    }
  };

  const handleAddDocuments = async (deckIds: string[]) => {
    if (!roomId) return;
    await dataRoomService.addDocuments(roomId, deckIds);
    queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
    loadAll();
  };

  const handleRemoveDocument = async (deckId: string) => {
    if (!roomId) return;
    await dataRoomService.removeDocument(roomId, deckId);
    queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
    setDocuments((prev) => prev.filter((d) => d.deck_id !== deckId));
    setAnalytics((prev) => ({
      ...prev,
      perDeck: prev.perDeck.filter((p) => p.deckId !== deckId),
    }));
  };

  const handleReorderDocuments = async (orderedDeckIds: string[]) => {
    if (!roomId) return;
    setDocuments((prev) => {
      const newDocs = [...prev];
      newDocs.sort(
        (a, b) =>
          orderedDeckIds.indexOf(a.deck_id) - orderedDeckIds.indexOf(b.deck_id),
      );
      return newDocs;
    });
    await dataRoomService.reorderDocuments(roomId, orderedDeckIds);
    queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
  };

  const handleDeleteRoom = async () => {
    if (!roomId) return;
    setDeleting(true);
    try {
      await dataRoomService.deleteDataRoom(roomId);
      queryClient.invalidateQueries({ queryKey: ["data-rooms"] });
      queryClient.invalidateQueries({
        queryKey: ["user-total-stats", profile?.id],
      });
      navigate("/rooms");
    } catch (err) {
      console.error("Failed to delete room", err);
      setConfirmDelete(false);
      setDeleting(false);
    }
  };

  /* ── loading state ── */
  if (loading) {
    return (
      <DashboardLayout title="Data Rooms" showFab={false}>
        <div className="flex items-center justify-center py-32">
          <Loader2 size={28} className="text-deckly-primary animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!room) return null;

  return (
    <DashboardLayout title="Data Rooms" showFab={false}>
      <div className="space-y-6 pb-12">
        {/* ── HEADER BAR ── */}
        <div className="relative bg-surface-card border border-[#222] rounded-lg overflow-hidden shadow-sm">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6 p-6">
            {/* Back */}
            <button
              onClick={() => navigate("/rooms")}
              className="w-10 h-10 rounded-md bg-surface-lowest border border-white/5 flex items-center justify-center text-slate-400 hover:text-deckly-primary hover:bg-deckly-primary/5 hover:border-deckly-primary/20 transition-all shadow-sm shrink-0"
              title="Back to Rooms"
            >
              <ArrowLeft size={16} />
            </button>

            {/* Room Info */}
            <div className="flex items-center gap-4 flex-1">
              <div className="w-10 h-10 rounded-md bg-background border border-[#333] flex items-center justify-center shrink-0 overflow-hidden">
                {room.icon_url ? (
                  <img
                    src={room.icon_url}
                    alt={room.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Monitor size={18} className="text-slate-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-semibold text-white tracking-tight truncate">
                    {room.name}
                  </h1>
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {room.require_email && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-medium text-blue-400">
                        Email Required
                      </span>
                    )}
                    {room.require_password && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] font-medium text-purple-400">
                        Password Gate
                      </span>
                    )}
                  </div>
                </div>
                {room.description && (
                  <p className="text-xs text-slate-500 mt-0.5 max-w-xl line-clamp-1">
                    {room.description}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => void handleCopyLink()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all active:scale-95",
                  copied
                    ? "bg-green-500 text-white"
                    : "bg-deckly-primary text-slate-950 hover:opacity-90",
                )}
                disabled={isUpdatingShareState}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? "Copied!" : "Copy Link"}</span>
              </button>

              <button
                onClick={() => window.open(getDataRoomPreviewPath(room.id), "_blank", "noopener,noreferrer")}
                className="p-2 bg-surface-low border border-[#333] rounded-md text-slate-400 hover:text-white transition-all active:scale-95"
                title="Open private preview"
              >
                <ExternalLink size={18} />
              </button>

              {room.is_public && (
                <button
                  onClick={() => void handleMakePrivate()}
                  disabled={isUpdatingShareState}
                  className="p-2 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                  title="Disable public link"
                >
                  <EyeOff size={18} />
                </button>
              )}

              <button
                onClick={() => navigate(`/rooms/${roomId}/edit`)}
                className="p-2 bg-surface-low border border-[#333] rounded-md text-slate-400 hover:text-white transition-all active:scale-95"
                title="Edit Details"
              >
                <Pencil size={18} />
              </button>

              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                title="Delete Room"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* ── STATS BAR ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<FileText size={16} />}
            label="Internal Assets"
            value={documents.length}
          />
          <StatCard
            icon={<Users size={16} />}
            label="Total Visitors"
            value={analytics.totalVisitors}
          />
          <StatCard
            icon={<Calendar size={16} />}
            label="Created On"
            value={formatDate(room.created_at)}
          />
          <div
            onClick={() => void handleCopyLink()}
            className="p-4 bg-surface-card border border-[#222] rounded-lg group cursor-pointer hover:border-[#333] transition-all"
          >
            <div className="flex items-center gap-2 text-slate-500 mb-1 group-hover:text-deckly-primary transition-colors">
              <LinkIcon size={14} />
              <span className="text-[10px] font-medium">Access Link</span>
            </div>
            <p className="text-xs font-medium text-slate-300 truncate">
              /{profile?.handle}/room/{room.slug}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              {room.is_public ? "Public link active" : "Private until you copy the link"}
            </p>
          </div>
        </div>

        {/* ── MAIN: 2-col on large screens ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT: Room Assets (3/5) */}
          <div className="lg:col-span-3 space-y-4 h-full flex flex-col">
            <div className="flex flex-col gap-3 min-h-[72px] justify-between">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-deckly-primary" />
                <h2 className="text-xs font-semibold text-slate-400">
                  Room Assets
                </h2>
                <span className="text-[10px] font-medium bg-surface-low text-slate-500 px-2 py-0.5 rounded-full border border-[#222]">
                  {documents.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <button
                  onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-low border border-[#333] rounded-md text-xs font-medium text-slate-400 hover:text-white hover:border-[#444] transition-all active:scale-95"
                >
                  <Plus size={13} /> Add Existing
                </button>
                <button
                  onClick={() => navigate(`/upload?returnToRoom=${roomId}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-deckly-primary text-slate-950 rounded-md text-xs font-semibold hover:bg-deckly-primary/90 transition-all active:scale-95"
                >
                  <Plus size={13} /> New Deck
                </button>
              </div>
            </div>

            <div className="bg-surface-card border border-[#222] rounded-lg overflow-hidden flex-1">
              {documents.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-slate-600">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-500">
                      No assets yet
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-widest">
                      Add decks to gate them inside this room
                    </p>
                  </div>
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-deckly-primary text-slate-950 rounded-md text-xs font-semibold hover:bg-deckly-primary/90 transition-all"
                  >
                    <Plus size={13} /> Add a Deck
                  </button>
                </div>
              ) : (
                <RoomDocumentList
                  documents={documents}
                  onRemove={handleRemoveDocument}
                  onReorder={handleReorderDocuments}
                />
              )}
            </div>
          </div>

          {/* RIGHT: Visitor Signals (2/5) */}
          <div className="lg:col-span-2 space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between min-h-[72px]">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-deckly-primary" />
                <h2 className="text-xs font-semibold text-slate-400">
                  Visitor Signals
                </h2>
              </div>
              {roomSignals.length > 0 && (
                <span className="text-[10px] font-medium bg-deckly-primary/10 text-deckly-primary px-2 py-0.5 rounded-full border border-deckly-primary/20">
                  {roomSignals.length} Viewer
                  {roomSignals.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="bg-surface-card border border-[#222] rounded-lg overflow-hidden flex-1">
              {signalsLoading ? (
                <div className="py-12 flex flex-col items-center gap-4 text-slate-600">
                  <div className="w-8 h-8 border-2 border-white/5 border-t-deckly-primary rounded-full animate-spin" />
                  <p className="text-[9px] font-bold uppercase tracking-widest">
                    Gathering signals…
                  </p>
                </div>
              ) : roomSignals.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3 text-center px-6">
                  <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-slate-600">
                    <Users size={20} />
                  </div>
                  <p className="text-sm font-semibold text-slate-500">
                    No visitors yet
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Signals appear when investors view assets in this room
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#222]">
                  {roomSignals.map((visitor, idx) => (
                    <div
                      key={visitor.visitorId}
                      className="p-4 hover:bg-surface-high transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-md bg-[#1a1a1a] border border-[#333] flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-semibold text-deckly-primary uppercase">
                            V{idx + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">
                            {visitor.viewerEmail || "Anonymous Viewer"}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-slate-600 font-medium">
                              {visitor.totalVisits} visits
                            </span>
                            <span className="text-[10px] text-slate-600 font-medium">
                              {visitor.totalTime}s
                            </span>
                          </div>
                        </div>
                        {/* Intensity blocks */}
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                "w-1.5 h-3 rounded-[1px]",
                                i <= visitor.signals.length
                                  ? "bg-deckly-primary/40"
                                  : "bg-[#222]",
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {visitor.signals.map((signal) => (
                          <InterestSignalBadge key={signal} signal={signal} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation ── */}
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setConfirmDelete(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {room.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this room? This action cannot be
              undone and all visitors will be revoked access. Your original decks remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                handleDeleteRoom();
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Room"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Document Picker */}
      <DocumentPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={handleAddDocuments}
        excludeDeckIds={documents.map((d) => d.deck_id)}
      />
    </DashboardLayout>
  );
}

export default DataRoomDetail;

/* ─────────── Sub-components ─────────── */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="p-4 bg-surface-card border border-[#222] rounded-lg">
      <div className="flex items-center gap-2 text-slate-500 mb-1">
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
