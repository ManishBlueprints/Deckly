import { Plus, Monitor, Lock, Zap, Users } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { WorkspaceShell } from "../components/layout/WorkspaceShell";
import { DataRoomCard } from "../components/dashboard/DataRoomCard";
import { useAuth } from "../contexts/AuthContext";
import { TIER_CONFIG, type Tier } from "../constants/tiers";
import { useMyEntitlements } from "../hooks/useTierEntitlements";
import { buildUpgradeUrl } from "../services/upgradeAttribution";
import { useDataRooms } from "../hooks/useDataRooms";
import { cn } from "@/lib/utils";
import { DataRoom } from "../types";
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
  const entitlements = useMyEntitlements(Boolean(profile), profile?.tier as Tier | undefined);
  const search = useMetadataSearchState("data_room");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  const { data: rooms = [], isLoading, isFetching } = useDataRooms();
  const {
    data: roomDocumentSummariesByRoomId = {},
    isFetching: isFetchingDocuments,
  } = useQuery({
    queryKey: ["data-rooms", "search-document-summaries", rooms.map((room: DataRoom) => room.id)],
    queryFn: () => dataRoomService.getDocumentSearchSummariesForRooms(
      rooms.map((room: DataRoom) => room.id),
    ),
    enabled: rooms.length > 0,
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

  const tier: Tier = entitlements.data?.tier ?? (profile?.tier as Tier) ?? "FREE";
  const tierLabel = entitlements.data?.label ?? TIER_CONFIG[tier].planLabel;
  const maxRooms = entitlements.data?.limits.maxDataRooms ?? TIER_CONFIG[tier].maxDataRooms;
  const isUnlimited = maxRooms === -1;
  const isAtLimit = !entitlements.isLoading && !isUnlimited && rooms.length >= maxRooms;

  const loading = isLoading && rooms.length === 0;
  const isRefreshing = isFetching || isFetchingMeta || isFetchingDocuments;
  const hasActiveSearch = search.isActive || selectedTagId !== null;
  const availableFilterOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>();
    Object.values(roomDocumentSummariesByRoomId).flat().forEach((document) => {
      (document.tags ?? []).forEach((tag) => {
        if (!seen.has(tag.id)) {
          seen.set(tag.id, { id: tag.id, name: tag.name, color: tag.color });
        }
      });
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [roomDocumentSummariesByRoomId]);

  useEffect(() => {
    if (selectedTagId && !availableFilterOptions.some((tag) => tag.id === selectedTagId)) {
      setSelectedTagId(null);
    }
  }, [availableFilterOptions, selectedTagId]);

  const filteredRooms = useMemo(
    () =>
      filterDataRoomOverviewRooms(
        rooms,
        roomDocumentSummariesByRoomId,
        search.filter,
        selectedTagId,
      ),
    [roomDocumentSummariesByRoomId, rooms, search.filter, selectedTagId],
  );

  return (
    <WorkspaceShell title="Rooms" primaryAction={{ label: "New room", href: "/rooms/new" }}>
      <DataRoomTour hasRooms={rooms.length > 0} isLoading={loading} />
      <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:pt-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ui-text sm:text-4xl">Rooms</h1>
          <p className="mt-2 text-sm text-ui-muted sm:text-base">Bundle documents into secure, shareable workspaces.</p>
        </div>
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
          <RoomsUpgradeBanner
            tierLabel={tierLabel}
            maxRooms={maxRooms}
            onUpgrade={() => navigate(buildUpgradeUrl("data_room_limit"))}
          />
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
    </WorkspaceShell>
  );
}

export default DataRoomsPage;

function RoomsOverview() {
  return (
    <div className="flex items-center gap-3 text-sm text-ui-muted">
      <Users size={18} />
      <span>Secure rooms with access controls and engagement tracking</span>
    </div>
  );
}

function RoomsSyncing() {
  return (
    <div className="flex items-center gap-2 text-ui-primary">
      <div className="h-2 w-2 animate-ping rounded-full bg-ui-primary" />
      <span className="text-xs font-medium">
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
    <div className="flex flex-col gap-3 rounded-lg border border-ui-border bg-ui-surface p-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 items-center gap-3 px-2.5">
          <div className="flex gap-1.5">
            {Array.from({ length: isUnlimited ? 5 : Math.min(maxRooms, 5) }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  i < rooms ? "bg-ui-primary" : "bg-ui-border",
                )}
              />
            ))}
            {isUnlimited && (
              <span className="ml-1 text-xs font-bold text-ui-primary">
                ∞
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-ui-muted">
            {rooms}
            {!isUnlimited && ` / ${maxRooms}`}
            <span className="hidden xs:inline ml-1">Rooms</span>
          </span>
        </div>
      </div>

      <div className="flex w-full items-center gap-2 sm:w-auto">
        {searchControl}
        <button
          onClick={() => !isAtLimit && onCreate()}
          disabled={isAtLimit}
          data-tour="new-room-btn"
          className={cn(
            "flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-xs font-semibold transition-colors active:scale-[0.98] sm:w-auto",
            isAtLimit
              ? "cursor-not-allowed border border-ui-border bg-ui-subtle text-ui-muted"
              : "bg-ui-primary text-ui-primary-text hover:brightness-105",
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
    <div className="flex min-h-72 flex-col items-center justify-center rounded-[24px] border border-ui-border bg-ui-surface py-16 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-[14px] border border-ui-border bg-ui-subtle">
        <Monitor size={26} className="text-ui-muted" />
      </div>
      <h2 className="mb-2 text-lg font-semibold text-ui-text">No matching rooms</h2>
      <p className="mb-8 max-w-sm px-6 text-sm text-ui-muted">
        Try another room name, file title, or tag, or clear the current search.
      </p>
      <button
        onClick={onClear}
        className="flex items-center gap-2 rounded-[12px] bg-ui-primary px-6 py-2.5 text-xs font-semibold text-ui-primary-text"
      >
        Clear Search
      </button>
    </div>
  );
}

function RoomsUpgradeBanner({
  tierLabel,
  maxRooms,
  onUpgrade,
}: {
  tierLabel: string;
  maxRooms: number;
  onUpgrade: () => void;
}) {
  return (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-[18px] border border-ui-warning/30 bg-ui-warning/10 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-ui-warning/15">
        <Zap size={20} className="text-ui-warning" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ui-text">
          {tierLabel === TIER_CONFIG.FREE.planLabel
            ? "Upgrade to Founder for more rooms"
            : "Choose a higher plan for more rooms"}
        </p>
        <p className="mt-0.5 text-xs text-ui-text">
          You've used all {maxRooms} {maxRooms === 1 ? "slot" : "slots"} on {tierLabel}
        </p>
      </div>
      <button onClick={onUpgrade} className="shrink-0 rounded-[10px] bg-ui-warning px-5 py-2 text-xs font-semibold text-ui-canvas">
        Upgrade
      </button>
    </div>
  );
}

function RoomsLoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-72 animate-pulse rounded-[18px] border border-ui-border bg-ui-subtle"
        />
      ))}
    </div>
  );
}

function RoomsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[440px] flex-col items-center justify-center rounded-[24px] border border-ui-border bg-ui-surface px-6 py-20 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-[14px] border border-ui-border bg-ui-subtle">
        <Monitor
          size={32}
          className="text-ui-primary"
        />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-ui-text">
        No rooms yet
      </h2>
      <p className="mb-8 max-w-sm px-6 text-sm leading-6 text-ui-muted">
        Bundle decks and documents into one secure link, then control access and track engagement.
      </p>
      <button
        onClick={onCreate}
        data-tour="new-room-btn"
        className="flex items-center gap-2 rounded-[12px] bg-ui-primary px-6 py-2.5 text-xs font-semibold text-ui-primary-text"
      >
        <Plus size={16} />
        Create First Room
      </button>
    </div>
  );
}
