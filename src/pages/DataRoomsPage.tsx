import { Plus, Monitor, Lock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { DataRoomCard } from "../components/dashboard/DataRoomCard";
import { useAuth } from "../contexts/AuthContext";
import { TIER_CONFIG, Tier } from "../constants/tiers";
import { useDataRoomsWithMeta } from "../hooks/useDataRooms";
import { cn } from "@/lib/utils";

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
      <div className="space-y-8 animate-in fade-in duration-700 relative">
        {rooms.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Overview
            </h2>
            <p className="text-sm font-medium text-slate-400">
              Bundle assets into shareable secure rooms with access controls
            </p>
          </div>
        )}

        {isRefreshing && !loading && (
          <div className="absolute top-0 right-0 py-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-deckly-primary rounded-full animate-ping" />
            <span className="text-[10px] font-medium text-deckly-primary/70">
              Syncing...
            </span>
          </div>
        )}

        {!loading && rooms.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              {/* Usage indicator */}
              <div className="flex items-center gap-3 px-4 py-2 bg-[#1a1a1a] border border-[#222] rounded-lg">
                <div className="flex gap-1.5">
                  {Array.from({ length: Math.min(maxRooms, 5) }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-300",
                        i < rooms.length ? "bg-deckly-primary" : "bg-[#222]",
                      )}
                    />
                  ))}
                  {isUnlimited && (
                    <span className="text-xs font-bold text-deckly-primary ml-1 animate-pulse">
                      ∞
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {rooms.length}
                  {!isUnlimited && ` / ${maxRooms}`}
                  <span className="hidden xs:inline ml-1">Rooms</span>
                </span>
              </div>
            </div>

            {/* Create button */}
            <button
              onClick={() => !isAtLimit && navigate("/rooms/new")}
              disabled={isAtLimit}
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-2.5 font-semibold text-xs rounded-lg transition-all active:scale-95 w-full sm:w-auto",
                isAtLimit
                  ? "bg-[#1a1a1a] text-slate-500 border border-[#222] cursor-not-allowed"
                  : "bg-deckly-primary text-slate-950 hover:bg-deckly-primary/90",
              )}
            >
              {isAtLimit ? <Lock size={14} /> : <Plus size={14} />}
              <span>{isAtLimit ? "Limit Reached" : "New Room"}</span>
            </button>
          </div>
        )}

        {/* Upgrade banner */}
        {isAtLimit && !isUnlimited && (
          <div className="flex items-center gap-4 p-5 bg-[#1a140e] border border-amber-900/30 rounded-lg relative overflow-hidden group">
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-center justify-center shrink-0">
              <Zap size={20} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                {tier === "FREE"
                  ? "Upgrade to Pro for more rooms"
                  : "Go Unlimited with Pro+"}
              </p>
              <p className="text-xs text-amber-500/80 mt-0.5">
                You've used all {maxRooms} slots on {tier}
              </p>
            </div>
            <button className="px-5 py-2 bg-amber-500 text-slate-950 font-semibold text-xs rounded-md hover:bg-amber-400 transition-all shrink-0">
              Upgrade
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 bg-[#1a1a1a] border border-[#222] rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-[#1a1a1a] border border-[#222] rounded-lg">
            <div className="w-16 h-16 rounded-lg bg-[#1a1a1a] border border-[#333] flex items-center justify-center mb-6 group">
              <Monitor
                size={32}
                className="text-slate-500 group-hover:text-deckly-primary transition-all duration-300"
              />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              No data rooms yet
            </h3>
            <p className="text-sm text-slate-400 mb-8 max-w-xs px-6">
              Bundle multiple assets into a single shareable link with elite
              security
            </p>
            <button
              onClick={() => navigate("/rooms/new")}
              className="flex items-center gap-2 px-6 py-2.5 bg-deckly-primary text-slate-950 font-semibold text-xs rounded-md transition-all active:scale-95"
            >
              <Plus size={16} />
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
