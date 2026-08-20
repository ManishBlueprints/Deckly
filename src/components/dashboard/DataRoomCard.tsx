import { useNavigate } from "react-router-dom";
import { Calendar, Clock3, ExternalLink, FileText, Lock, Users, AlertCircle } from "lucide-react";
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
        "group relative flex min-h-[286px] w-full flex-col overflow-hidden rounded-[18px] border bg-ui-surface p-5 text-left shadow-[var(--ui-shadow-control)] transition-all hover:-translate-y-0.5 hover:border-ui-primary/35 hover:shadow-[var(--ui-shadow-surface)]",
        isExpired ? "border-ui-destructive/30" : "border-ui-border"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="relative h-14 w-16 shrink-0">
          <span className="absolute left-0 top-0 h-12 w-12 rounded-[10px] border border-ui-border bg-ui-subtle" />
          <span className="absolute left-2 top-1 h-12 w-12 rounded-[10px] border border-ui-border bg-ui-subtle" />
          <div className="absolute left-4 top-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-[10px] bg-ui-primary text-sm font-semibold text-ui-primary-text shadow-sm">
          {room.icon_url ? (
            <img
              src={room.icon_url}
              alt={room.name}
              className="h-full w-full object-cover"
            />
          ) : (
            room.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
          )}
          </div>
        </div>
        {isExpired && <span className="inline-flex items-center gap-1 rounded-full bg-ui-destructive/10 px-2.5 py-1 text-xs font-medium text-ui-destructive"><AlertCircle size={13} />Expired</span>}
      </div>

      <div className="mt-4 min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-[-0.025em] text-ui-text">{room.name}</h2>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-ui-muted">{room.description || "Secure workspace for sharing decks and documents."}</p>
          {matchedDocumentTitles.length > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-ui-primary">
              {matchedDocumentTitles.length === 1
                ? `Matched file in this data room: ${matchedDocumentTitles[0]}`
                : `Matched files in this data room: ${matchedDocumentTitles.slice(0, 2).join(", ")}${matchedDocumentTitles.length > 2 ? ` +${matchedDocumentTitles.length - 2} more` : ""}`}
            </p>
          )}
          {matchedTagNames.length > 0 && (
            <p className="mt-1.5 text-xs leading-relaxed text-ui-primary">
              Matched by tag{matchedTagNames.length > 1 ? "s" : ""}:{" "}
              {matchedTagNames.slice(0, 3).join(", ")}
              {matchedTagNames.length > 3 ? ` +${matchedTagNames.length - 3} more` : ""}
            </p>
          )}
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-ui-border pt-4 text-xs text-ui-muted"><Lock size={15} className="text-ui-primary" /><span>Secure room</span><span>·</span><Users size={15} /><span>Invite only</span></div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-ui-muted">
        <span><FileText size={17} className="mb-1 text-ui-text" /><strong className="font-mono font-medium text-ui-text">{documentCount}</strong><br />docs</span>
        <span><Users size={17} className="mb-1 text-ui-text" /><strong className="font-mono font-medium text-ui-text">{totalVisitors}</strong><br />visitors</span>
        <span><Clock3 size={17} className="mb-1 text-ui-text" /><span className="font-mono">{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(room.updated_at || room.created_at))}</span><br />activity</span>
      </div>
      <div className="mt-auto flex items-center justify-between pt-5 text-xs text-ui-muted"><span className="flex items-center gap-2"><Calendar size={15} />{room.expires_at ? `Expires ${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(room.expires_at))}` : "No expiration"}</span><span className="inline-flex items-center gap-1 font-medium text-ui-primary">Open <ExternalLink size={14} /></span></div>
    </button>
  );
}
