import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
import {
  getRoomVisitorSignals,
  VisitorSignal,
} from "../services/interestSignalService";
import { InterestSignalBadge } from "../components/dashboard/InterestSignalBadge";

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

  const [roomSignals, setRoomSignals] = useState<VisitorSignal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);

  /* ── load data ── */
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
  const handleCopyLink = () => {
    if (!room || !profile?.handle) return;
    const url = `${window.location.origin}/${profile.handle}/room/${room.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddDocuments = async (deckIds: string[]) => {
    if (!roomId) return;
    await dataRoomService.addDocuments(roomId, deckIds);
    loadAll();
  };

  const handleRemoveDocument = async (deckId: string) => {
    if (!roomId) return;
    await dataRoomService.removeDocument(roomId, deckId);
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
  };

  const handleDeleteRoom = async () => {
    if (!roomId) return;
    await dataRoomService.deleteDataRoom(roomId);
    navigate("/rooms");
  };

  const shareUrl =
    room && profile?.handle
      ? `${window.location.origin}/${profile.handle}/room/${room.slug}`
      : "";

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
        <div className="relative bg-[#09090b]/50 border border-white/5 rounded-3xl overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-32 bg-deckly-primary/5 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10 flex items-center gap-4 p-5 pr-6">
            {/* Back */}
            <button
              onClick={() => navigate("/rooms")}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <ArrowLeft size={16} />
            </button>

            {/* Room Icon */}
            <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
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

            {/* Name + description */}
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-white tracking-tight truncate">
                {room.name}
              </h1>
              {room.description && (
                <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                  {room.description}
                </p>
              )}
            </div>

            {/* Security icon pills */}
            <div className="hidden md:flex items-center gap-2">
              {room.require_email && (
                <span
                  title="Email required"
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[9px] font-bold uppercase tracking-widest text-blue-400"
                >
                  <Users size={11} /> Email Gate
                </span>
              )}
              {room.require_password && (
                <span
                  title="Password protected"
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[9px] font-bold uppercase tracking-widest text-purple-400"
                >
                  <LinkIcon size={11} /> Password
                </span>
              )}
              {room.expires_at && (
                <span
                  title={`Expires ${formatDate(room.expires_at)}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[9px] font-bold uppercase tracking-widest text-amber-400"
                >
                  <Calendar size={11} /> Expires
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-2.5 py-2 md:px-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                title="Share"
              >
                {copied ? (
                  <Check size={13} className="text-deckly-primary" />
                ) : (
                  <Copy size={13} />
                )}
                <span className="hidden sm:inline">
                  {copied ? "Copied" : "Share"}
                </span>
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-2 md:px-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                title="Preview"
              >
                <ExternalLink size={13} />
                <span className="hidden sm:inline">Preview</span>
              </a>
              <button
                onClick={() => navigate(`/rooms/${roomId}/edit`)}
                className="flex items-center gap-1.5 px-2.5 py-2 md:px-3 bg-deckly-primary text-slate-950 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-deckly-primary/90 transition-all active:scale-95"
                title="Edit Details"
              >
                <Pencil size={13} />
                <span className="hidden sm:inline">Edit Details</span>
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-9 h-9 flex items-center justify-center bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 hover:bg-red-500/20 transition-colors active:scale-95"
                title="Delete Room"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="border-t border-white/5 grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
            <StatItem
              icon={<FileText size={14} />}
              label="Assets"
              value={documents.length}
            />
            <StatItem
              icon={<Users size={14} />}
              label="Visitors"
              value={analytics.totalVisitors}
            />
            <StatItem
              icon={<Calendar size={14} />}
              label="Created"
              value={formatDate(room.created_at)}
              isText
            />
            <StatItem
              icon={
                copied ? (
                  <Check size={14} className="text-deckly-primary" />
                ) : (
                  <LinkIcon size={14} />
                )
              }
              label={copied ? "Copied!" : "Public Link"}
              value={`/${profile?.handle}/room/${room.slug}`}
              isText
              onClick={handleCopyLink}
            />
          </div>
        </div>

        {/* ── MAIN: 2-col on large screens ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT: Room Assets (3/5) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-deckly-primary" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                  Room Assets
                </h2>
                <span className="text-[9px] font-bold bg-white/5 text-slate-500 px-2 py-0.5 rounded-full border border-white/5">
                  {documents.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                >
                  <Plus size={13} /> Add Existing
                </button>
                <button
                  onClick={() => navigate(`/upload?returnToRoom=${roomId}`)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-deckly-primary text-slate-950 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-deckly-primary/90 transition-all active:scale-95 shadow shadow-deckly-primary/20"
                >
                  <Plus size={13} /> New Deck
                </button>
              </div>
            </div>

            <div className="bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
              {documents.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-600">
                    <FileText size={22} />
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
                    className="flex items-center gap-2 px-4 py-2.5 bg-deckly-primary text-slate-950 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-deckly-primary/90 transition-all"
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
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-deckly-primary" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                  Visitor Signals
                </h2>
              </div>
              {roomSignals.length > 0 && (
                <span className="text-[9px] font-bold bg-deckly-primary/10 text-deckly-primary px-2.5 py-1 rounded-full border border-deckly-primary/20">
                  {roomSignals.length} viewer
                  {roomSignals.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
              {signalsLoading ? (
                <div className="py-12 flex flex-col items-center gap-4 text-slate-600">
                  <div className="w-8 h-8 border-2 border-white/5 border-t-deckly-primary rounded-full animate-spin" />
                  <p className="text-[9px] font-bold uppercase tracking-widest">
                    Gathering signals…
                  </p>
                </div>
              ) : roomSignals.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3 text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-600">
                    <Users size={20} />
                  </div>
                  <p className="text-xs font-bold text-slate-500">
                    No visitors yet
                  </p>
                  <p className="text-[9px] text-slate-600 uppercase tracking-widest leading-relaxed">
                    Signals appear when investors view assets in this room
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {roomSignals.map((visitor, idx) => (
                    <div
                      key={visitor.visitorId}
                      className="p-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-deckly-primary uppercase">
                            V{idx + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {visitor.viewerEmail || "Anonymous Viewer"}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                              {visitor.totalVisits}v
                            </span>
                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                              {visitor.totalTime}s
                            </span>
                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                              {visitor.distinctDays}d
                            </span>
                          </div>
                        </div>
                        {/* Intensity blocks */}
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                "w-2 h-2 rounded-sm",
                                i <= visitor.signals.length
                                  ? "bg-deckly-primary shadow-[0_0_6px_rgba(34,197,94,0.4)]"
                                  : "bg-white/5",
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

      {/* ── Delete Modal ── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setConfirmDelete(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111113] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Delete {room.name}?
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                This permanently deletes the room. Your decks remain intact.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 text-slate-400 font-bold text-sm rounded-xl hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteRoom}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white font-bold text-sm rounded-xl hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

function StatItem({
  icon,
  label,
  value,
  isText = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  isText?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center py-4 px-4 gap-1.5 transition-all duration-300",
        onClick
          ? "cursor-pointer hover:bg-white/[0.04] active:scale-95 group/stat"
          : "",
      )}
    >
      <div
        className={cn(
          "text-slate-500 transition-colors duration-300",
          onClick ? "group-hover/stat:text-deckly-primary" : "",
        )}
      >
        {icon}
      </div>
      <p
        className={`font-bold tracking-tighter transition-all ${
          isText
            ? "text-[11px] uppercase tracking-widest text-slate-400 truncate max-w-[140px]"
            : "text-2xl text-white"
        }`}
      >
        {value}
      </p>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500/80">
        {label}
      </p>
    </div>
  );
}
