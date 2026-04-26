import { Plus, Monitor, Lock, Zap } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { DataRoomCard } from "../components/dashboard/DataRoomCard";
import { useAuth } from "../contexts/AuthContext";
import { TIER_CONFIG, Tier } from "../constants/tiers";
import { useDataRooms } from "../hooks/useDataRooms";
import { cn } from "@/lib/utils";
import { DataRoom, DataRoomDocument } from "../types";
import { DataRoomTour } from "../components/tours/DataRoomTour";
import { useQuery } from "@tanstack/react-query";
import { dataRoomService } from "../services/dataRoomService";
import { MetadataSearchMenu } from "../components/search/MetadataSearchMenu";
import { useMetadataSearchState } from "../hooks/useMetadataSearchState";
import {
  filterDataRoomOverviewRooms,
  type DataRoomOverviewSearchResult,
} from "../utils/metadataSearchAdapters";

function DataRoomsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const search = useMetadataSearchState("data_room");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  const { data: rooms = [], isLoading, isFetching } = useDataRooms();
  const shouldLoadRoomDocuments =
    (search.filter.mode === "name" &&
      search.filter.query.trim().length > 0) ||
    selectedTagId !== null;
  const { data: roomDocumentsByRoomId = {} } = useQuery({
    queryKey: ["data-rooms", "search-documents", rooms.map((room: DataRoom) => room.id)],
    queryFn: async () => {
      const entries = await Promise.all(
        rooms.map(async (room: DataRoom) => {
          const documents = await dataRoomService.getDocuments(room.id);
          return [room.id, documents] as const;
        }),
      );

      return Object.fromEntries(entries) as Record<string, DataRoomDocument[]>;
    },
    enabled:
      rooms.length > 0 && shouldLoadRoomDocuments,
    staleTime: 30000,
  });
  const { data: roomMetaById = {}, isFetching: isFetchingMeta } = useQuery({
    queryKey: ["data-rooms", "with-meta", rooms.map((room: DataRoom) => room.id)],
    queryFn: async () => {
      if (rooms.length === 0) return {};

      try {
        const batchAnalytics = await dataRoomService.getBatchDataRoomAnalytics(
          rooms.map((room: DataRoom) => room.id),
        );

        return Object.fromEntries(
          rooms.map((room: DataRoom) => [
            room.id,
            {
              docCount: batchAnalytics.get(room.id)?.docCount ?? 0,
              visitors: batchAnalytics.get(room.id)?.visitors ?? 0,
            },
          ]),
        ) as Record<string, { docCount: number; visitors: number }>;
      } catch (error) {
        console.warn("Batch analytics failed, using individual calls", error);
        const richRooms = await Promise.all(
          rooms.map(async (room: DataRoom) => {
            const [docCount, analytics] = await Promise.all([
              dataRoomService.getDocumentCount(room.id),
              dataRoomService.getDataRoomAnalytics(room.id),
            ]);
            return [
              room.id,
              {
                docCount,
                visitors: analytics.totalVisitors,
              },
            ] as const;
          }),
        );

        return Object.fromEntries(richRooms) as Record<
          string,
          { docCount: number; visitors: number }
        >;
      }
    },
    enabled: rooms.length > 0,
    staleTime: 30000,
  });

  const tier: Tier = (profile?.tier as Tier) || "FREE";
  const tierConfig = TIER_CONFIG[tier];
  const maxRooms = tierConfig.maxDataRooms;
  const isUnlimited = maxRooms === -1;
  const isAtLimit = !isUnlimited && rooms.length >= maxRooms;

  const loading = isLoading && rooms.length === 0;
  const isRefreshing = isFetching || isFetchingMeta;
  const hasActiveSearch = search.isActive || selectedTagId !== null;
  const availableFilterOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>();
    Object.values(roomDocumentsByRoomId).flat().forEach((document) => {
      (document.tags ?? []).forEach((tag) => {
        if (!seen.has(tag.id)) {
          seen.set(tag.id, { id: tag.id, name: tag.name, color: tag.color });
        }
      });
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [roomDocumentsByRoomId]);

  useEffect(() => {
    if (selectedTagId && !availableFilterOptions.some((tag) => tag.id === selectedTagId)) {
      setSelectedTagId(null);
    }
  }, [availableFilterOptions, selectedTagId]);

  const filteredRooms = useMemo(
    () =>
      filterDataRoomOverviewRooms(
        rooms,
        roomDocumentsByRoomId,
        search.filter,
        selectedTagId,
      ),
    [roomDocumentsByRoomId, rooms, search.filter, selectedTagId],
  );

  return (
    <DashboardLayout title="Data Rooms">
      <DataRoomTour hasRooms={rooms.length > 0} isLoading={loading} />
      <div className="space-y-8 animate-in fade-in duration-700 relative">
        {rooms.length > 0 && <RoomsOverview />}

        {isRefreshing && !loading && <RoomsSyncing />}

        {!loading && rooms.length > 0 && (
          <RoomsActions
            rooms={rooms.length}
            maxRooms={maxRooms}
            isUnlimited={isUnlimited}
            isAtLimit={isAtLimit}
            searchControl={
              <MetadataSearchMenu
                filter={search.filter}
                isActive={hasActiveSearch}
                onModeChange={search.setMode}
                onQueryChange={search.setQuery}
                onDatePresetChange={search.setDatePreset}
                onCustomDateRangeChange={search.setCustomDateRange}
                onClear={() => {
                  search.resetFilter();
                  setSelectedTagId(null);
                }}
                resultCount={filteredRooms.length}
                triggerLabel="Search"
                namePlaceholder="Search rooms or file titles..."
                filterOptions={availableFilterOptions}
                selectedFilterId={selectedTagId}
                onFilterChange={setSelectedTagId}
                filterEmptyMessage="No tags created"
              />
            }
            onCreate={() => navigate("/rooms/new")}
          />
        )}

        {/* Upgrade banner */}
        {isAtLimit && !isUnlimited && (
          <RoomsUpgradeBanner tier={tier} maxRooms={maxRooms} />
        )}

        {/* Content */}
        {loading ? (
          <RoomsLoadingGrid />
        ) : rooms.length === 0 ? (
          <RoomsEmptyState onCreate={() => navigate("/rooms/new")} />
        ) : hasActiveSearch && filteredRooms.length === 0 ? (
          <RoomsNoResults
            onClear={() => {
              search.resetFilter();
              setSelectedTagId(null);
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map(({ room, matchedDocumentTitles, matchedTagNames }: DataRoomOverviewSearchResult) => (
            <DataRoomCard
              key={room.id}
              room={room}
              documentCount={roomMetaById[room.id]?.docCount ?? room.docCount ?? 0}
              totalVisitors={roomMetaById[room.id]?.visitors ?? room.visitors ?? 0}
              matchedDocumentTitles={matchedDocumentTitles}
              matchedTagNames={matchedTagNames}
            />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default DataRoomsPage;

function RoomsOverview() {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Overview
      </h2>
      <p className="text-sm font-medium text-slate-400">
        Bundle assets into shareable secure rooms with access controls
      </p>
    </div>
  );
}

function RoomsSyncing() {
  return (
    <div className="absolute top-0 right-0 py-2 flex items-center gap-2">
      <div className="w-2 h-2 bg-deckly-primary rounded-full animate-ping" />
      <span className="text-[10px] font-medium text-deckly-primary/70">
        Syncing...
      </span>
    </div>
  );
}

function RoomsActions({
  rooms,
  maxRooms,
  isUnlimited,
  isAtLimit,
  searchControl,
  onCreate,
}: {
  rooms: number;
  maxRooms: number;
  isUnlimited: boolean;
  isAtLimit: boolean;
  searchControl: ReactNode;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 px-4 py-2 bg-surface-card border border-border rounded-lg">
          <div className="flex gap-1.5">
            {Array.from({ length: isUnlimited ? 5 : Math.min(maxRooms, 5) }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  i < rooms ? "bg-deckly-primary" : "bg-surface-lowest",
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
            {rooms}
            {!isUnlimited && ` / ${maxRooms}`}
            <span className="hidden xs:inline ml-1">Rooms</span>
          </span>
        </div>
      </div>

      <div className="flex w-full sm:w-auto items-center justify-end gap-3">
        {searchControl}
        <button
          onClick={() => !isAtLimit && onCreate()}
          disabled={isAtLimit}
          data-tour="new-room-btn"
          className={cn(
            "flex items-center justify-center gap-2 px-6 py-2.5 font-semibold text-xs rounded-lg transition-all active:scale-95 w-full sm:w-auto",
            isAtLimit
              ? "bg-surface-low text-slate-500 border border-[#222] cursor-not-allowed"
              : "bg-deckly-primary text-slate-950 hover:bg-deckly-primary/90",
          )}
        >
          {isAtLimit ? <Lock size={14} /> : <Plus size={14} />}
          <span>{isAtLimit ? "Limit Reached" : "New Room"}</span>
        </button>
      </div>
    </div>
  );
}

function RoomsNoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-[#1a1a1a] border border-[#222] rounded-lg">
      <div className="w-16 h-16 rounded-lg bg-[#1a1a1a] border border-[#333] flex items-center justify-center mb-6 group">
        <Monitor size={32} className="text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No matching data rooms</h3>
      <p className="text-sm text-slate-400 mb-8 max-w-sm px-6">
        Try another room name, file title, or tag, or clear the current search.
      </p>
      <button
        onClick={onClear}
        className="flex items-center gap-2 px-6 py-2.5 bg-deckly-primary text-slate-950 font-semibold text-xs rounded-md transition-all active:scale-95"
      >
        Clear Search
      </button>
    </div>
  );
}

function RoomsUpgradeBanner({
  tier,
  maxRooms,
}: {
  tier: Tier;
  maxRooms: number;
}) {
  return (
    <div className="flex items-center gap-4 p-5 bg-[#1a140e] border border-amber-900/30 rounded-lg relative overflow-hidden group">
      <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-center justify-center shrink-0">
        <Zap size={20} className="text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">
          {tier === "FREE" ? "Upgrade to Pro for more rooms" : "Go Unlimited with Pro+"}
        </p>
        <p className="text-xs text-amber-500/80 mt-0.5">
          You've used all {maxRooms} slots on {tier}
        </p>
      </div>
      <button className="px-5 py-2 bg-amber-500 text-slate-950 font-semibold text-xs rounded-md hover:bg-amber-400 transition-all shrink-0">
        Upgrade
      </button>
    </div>
  );
}

function RoomsLoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-32 bg-[#1a1a1a] border border-[#222] rounded-lg animate-pulse"
        />
      ))}
    </div>
  );
}

function RoomsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
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
        onClick={onCreate}
        data-tour="new-room-btn"
        className="flex items-center gap-2 px-6 py-2.5 bg-deckly-primary text-slate-950 font-semibold text-xs rounded-md transition-all active:scale-95"
      >
        <Plus size={16} />
        Create First Room
      </button>
    </div>
  );
}
