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
    <div className="rounded-lg border border-border bg-surface-card">
      <div className="flex flex-col gap-4 p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/rooms")}
              className="w-10 h-10 rounded-md border border-border bg-surface-low flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border hover:bg-surface-high transition-colors shrink-0"
              title="Back to Rooms"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="w-10 h-10 rounded-md border border-border bg-surface-lowest overflow-hidden shrink-0 flex items-center justify-center">
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
                <h1 className="text-xl md:text-2xl font-semibold text-foreground truncate">
                  {room.name}
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                    isPublic
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "border-border bg-surface-low text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      isPublic ? "bg-primary" : "bg-muted-foreground",
                    )}
                  />
                  {isPublic ? "Public" : "Private"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
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
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              <LinkIcon size={16} />
              {copied ? "Copied!" : "Share Room"}
            </button>
            <button
              onClick={onOpenPreview}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface-low px-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-border hover:bg-surface-high transition-colors"
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
