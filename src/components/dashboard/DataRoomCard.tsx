import { useNavigate } from "react-router-dom";
import { Monitor, FileText, Eye } from "lucide-react";
import { DataRoom } from "../../types";

interface DataRoomCardProps {
  room: DataRoom;
  documentCount: number;
  totalVisitors: number;
}

export function DataRoomCard({
  room,
  documentCount,
  totalVisitors,
}: DataRoomCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/rooms/${room.id}`)}
      className="w-full text-left glass-shiny bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 hover:bg-white/[0.05] hover:border-deckly-primary/30 hover:shadow-2xl hover:shadow-deckly-primary/10 transition-all duration-300 group relative overflow-hidden"
    >
      <div className="flex items-center gap-5 relative z-10">
        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden group-hover:border-deckly-primary/30 group-hover:bg-deckly-primary/5 transition-all duration-300 shadow-inner">
          {room.icon_url ? (
            <img
              src={room.icon_url}
              alt={room.name}
              className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all"
            />
          ) : (
            <Monitor
              size={24}
              className="text-slate-500 group-hover:text-deckly-primary transition-colors"
            />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-deckly-primary transition-colors uppercase tracking-[0.05em]">
            {room.name}
          </h3>
          {room.description && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 truncate mt-1">
              {room.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-4">
            <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <FileText size={12} className="text-deckly-primary" />
              {documentCount} {documentCount === 1 ? "ASSET" : "ASSETS"}
            </span>
            <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
              <Eye size={12} className="text-deckly-primary" />
              {totalVisitors} {totalVisitors === 1 ? "VIEWER" : "VIEWERS"}
            </span>
          </div>
        </div>

        {/* Arrow accent */}
        <div className="hidden md:flex opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-300">
          <div className="w-8 h-8 rounded-full bg-deckly-primary flex items-center justify-center text-slate-950 shadow-lg shadow-deckly-primary/20">
            <Monitor size={14} />
          </div>
        </div>
      </div>
    </button>
  );
}
