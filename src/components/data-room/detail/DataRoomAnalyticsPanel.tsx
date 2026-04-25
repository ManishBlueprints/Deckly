import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Clock, Eye, Globe, MapPin, Users } from "lucide-react";
import { Badge } from "../../ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../../ui/tabs";
import { InterestSignalBadge } from "../../dashboard/InterestSignalBadge";
import { VisitorSignal } from "../../../services/interestSignalService";
import { cn } from "@/lib/utils";

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
        <StatItem icon={<Eye size={16} />} label="Total Views" value={totalViews.toLocaleString()} />
        <StatItem icon={<Clock size={16} />} label="Total Time" value={`${Math.round(totalTimeSeconds)}s`} />
        <StatItem icon={<Users size={16} />} label="Unique Visitors" value={totalVisitors.toLocaleString()} />
        <StatItem icon={<BarChart3 size={16} />} label="Avg Session" value={`${avgTimePerView.toFixed(1)}s`} />
      </div>

      {/* Document engagement */}
      <div className="bg-surface-card rounded-lg p-4 md:p-8 shadow-sm">
        <div className="flex flex-col space-y-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-3 md:flex-1">
              <div className="w-8 h-8 rounded-md bg-surface-lowest flex items-center justify-center border border-border">
                <BarChart3 size={16} className="text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                Engagement per Document
              </h3>
            </div>

            <div className="flex-1 flex justify-center">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as TabKey)}
                className="w-full md:w-auto"
              >
                <div className="w-full overflow-x-auto custom-scrollbar flex justify-center">
                  <TabsList className="bg-surface-lowest border border-border p-1 h-auto rounded-md gap-1 flex shrink-0 w-fit">
                    <TabsTrigger
                      value="VISITS"
                      className="rounded-sm text-[11px] font-bold px-4 py-1.5 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 whitespace-nowrap shrink-0"
                    >
                      Visits
                    </TabsTrigger>
                    <TabsTrigger
                      value="TIME"
                      className="rounded-sm text-[11px] font-bold px-4 py-1.5 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 whitespace-nowrap shrink-0"
                    >
                      Duration
                    </TabsTrigger>
                    <TabsTrigger
                      value="LOCATION"
                      className="rounded-sm text-[11px] font-bold px-4 py-1.5 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 whitespace-nowrap shrink-0"
                    >
                      Location
                    </TabsTrigger>
                  </TabsList>
                </div>
              </Tabs>
            </div>

            <div className="hidden md:block md:flex-1" />
          </div>

          <div className="space-y-6 max-w-4xl mx-auto w-full pt-8">
            {activeTab === "LOCATION" ? (
              !roomLocations ||
              (roomLocations.countries.length === 0 &&
                roomLocations.cities.length === 0) ? (
                <EmptyState
                  icon={<Globe size={32} />}
                  text="No location data captured yet."
                />
              ) : (
                <div className="grid md:grid-cols-2 gap-12">
                  <LocationColumn
                    icon={<Globe size={14} className="text-primary" />}
                    title="Top Countries"
                    items={roomLocations.countries}
                    max={roomLocations.countries[0]?.count || 1}
                    renderLabel={(item) => item.name}
                    barClassName="bg-primary"
                  />
                  <LocationColumn
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
              <EmptyState
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
                    <div
                      key={doc.deckId}
                      className="grid gap-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-center sm:gap-4"
                    >
                      <span
                        className="min-w-0 text-xs md:text-sm text-muted-foreground truncate"
                        title={doc.title}
                      >
                        {doc.title}
                      </span>
                      <div
                        className="relative min-w-0 h-10 bg-surface-low border border-border overflow-hidden"
                        title={doc.title}
                      >
                        <div
                          className={cn(
                            "h-full flex items-center justify-end px-4 transition-all duration-300",
                            barColor,
                          )}
                          style={{ width: `${Math.max(percent, 4)}%` }}
                        >
                          <span
                            className={cn(
                              "text-sm font-medium whitespace-nowrap",
                              activeTab === "TIME"
                                ? "text-foreground"
                                : "text-primary-foreground",
                            )}
                          >
                            {activeTab === "TIME"
                              ? `${Math.round(doc.totalTimeSeconds)}${suffix}`
                              : `${doc.totalViews}${suffix}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visitor signals */}
      <div className="bg-surface-card rounded-lg p-4 md:p-8 shadow-sm">
        <div className="space-y-10 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-deckly-primary">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Individual Visitors
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Visitor activity and engagement</p>
                </div>
            {roomSignals.length > 0 && (
              <Badge className="md:ml-auto mt-2 md:mt-0 bg-deckly-primary text-slate-950 font-medium text-xs px-3 py-1 rounded w-fit">
                {roomSignals.length} Viewer{roomSignals.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {signalsLoading ? (
            <div className="py-20 flex flex-col items-center gap-4 text-slate-700">
              <div className="w-12 h-12 border-4 border-white/5 border-t-deckly-primary rounded-full animate-spin shadow-2xl shadow-deckly-primary/10" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Analyzing deep signals...</p>
            </div>
          ) : roomSignals.length === 0 ? (
            <div className="py-20 text-center space-y-6">
              <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-center mx-auto text-slate-700 relative">
                <div className="absolute inset-0 bg-deckly-primary/5 blur-2xl rounded-full" />
                <Users size={40} className="relative z-10" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No signals identified yet</p>
                <p className="text-[10px] text-slate-700 max-w-xs mx-auto font-bold uppercase tracking-widest leading-loose">
                  Insights appear when visitors show deep interaction.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {roomSignals.map((visitor, idx) => (
                  <motion.div
                  key={visitor.visitorId}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                    className={cn(
                      "rounded-md border transition-all duration-200 overflow-hidden cursor-pointer",
                      expandedVisitor === visitor.visitorId
                        ? "bg-[#2a2a2a] border-border"
                        : "bg-surface-low border-border hover:border-border hover:bg-[#2a2a2a]",
                    )}
                  onClick={() => setExpandedVisitor(expandedVisitor === visitor.visitorId ? null : visitor.visitorId)}
                >
                  <div className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-deckly-primary">V{idx + 1}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white truncate max-w-[180px] md:max-w-xs">
                            {visitor.viewerEmail?.toLowerCase() || "Anonymous Viewer"}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500 font-medium">{visitor.totalVisits} Views</span>
                            <span className="w-1 h-1 rounded-full bg-[#333]" />
                            <span className="text-xs text-slate-500 font-medium">{visitor.totalTime}s Spend</span>
                            <span className="w-1 h-1 rounded-full bg-[#333]" />
                            <span className="text-xs text-slate-500 font-medium">{visitor.distinctDays} Day{visitor.distinctDays > 1 ? "s" : ""}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                        <div className="text-right hidden md:block">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Intensity</p>
                          <div className="flex gap-0.5 mt-1.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div key={i} className={cn("w-3 h-1 rounded-full", i <= visitor.signals.length ? "bg-deckly-primary" : "bg-[#222]")} />
                            ))}
                          </div>
                        </div>
                        <div className={cn("w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center transition-all", expandedVisitor === visitor.visitorId && "bg-deckly-primary text-slate-950")}>
                          <svg viewBox="0 0 24 24" className={cn("w-4 h-4 transition-transform duration-500", expandedVisitor === visitor.visitorId && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {visitor.signals.map((signal) => (
                        <InterestSignalBadge key={signal} signal={signal} />
                      ))}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedVisitor === visitor.visitorId && visitor.slideBreakdown.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="bg-black/20 border-t border-white/5"
                      >
                        <div className="p-6">
                          <p className="text-xs font-semibold text-slate-400 mb-6">Deep Interaction Timeline</p>
                          <div className="flex items-end gap-1.5 h-[200px] overflow-x-auto pb-8 scrollbar-hide relative group/chart">
                            {(() => {
                              const maxT = Math.max(...visitor.slideBreakdown.map((s) => s.time), 1);
                              return visitor.slideBreakdown.map((slide) => {
                                const percent = (slide.time / maxT) * 100;
                                const mins = Math.floor(slide.time / 60);
                                const secs = slide.time % 60;
                                const tLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                                return (
                                  <div key={slide.page} className="flex flex-col items-center flex-1 min-w-[32px] group/bar relative h-full justify-end">
                                    <div className="absolute -top-6 opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap">
                                      <span className="text-[9px] font-bold text-deckly-primary bg-deckly-primary/10 px-2 py-1 rounded border border-deckly-primary/20">
                                        {tLabel}
                                      </span>
                                    </div>
                                    <motion.div
                                      initial={{ height: 0 }}
                                      animate={{ height: `${Math.max(percent, 4)}%` }}
                                      transition={{ duration: 0.8, delay: slide.page * 0.02 }}
                                      className={cn(
                                        "w-full rounded-t-lg transition-all duration-300 relative overflow-hidden",
                                        percent > 70 ? "bg-deckly-primary" : percent > 30 ? "bg-emerald-500" : "bg-emerald-800",
                                      )}
                                    />
                                    <span className="text-[9px] font-bold text-slate-700 mt-2 absolute -bottom-5">P{slide.page}</span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col bg-surface-card rounded-lg p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-md bg-surface-lowest flex items-center justify-center text-primary">
          {icon}
        </div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="py-20 text-center space-y-6">
      <div className="w-24 h-24 bg-surface-low rounded-[2.5rem] flex items-center justify-center mx-auto text-muted-foreground relative">
        <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-full" />
        {icon}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{text}</p>
      </div>
    </div>
  );
}

function LocationColumn<T extends { count: number }>({
  icon,
  title,
  items,
  max,
  renderLabel,
  barClassName,
}: {
  icon: React.ReactNode;
  title: string;
  items: T[];
  max: number;
  renderLabel: (item: T) => string;
  barClassName: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h4>
      </div>
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={`${renderLabel(item)}-${i}`} className="space-y-2">
            <div className="flex justify-between text-[11px] font-medium">
              <span className="text-foreground flex items-center gap-2">
                <span className="text-muted-foreground">#{i + 1}</span>
                {renderLabel(item)}
              </span>
            </div>
            <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(item.count / max) * 100}%` }}
                className={cn("h-full", barClassName)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
