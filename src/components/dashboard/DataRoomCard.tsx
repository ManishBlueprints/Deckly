import { useNavigate } from "react-router-dom";
import { Monitor, FileText, Eye, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataRoom } from "../../types";
import { useQueryClient } from "@tanstack/react-query";
import { dataRoomService } from "../../services/dataRoomService";

interface DataRoomCardProps {
  room: DataRoom;
  documentCount: number;
  totalVisitors: number;
  matchedDocumentTitles?: string[];
  matchedTagNames?: string[];
}

export function DataRoomCard({
  room,
  documentCount,
  totalVisitors,
  matchedDocumentTitles = [],
  matchedTagNames = [],
}: DataRoomCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isExpired = room.expires_at ? new Date(room.expires_at) < new Date() : false;

  const handleMouseEnter = () => {
    if (isExpired) return;

    // 1. Preload Component Chunk
    import("../../pages/DataRoomDetail").catch(() => {});

    // 2. Prefetch Data (Metadata + Documents - lightweight)
    queryClient.prefetchQuery({
      queryKey: ["data-room-meta", room.id],
      queryFn: async () => {
        const [docCount, analytics] = await Promise.all([
          dataRoomService.getDocumentCount(room.id),
          dataRoomService.getDataRoomAnalytics(room.id),
        ]);
        return { docCount, visitors: analytics.totalVisitors };
      },
      staleTime: 30000,
    });

    queryClient.prefetchQuery({
      queryKey: ["data-room-documents", room.id],
      queryFn: () => dataRoomService.getDocuments(room.id),
      staleTime: 30000,
    });
  };

  return (
    <button
      onClick={() => navigate(`/rooms/${room.id}`)}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "w-full text-left bg-surface-card border rounded-lg p-5 md:p-6 hover:border-deckly-primary/30 transition-all duration-300 group relative overflow-hidden shadow-sm active:scale-[0.99]",
        isExpired ? "border-red-500/20" : "border-border"
      )}
    >
      {/* Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.01] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Subtle Corner Glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-deckly-primary/[0.04] blur-3xl pointer-events-none" />

      <div className="flex items-center gap-5 relative z-10">
        {/* Icon */}
        <div className="w-12 h-12 rounded-md bg-surface-lowest border border-border flex items-center justify-center shrink-0 overflow-hidden group-hover:border-deckly-primary/40 transition-all duration-200">
          {room.icon_url ? (
            <img
              src={room.icon_url}
              alt={room.name}
              className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all"
            />
          ) : (
            <Monitor
              size={20}
              className="text-slate-500 group-hover:text-deckly-primary transition-colors"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-200 group-hover:text-deckly-primary transition-colors truncate">
              {room.name}
            </h3>
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1 border border-white/10 text-[#bbcbbb]/40">
              Data Room
            </span>
            {isExpired && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[9px] font-bold text-red-500 uppercase tracking-wider animate-pulse">
                <AlertCircle size={10} />
                Expired
              </span>
            )}
          </div>
          {room.description && (
            <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
              {room.description}
            </p>
          )}
          {matchedDocumentTitles.length > 0 && (
            <p className="text-[11px] text-deckly-primary/85 mt-2 leading-relaxed">
              {matchedDocumentTitles.length === 1
                ? `Matched file in this data room: ${matchedDocumentTitles[0]}`
                : `Matched files in this data room: ${matchedDocumentTitles.slice(0, 2).join(", ")}${matchedDocumentTitles.length > 2 ? ` +${matchedDocumentTitles.length - 2} more` : ""}`}
            </p>
          )}
          {matchedTagNames.length > 0 && (
            <p className="text-[11px] text-emerald-300/90 mt-1.5 leading-relaxed">
              Matched by tag{matchedTagNames.length > 1 ? "s" : ""}:{" "}
              {matchedTagNames.slice(0, 3).join(", ")}
              {matchedTagNames.length > 3 ? ` +${matchedTagNames.length - 3} more` : ""}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 bg-surface-low px-2 py-0.5 rounded-md border border-border shrink-0">
              <FileText size={12} className="text-deckly-primary" />
              {documentCount} {documentCount === 1 ? "Asset" : "Assets"}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 bg-surface-low px-2 py-0.5 rounded-md border border-border shrink-0">
              <Eye size={12} className="text-deckly-primary" />
              {totalVisitors} {totalVisitors === 1 ? "Viewer" : "Viewers"}
            </span>
          </div>
        </div>

        {/* Arrow accent */}
        <div className="hidden md:flex opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200">
          <div className="w-7 h-7 rounded-sm bg-deckly-primary flex items-center justify-center text-slate-950">
            <Monitor size={14} />
          </div>
        </div>
      </div>
    </button>
  );
}
