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
  BarChart3,
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

  // Data
  const [room, setRoom] = useState<DataRoom | null>(null);
  const [documents, setDocuments] = useState<DataRoomDocument[]>([]);
  const [analytics, setAnalytics] = useState<{
    totalVisitors: number;
    perDeck: { deckId: string; title: string; visitors: number }[];
  }>({ totalVisitors: 0, perDeck: [] });

  // UI
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      <div className="space-y-0">
        {/* ═══════════════ HERO BANNER ═══════════════ */}
        <div className="relative overflow-hidden bg-[#090b10] border-b border-white/5 py-12">
          {/* Background pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
          {/* Glow accents */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-deckly-primary/10 rounded-full blur-[120px] -mr-64 -mt-64" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] -ml-32 -mb-32" />

          <div className="relative z-10 max-w-5xl mx-auto px-6">
            {/* Back button */}
            <button
              onClick={() => navigate("/rooms")}
              className="flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] mb-12 group transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-deckly-primary/10 group-hover:border-deckly-primary/20 transition-all">
                <ArrowLeft
                  size={14}
                  className="group-hover:-translate-x-0.5 transition-transform"
                />
              </div>
              Return to Rooms
            </button>

            <div className="flex flex-col items-center text-center">
              {/* Icon */}
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mb-8 shadow-2xl backdrop-blur-md relative group">
                <div className="absolute inset-0 bg-deckly-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                {room.icon_url ? (
                  <img
                    src={room.icon_url}
                    alt={room.name}
                    className="w-full h-full object-cover relative z-10 transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <Monitor
                    size={32}
                    className="text-slate-500 group-hover:text-deckly-primary transition-colors duration-500 relative z-10"
                  />
                )}
              </div>

              {/* Name */}
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4 uppercase tracking-[0.05em]">
                {room.name}
              </h1>

              {room.description && (
                <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.15em] max-w-md mb-8 leading-relaxed">
                  {room.description}
                </p>
              )}

              {/* Action pills */}
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/3 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all active:scale-95 shadow-lg"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-deckly-primary" />
                      Link Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      Share Room
                    </>
                  )}
                </button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/3 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all active:scale-95 shadow-lg"
                >
                  <ExternalLink size={14} />
                  Live Preview
                </a>
                <button
                  onClick={() => navigate(`/rooms/${roomId}/edit`)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-deckly-primary text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-deckly-primary/90 transition-all active:scale-95 shadow-lg shadow-deckly-primary/10"
                >
                  <Pencil size={14} />
                  Manage
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-all active:scale-95 shadow-lg"
                >
                  <Trash2 size={14} />
                  Erase
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* ═══════════════ STATS ROW ═══════════════ */}
        <div className="bg-[#0e1117]/50 border-b border-white/5 py-0 px-6 backdrop-blur-md overflow-x-auto scrollbar-hide">
          <div className="max-w-5xl mx-auto min-w-[640px] md:min-w-0">
            <div className="grid grid-cols-4 divide-x divide-white/5">
              <StatItem
                icon={<FileText size={16} />}
                label="Assets Gated"
                value={documents.length}
              />
              <StatItem
                icon={<Users size={16} />}
                label="Total Reach"
                value={analytics.totalVisitors}
              />
              <StatItem
                icon={<Calendar size={16} />}
                label="Established"
                value={formatDate(room.created_at)}
                isText
              />
              <StatItem
                icon={
                  copied ? (
                    <Check size={16} className="text-deckly-primary" />
                  ) : (
                    <LinkIcon size={16} />
                  )
                }
                label={copied ? "Copied" : "Public Link"}
                value={
                  copied ? "Success" : `/${profile?.handle}/room/${room.slug}`
                }
                isText
                onClick={handleCopyLink}
              />
            </div>
          </div>
        </div>

        {/* ═══════════════ MAIN CONTENT ═══════════════ */}
        <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
          {/* Room Assets section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-deckly-primary" />
                <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                  Room Assets
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(`/upload?returnToRoom=${roomId}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-deckly-primary text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-deckly-primary/90 transition-all active:scale-95 shadow-lg shadow-deckly-primary/10"
                >
                  <Plus size={14} />
                  Add New
                </button>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all active:scale-95"
                >
                  <Plus size={14} />
                  Add Existing
                </button>
              </div>
            </div>

            <div className="glass-shiny bg-white/[0.03] backdrop-blur-xl rounded-[2rem] border border-white/10 p-4 shadow-2xl">
              <RoomDocumentList
                documents={documents}
                onRemove={handleRemoveDocument}
                onReorder={(ids: string[]) =>
                  dataRoomService.reorderDocuments(roomId!, ids)
                }
              />
            </div>
          </div>

          {/* Configuration Overview section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <BarChart3 size={16} className="text-deckly-primary" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                Security Protocol
              </h2>
            </div>

            <div className="glass-shiny bg-white/[0.03] backdrop-blur-xl rounded-[2rem] border border-white/10 p-8 shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SettingPill
                  label="Email Required"
                  value={room.require_email ? "FORCED" : "BYPASS"}
                  active={!!room.require_email}
                />
                <SettingPill
                  label="Gate Access"
                  value={room.require_password ? "GATED" : "OPEN"}
                  active={!!room.require_password}
                />
                <SettingPill
                  label="Expiration"
                  value={
                    room.expires_at ? formatDate(room.expires_at) : "INFINITE"
                  }
                  active={!!room.expires_at}
                />
              </div>
              <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                <button
                  onClick={() => navigate(`/rooms/${roomId}/edit`)}
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-deckly-primary hover:text-white transition-colors flex items-center gap-2"
                >
                  <Pencil size={12} />
                  Adjust Security
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setConfirmDelete(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                Delete Data Room?
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                This will permanently delete <strong>{room.name}</strong>. Your
                decks will remain intact.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-200 transition-colors"
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
        "flex flex-col items-center justify-center py-6 px-4 gap-2 transition-all duration-300",
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
        className={`font-black tracking-tighter transition-all ${
          isText
            ? "text-[11px] uppercase tracking-widest text-slate-400 truncate max-w-[140px]"
            : "text-4xl text-white shadow-premium"
        }`}
      >
        {value}
      </p>
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500/80">
        {label}
      </p>
    </div>
  );
}

function SettingPill({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
        active
          ? "bg-deckly-primary/10 border-deckly-primary/30 shadow-[0_0_20px_rgba(34,197,94,0.05)]"
          : "bg-white/[0.02] border-white/10"
      }`}
    >
      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
        {label}
      </span>
      <span
        className={`text-[10px] font-black uppercase tracking-widest ${
          active ? "text-deckly-primary" : "text-slate-600"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
