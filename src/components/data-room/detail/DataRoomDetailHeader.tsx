import { ArrowLeft, Eye, Link as LinkIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { DataRoom } from "../../../types";

interface DataRoomDetailHeaderProps {
  room: DataRoom;
  isPublic: boolean;
  copied: boolean;
  isUpdatingShareState?: boolean;
  onCopyLink: () => void;
  onOpenPreview: () => void;
}

export function DataRoomDetailHeader({
  room,
  isPublic,
  copied,
  isUpdatingShareState,
  onCopyLink,
  onOpenPreview,
}: DataRoomDetailHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="rounded-lg border border-[#222] bg-surface-card">
      <div className="flex flex-col gap-4 p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/rooms")}
              className="w-10 h-10 rounded-md border border-[#333] bg-surface-low flex items-center justify-center text-slate-400 hover:text-white hover:border-[#444] transition-colors shrink-0"
              title="Back to Rooms"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="w-10 h-10 rounded-md border border-[#333] bg-surface-lowest overflow-hidden shrink-0 flex items-center justify-center">
              {room.icon_url ? (
                <img
                  src={room.icon_url}
                  alt={room.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-primary font-black text-sm uppercase">
                  {room.name.charAt(0)}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-xl md:text-2xl font-semibold text-white truncate">
                  {room.name}
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                    isPublic
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border-white/5 bg-white/5 text-slate-400",
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      isPublic ? "bg-emerald-400" : "bg-slate-500",
                    )}
                  />
                  {isPublic ? "Public" : "Private"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Created {new Date(room.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onCopyLink}
              disabled={isUpdatingShareState}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors",
                copied
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-primary text-black hover:bg-primary/90",
              )}
            >
              <LinkIcon size={16} />
              {copied ? "Copied!" : "Share Room"}
            </button>
            <button
              onClick={onOpenPreview}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#333] bg-surface-low px-3 text-sm font-semibold text-slate-400 hover:text-white hover:border-[#444] transition-colors"
              title="Preview room"
            >
              <Eye size={18} className="shrink-0" />
              <span>Preview</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
