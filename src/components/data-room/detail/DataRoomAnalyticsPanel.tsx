import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Clock, Eye, Globe, MapPin, Users, ChevronDown } from "lucide-react";
import { Badge } from "../../ui/badge";
import { VisitorSignal } from "../../../services/interestSignalService";
import { cn } from "@/lib/utils";
import {
  AnalyticsEmptyState,
  AnalyticsLocationColumn,
  AnalyticsMetricRow,
  AnalyticsSectionHeader,
  AnalyticsStatCard,
  AnalyticsTabs,
} from "../../analytics/AnalyticsPrimitives";

interface CountryStat {
  name: string;
  count: number;
  code: string;
}

interface CityStat {
  name: string;
  count: number;
  country: string;
}

interface RoomLocations {
  countries: CountryStat[];
  cities: CityStat[];
}

interface RoomDocumentStat {
  deckId: string;
  title: string;
  totalViews: number;
  totalTimeSeconds: number;
  uniqueVisitors: number;
}

interface DataRoomAnalyticsPanelProps {
  totalVisitors: number;
  totalViews: number;
  totalTimeSeconds: number;
  roomLocations: RoomLocations;
  roomDocumentStats: RoomDocumentStat[];
  signalsLoading: boolean;
  roomSignals: VisitorSignal[];
}

type TabKey = "VISITS" | "TIME" | "LOCATION";

export function DataRoomAnalyticsPanel({
  totalVisitors,
  totalViews,
  totalTimeSeconds,
  roomLocations,
  roomDocumentStats,
  signalsLoading,
  roomSignals,
}: DataRoomAnalyticsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("VISITS");
  const [expandedVisitor, setExpandedVisitor] = useState<string | null>(null);

  const avgTimePerView = totalViews > 0 ? totalTimeSeconds / totalViews : 0;
  const maxViews = useMemo(
    () => Math.max(...roomDocumentStats.map((s) => s.totalViews), 1),
    [roomDocumentStats],
  );
  const maxTime = useMemo(
    () => Math.max(...roomDocumentStats.map((s) => s.totalTimeSeconds), 1),
    [roomDocumentStats],
  );
  const roomDocumentLookup = useMemo(
    () => new Map(roomDocumentStats.map((doc) => [doc.deckId, doc.title])),
    [roomDocumentStats],
  );

  const sortedDocs = useMemo(() => {
    const docs = [...roomDocumentStats];
    return docs.sort((a, b) => {
      if (activeTab === "TIME") {
        return b.totalTimeSeconds - a.totalTimeSeconds || b.totalViews - a.totalViews;
      }
      return b.totalViews - a.totalViews || b.totalTimeSeconds - a.totalTimeSeconds;
    });
  }, [activeTab, roomDocumentStats]);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-16 space-y-8 md:space-y-16">
      {/* Top stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AnalyticsStatCard icon={<Eye size={16} />} label="Total Views" value={totalViews.toLocaleString()} />
        <AnalyticsStatCard icon={<Clock size={16} />} label="Total Time" value={`${Math.round(totalTimeSeconds)}s`} />
        <AnalyticsStatCard icon={<Users size={16} />} label="Unique Visitors" value={totalVisitors.toLocaleString()} />
        <AnalyticsStatCard icon={<BarChart3 size={16} />} label="Avg Session" value={`${avgTimePerView.toFixed(1)}s`} />
      </div>

      {/* Document engagement */}
      <div className="bg-surface-card rounded-lg p-4 md:p-8 shadow-sm">
        <div className="flex flex-col space-y-8">
          <AnalyticsSectionHeader
            icon={<BarChart3 size={16} className="text-primary" />}
            title="Engagement per Document"
            tabs={
              <AnalyticsTabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as TabKey)}
                className="w-full md:w-auto"
                tabs={[
                  { value: "VISITS", label: "Visits" },
                  { value: "TIME", label: "Duration" },
                  { value: "LOCATION", label: "Location" },
                ]}
              />
            }
          />

          <div className="space-y-6 max-w-4xl mx-auto w-full pt-8">
            {activeTab === "LOCATION" ? (
              !roomLocations ||
              (roomLocations.countries.length === 0 &&
                roomLocations.cities.length === 0) ? (
                <AnalyticsEmptyState
                  icon={<Globe size={32} />}
                  text="No location data captured yet."
                />
              ) : (
                <div className="grid md:grid-cols-2 gap-12">
                  <AnalyticsLocationColumn
                    icon={<Globe size={14} className="text-primary" />}
                    title="Top Countries"
                    items={roomLocations.countries}
                    max={roomLocations.countries[0]?.count || 1}
                    renderLabel={(item) => item.name}
                    barClassName="bg-primary"
                  />
                  <AnalyticsLocationColumn
                    icon={<MapPin size={14} className="text-primary" />}
                    title="Top Cities"
                    items={roomLocations.cities}
                    max={roomLocations.cities[0]?.count || 1}
                    renderLabel={(item) => item.name}
                    barClassName="bg-surface-high"
                  />
                </div>
              )
            ) : roomDocumentStats.length === 0 ? (
              <AnalyticsEmptyState
                icon={<BarChart3 size={32} />}
                text="No document activity recorded yet."
              />
            ) : (
              <div className="space-y-4 md:space-y-5">
                {sortedDocs.map((doc) => {
                  const value =
                    activeTab === "TIME" ? doc.totalTimeSeconds : doc.totalViews;
                  const percent =
                    activeTab === "TIME"
                      ? (value / maxTime) * 100
                      : (value / maxViews) * 100;
                  const suffix = activeTab === "TIME" ? "s" : " Visits";
                  const barColor =
                    activeTab === "TIME" ? "bg-[#334155]" : "bg-primary";

                  return (
                    <AnalyticsMetricRow
                      key={doc.deckId}
                      leftLabel={
                        <span
                          className="min-w-0 text-xs md:text-sm text-muted-foreground truncate"
                          title={doc.title}
                        >
                          {doc.title}
                        </span>
                      }
                      valueLabel={
                        activeTab === "TIME"
                          ? `${Math.round(doc.totalTimeSeconds)}${suffix}`
                          : `${doc.totalViews}${suffix}`
                      }
                      percent={percent}
                      barClassName={barColor}
                      valueClassName={cn(
                        activeTab === "TIME"
                          ? "text-foreground"
                          : "text-primary-foreground",
                      )}
                      title={doc.title}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visitor signals */}
      <div className="bg-surface-card rounded-lg p-4 md:p-8 shadow-sm">
        <div className="space-y-8 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-surface-lowest flex items-center justify-center text-primary">
              <Users size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                Individual Visitors
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visitor activity by deck
              </p>
            </div>
            {roomSignals.length > 0 && (
              <Badge className="ml-auto bg-primary text-primary-foreground font-medium text-xs px-3 py-1 rounded w-fit">
                {roomSignals.length} Viewer{roomSignals.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {signalsLoading ? (
            <div className="py-20 flex flex-col items-center gap-4 text-muted-foreground">
              <div className="w-12 h-12 border-4 border-border border-t-primary rounded-full animate-spin" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                Loading visitor activity...
              </p>
            </div>
          ) : roomSignals.length === 0 ? (
            <AnalyticsEmptyState
              icon={<Users size={32} />}
              text="No visitor activity recorded yet."
            />
          ) : (
            <div className="space-y-4">
              {roomSignals.map((visitor, idx) => {
                const isOpen = expandedVisitor === visitor.visitorId;
                const deckBreakdown = visitor.deckBreakdown ?? [];

                return (
                  <motion.div
                    key={visitor.visitorId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      "rounded-md overflow-hidden",
                      isOpen ? "bg-surface-highest" : "bg-surface-low",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedVisitor(isOpen ? null : visitor.visitorId)
                      }
                      className={cn(
                        "w-full text-left p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors",
                        isOpen ? "bg-surface-highest" : "hover:bg-surface-high/40",
                      )}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-surface-card flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-primary">
                            V{idx + 1}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate max-w-[180px] md:max-w-xs">
                            {visitor.viewerEmail?.toLowerCase() ||
                              "Anonymous Viewer"}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground font-medium">
                              {visitor.totalVisits} Views
                            </span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className="text-xs text-muted-foreground font-medium">
                              {visitor.totalTime}s Spend
                            </span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className="text-xs text-muted-foreground font-medium">
                              {visitor.distinctDays} Day
                              {visitor.distinctDays > 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                        <div className="text-right hidden md:block">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                            Decks
                          </p>
                          <p className="text-xs font-semibold text-foreground mt-1">
                            {deckBreakdown.length} visited
                          </p>
                        </div>
                        <div className={cn(
                          "w-10 h-10 rounded-xl bg-surface-card flex items-center justify-center transition-all",
                          isOpen && "bg-primary text-primary-foreground",
                        )}>
                          <ChevronDown
                            size={18}
                            className={cn(
                              "transition-transform duration-300",
                              isOpen && "rotate-180",
                            )}
                          />
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border/60 bg-[#0e0e0e] p-4 md:p-6 space-y-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                          Visited Decks
                        </p>

                        {deckBreakdown.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No per-deck breakdown available for this visitor.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {deckBreakdown.map((deck) => (
                              <div
                                key={deck.deckId}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md bg-surface-lowest px-4 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">
                                    {roomDocumentLookup.get(deck.deckId) ??
                                      "Untitled Deck"}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {deck.deckId}
                                  </p>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                                  <span>{deck.totalVisits} visits</span>
                                  <span>{deck.totalTime}s total</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
