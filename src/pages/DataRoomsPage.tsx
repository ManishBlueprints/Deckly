import { Plus, Monitor, Lock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { DataRoomCard } from "../components/dashboard/DataRoomCard";
import { useAuth } from "../contexts/AuthContext";
import { TIER_CONFIG, Tier } from "../constants/tiers";
import { useDataRoomsWithMeta } from "../hooks/useDataRooms";

function DataRoomsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: rooms = [], isLoading, isFetching } = useDataRoomsWithMeta();

  const tier: Tier = (profile?.tier as Tier) || "FREE";
  const tierConfig = TIER_CONFIG[tier];
  const maxRooms = tierConfig.maxDataRooms;
  const isAtLimit = rooms.length >= maxRooms;
  const isUnlimited = maxRooms === Infinity;

  const loading = isLoading && rooms.length === 0;
  const isRefreshing = isFetching;

  return (
    <DashboardLayout title="Data Rooms">
      <div className="space-y-12 animate-in fade-in duration-700 relative">
        {rooms.length > 0 && (
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 -mb-6 md:-mb-4">
            Bundle assets into shareable secure rooms with access controls
          </p>
        )}

        {isRefreshing && !loading && (
          <div className="absolute top-0 right-0 py-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-deckly-primary rounded-full animate-ping shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            <span className="text-[8px] font-bold uppercase tracking-widest text-deckly-primary/70">
              Syncing...
            </span>
          </div>
        )}

        {!loading && rooms.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-6">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              {/* Usage indicator */}
              <div className="hidden md:flex items-center gap-4 px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(maxRooms, 5) }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                        i < rooms.length
                          ? "bg-deckly-primary shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                          : "bg-white/10"
                      }`}
                    />
                  ))}
                  {isUnlimited && (
                    <span className="text-[10px] font-bold text-deckly-primary ml-1 animate-pulse">
                      ∞
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {rooms.length}
                  {!isUnlimited && ` / ${maxRooms}`} Rooms
                </span>
              </div>

              {/* Create button */}
              <button
                onClick={() => !isAtLimit && navigate("/rooms/new")}
                disabled={isAtLimit}
                className={`hidden sm:flex flex-none items-center justify-center gap-3 px-8 py-3.5 font-bold text-xs uppercase tracking-[0.2em] rounded-2xl transition-all active:scale-[0.98] shadow-2xl ${
                  isAtLimit
                    ? "bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed"
                    : "bg-deckly-primary text-slate-950 hover:bg-deckly-primary/90 shadow-deckly-primary/20"
                }`}
              >
                {isAtLimit ? <Lock size={16} /> : <Plus size={16} />}
                {isAtLimit ? "Room Limit Reached" : "New Room"}
              </button>
            </div>
          </div>
        )}

        {/* Upgrade banner */}
        {isAtLimit && !isUnlimited && (
          <div className="flex items-center gap-5 p-6 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-[2rem] relative overflow-hidden group">
            <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/20 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
              <Zap size={24} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0 relative z-10">
              <p className="text-sm font-bold text-white uppercase tracking-wider">
                {tier === "FREE"
                  ? "Upgrade to Pro for more rooms"
                  : "Go Unlimited with Pro+"}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80 mt-1">
                You've used all {maxRooms} slots on {tier}
              </p>
            </div>
            <button className="px-6 py-2.5 bg-amber-500 text-slate-950 font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-all shrink-0 shadow-xl shadow-amber-500/10 hover:scale-105 active:scale-95">
              Upgrade Now
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 bg-white/5 border border-white/5 rounded-[2rem] animate-pulse"
              />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center glass-shiny border border-white/5 rounded-[3rem] shadow-2xl">
            <div className="w-24 h-24 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center mb-8 relative group">
              <div className="absolute inset-0 bg-deckly-primary/10 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <Monitor
                size={40}
                className="text-slate-600 group-hover:text-deckly-primary transition-all duration-500"
              />
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight uppercase tracking-widest mb-3">
              No data rooms yet
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-10 max-w-xs leading-relaxed">
              Bundle multiple assets into a single shareable link with elite
              security
            </p>
            <button
              onClick={() => navigate("/rooms/new")}
              className="hidden sm:flex items-center gap-3 px-10 py-4 bg-deckly-primary text-slate-950 font-bold text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-deckly-primary/90 transition-all shadow-2xl shadow-deckly-primary/20 hover:scale-105 active:scale-95"
            >
              <Plus size={18} />
              Create First Room
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room: any) => (
              <DataRoomCard
                key={room.id}
                room={room}
                documentCount={room.docCount || 0}
                totalVisitors={room.visitors || 0}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default DataRoomsPage;
