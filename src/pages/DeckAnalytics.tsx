import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  ArrowLeft,
  Bookmark,
  MessageSquare,
  AlertCircle,
  Clock,
  BarChart3,
  Users,
  ChevronDown,
  FileText,
  Loader2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { InterestSignalBadge } from "../components/dashboard/InterestSignalBadge";
import { useDeck } from "../hooks/useDecks";
import {
  useDeckStats,
  useDeckBookmarks,
  useVisitorSignals,
  useUniqueVisitorCount,
} from "../hooks/useDeckAnalyticsData";

interface BookmarkData {
  created_at: string;
  profiles?: {
    full_name?: string;
  };
}

export default function DeckAnalytics() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const { session, isPro } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "VISITS" | "TIME" | "DROPOFF" | "SAVES"
  >("VISITS");
  const [expandedVisitor, setExpandedVisitor] = useState<string | null>(null);

  // Queries
  const {
    data: deck,
    isLoading: deckLoading,
    error: deckError,
  } = useDeck(deckId, session?.user?.id);
  const {
    data: stats = [],
    isLoading: statsLoading,
    isFetching: statsFetching,
  } = useDeckStats(deckId, !!isPro, session?.user?.id);
  const { data: bookmarks = [], isFetching: bookmarksFetching } =
    useDeckBookmarks(deckId);
  const {
    data: visitorSignals = [],
    isLoading: signalsLoading,
    isFetching: signalsFetching,
  } = useVisitorSignals(deckId);
  const { data: uniqueVisitors = 0, isFetching: uniqueFetching } =
    useUniqueVisitorCount(deckId);

  const loading = deckLoading || (stats.length === 0 && statsLoading);
  const isRefreshing =
    statsFetching || bookmarksFetching || signalsFetching || uniqueFetching;
  const error = deckError ? "Failed to load analytics data." : null;
  const totalSaves = bookmarks.length;

  // Derived Stats

  const totalSeconds = useMemo(
    () => stats.reduce((acc, curr) => acc + curr.total_time_seconds, 0),
    [stats],
  );
  const avgTimePerView = useMemo(
    () =>
      uniqueVisitors > 0 ? (totalSeconds / uniqueVisitors).toFixed(1) : "0",
    [uniqueVisitors, totalSeconds],
  );

  const maxViews = useMemo(
    () => Math.max(...stats.map((s) => s.total_views), 1),
    [stats],
  );
  const maxTime = useMemo(
    () =>
      Math.max(
        ...stats.map((s) => s.total_time_seconds / (s.total_views || 1)),
        1,
      ),
    [stats],
  );

  const dropOffStats = useMemo(() => {
    return stats.map((s, idx) => {
      const nextSlide = stats[idx + 1];
      const dropOffCount = nextSlide
        ? Math.max(0, s.total_views - nextSlide.total_views)
        : 0;
      const dropOffPercent =
        s.total_views > 0 ? (dropOffCount / s.total_views) * 100 : 0;
      return { ...s, dropOffCount, dropOffPercent };
    });
  }, [stats]);

  const criticalSlide = useMemo(() => {
    if (dropOffStats.length === 0) return null;
    return [...dropOffStats].sort(
      (a, b) => b.dropOffPercent - a.dropOffPercent,
    )[0];
  }, [dropOffStats]);

  const tabs = [
    { id: "VISITS", label: "Visits" },
    { id: "TIME", label: "Duration", shortLabel: "Time" },
    { id: "DROPOFF", label: "Dropoff" },
    { id: "SAVES", label: "Saves", shortLabel: "Saved" },
  ];

  if (loading) {
    return (
      <DashboardLayout title="Deck Analytics">
        <div className="flex-1 flex flex-col items-center justify-center py-40 gap-4 text-slate-400">
          <div className="w-10 h-10 border-2 border-deckly-primary/20 border-t-deckly-primary rounded-full animate-spin" />
          <p className="font-medium font-bold uppercase tracking-widest text-[10px]">
            Gathering Insights...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !deck) {
    return (
      <DashboardLayout title="Deck Analytics">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-[40px] p-12 text-center shadow-sm">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto mb-8">
              <AlertCircle size={40} />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-4">
              {error ? "Loading Error" : "Access Restricted"}
            </h2>
            <p className="text-slate-500 font-medium leading-relaxed mb-10">
              {error ||
                "The analytics for this deck could not be loaded or you don't have permission to view them."}
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => navigate("/content")}
            >
              Return to Content
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }


  return (
    <DashboardLayout title={`${deck?.title || "Deck"} Analytics`}>
      <div className="flex-1 -m-8 relative">
        {/* ═══════════════ HEADER SECTION ═══════════════ */}
        <div className="pt-6 md:pt-8 pb-6 md:pb-8 px-4 md:px-6 border-b border-[#222] bg-background relative overflow-hidden">
          {/* Background Indicator for Refreshing */}
          <AnimatePresence>
            {isRefreshing && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 md:top-8 right-4 md:right-8 z-50 flex items-center gap-2 px-3 py-1.5 bg-[#141414] border border-[#333] rounded-md"
              >
                <Loader2
                  size={14}
                  className="text-deckly-primary animate-spin"
                />
                <span className="text-[11px] font-medium text-slate-300">
                  Syncing
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="max-w-6xl mx-auto flex items-center gap-3 md:gap-6 mt-6 md:mt-0">
            <button
              onClick={() => navigate("/content")}
              className="flex-shrink-0 w-8 h-8 rounded-md bg-[#111] border border-[#222] flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1a1a1a] transition-all"
              title="Return to Content"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-md bg-[#111] border border-[#222] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {deck?.pages?.[0]?.image_url ? (
                  <img
                    src={deck.pages[0].image_url}
                    alt={deck.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileText size={20} className="text-slate-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg md:text-2xl font-semibold text-white tracking-tight truncate">
                  {deck?.title}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {deck?.description || "Analytics and viewer engagement"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════ STATS ROW ═══════════════ */}
        <div className="bg-background px-4 md:px-6 overflow-x-auto scrollbar-hide py-4 relative z-10">
          <div className="max-w-6xl mx-auto min-w-[320px] pb-1 md:pb-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatItem
                icon={<Eye size={16} />}
                label="Total Visits"
                value={uniqueVisitors.toLocaleString()}
              />
              <StatItem
                icon={<Clock size={16} />}
                label="Avg Session"
                value={`${avgTimePerView}s`}
              />
              <StatItem
                icon={<Bookmark size={16} />}
                label="Saves"
                value={totalSaves.toLocaleString()}
              />
              <StatItem
                icon={<MessageSquare size={16} />}
                label="Engaged"
                value={visitorSignals
                  .filter((s) => s.isEngaged)
                  .length.toString()}
              />
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-16 space-y-8 md:space-y-16">
          {/* Detailed Engagement Chart Card */}
          <div className="bg-surface-card border border-[#222] rounded-lg p-4 md:p-8 shadow-sm">
            <div className="flex flex-col space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-[#1a1a1a] flex items-center justify-center border border-[#333]">
                    <BarChart3 size={16} className="text-deckly-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Engagement per Slide
                  </h3>
                </div>

                <Tabs
                  value={activeTab}
                  onValueChange={(v) => {
                    const tab = tabs.find((t) => t.id === v);
                    if (tab) setActiveTab(v as "VISITS" | "TIME" | "DROPOFF" | "SAVES");
                  }}
                  className="w-full md:w-auto"
                >
                  <div className="w-full overflow-x-auto custom-scrollbar flex">
                    <TabsList className="bg-[#141414] border border-[#333] p-1 h-auto rounded-md gap-1 flex shrink-0 w-fit">
                      {tabs.map((tab) => (
                        <TabsTrigger
                          key={tab.id}
                          value={tab.id}
                          className="rounded-sm text-[11px] font-medium px-4 py-1.5 text-slate-400 data-[state=active]:bg-[#222] data-[state=active]:text-deckly-primary transition-all duration-200 whitespace-nowrap shrink-0"
                        >
                          {tab.shortLabel ? (
                            <>
                              <span className="md:hidden">
                                {tab.shortLabel}
                              </span>
                              <span className="hidden md:inline">
                                {tab.label}
                              </span>
                            </>
                          ) : (
                            tab.label
                          )}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                </Tabs>
              </div>

              {/* Chart Content */}
              <div className="space-y-6 max-w-4xl mx-auto w-full pt-8">
                {activeTab === "SAVES" ? (
                  bookmarks.length === 0 ? (
                    <div className="py-20 text-center space-y-6">
                      <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-center mx-auto text-slate-700">
                        <Bookmark size={32} />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        No one has saved this deck yet.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {bookmarks.map((b: unknown, i: number) => {
                        const bm = b as BookmarkData;
                        return (
                        <div
                          key={i}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-surface-low border border-[#222] rounded-md group/item hover:bg-[#2a2a2a] hover:border-[#333] transition-all duration-200 gap-4 sm:gap-0"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-md bg-[#111] border border-[#333] flex items-center justify-center text-deckly-primary font-bold text-sm shrink-0">
                              {bm.profiles?.full_name?.[0] || "?"}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white tracking-wider">
                                {bm.profiles?.full_name?.toLowerCase() ||
                                  "Anonymous Investor"}
                              </p>
                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                                Saved on{" "}
                                {new Date(bm.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right hidden sm:block">
                            <Badge
                              variant="outline"
                              className="bg-deckly-primary/10 text-deckly-primary border-deckly-primary/20 text-[9px] font-bold uppercase tracking-widest px-3 py-1"
                            >
                              Live in Library
                            </Badge>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )
                ) : stats.length === 0 ? (
                  <div className="py-20 text-center space-y-6">
                    <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-center mx-auto text-slate-700">
                      <BarChart3 size={32} />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      No activity recorded for this deck yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {activeTab === "DROPOFF" &&
                      criticalSlide &&
                      criticalSlide.dropOffPercent > 20 && (
                        <div className="p-4 rounded-md bg-red-500/10 border border-red-500/20 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-md bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 border border-red-500/30">
                            <AlertCircle size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-red-400 mb-0.5">
                              Critical Drop-off
                            </p>
                            <p className="text-sm text-slate-400 font-medium">
                              Slide{" "}
                              <span className="text-white font-bold">
                                {criticalSlide.page_number}
                              </span>{" "}
                              has a churn rate of{" "}
                              <span className="text-white font-bold">
                                {criticalSlide.dropOffPercent.toFixed(0)}%
                              </span>
                              .
                            </p>
                          </div>
                        </div>
                      )}

                    <div className="space-y-4">
                      {(activeTab === "DROPOFF" ? dropOffStats : stats).map(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (s: any) => {
                          const avgTime =
                            s.total_views > 0
                              ? s.total_time_seconds / s.total_views
                              : 0;
                          const viewPercent = (s.total_views / maxViews) * 100;
                          const timePercent = (avgTime / maxTime) * 100;
                          const retentionPercent = s.dropOffPercent;

                          const percentage =
                            activeTab === "VISITS"
                              ? viewPercent
                              : activeTab === "TIME"
                                ? timePercent
                                : retentionPercent;
                          const value =
                            activeTab === "VISITS"
                              ? s.total_views
                              : activeTab === "TIME"
                                ? `${avgTime.toFixed(1)}s`
                                : `${s.dropOffPercent.toFixed(0)}%`;

                          const labelText =
                            activeTab === "VISITS"
                              ? s.total_views === 1
                                ? "Visit"
                                : "Visits"
                              : activeTab === "TIME"
                                ? "Duration"
                                : "Dropoff";

                          return (
                            <div
                              key={s.page_number}
                              className="flex items-center gap-4 group/row cursor-pointer"
                              tabIndex={0}
                            >
                              <span className="text-xs font-medium text-slate-500 w-10 shrink-0">
                                Pg {s.page_number}
                              </span>
                              <div className="flex-1 h-8 bg-surface-container rounded overflow-hidden border border-[#222]">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: `${Math.max(percentage, 2)}%`,
                                  }}
                                  transition={{
                                    duration: 1.2,
                                    ease: [0.16, 1, 0.3, 1],
                                  }}
                                  className={cn(
                                    "h-full flex items-center justify-end px-3 relative",
                                    activeTab === "VISITS"
                                      ? "bg-deckly-primary"
                                      : activeTab === "TIME"
                                        ? "bg-slate-700"
                                        : percentage > 30
                                          ? "bg-red-500"
                                          : "bg-deckly-primary/60",
                                  )}
                                  title={`${value} ${labelText}`}
                                >
                                  <span
                                    className={cn(
                                      "text-xs font-medium relative z-10 whitespace-nowrap",
                                      activeTab === "VISITS" || percentage > 30
                                        ? "text-slate-950"
                                        : "text-white",
                                    )}
                                  >
                                    {value}
                                    <span
                                      className={cn(
                                        "ml-1",
                                        percentage < 25
                                          ? "hidden md:group-hover/row:inline group-focus/row:inline group-active/row:inline"
                                          : "inline",
                                      )}
                                    >
                                      {labelText}
                                    </span>
                                  </span>
                                </motion.div>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Visitor Engagement Signals Section */}
          <div className="bg-surface-card border border-[#222] rounded-lg p-4 md:p-8 shadow-sm">
            <div className="space-y-10 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-deckly-primary">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Visitor Signals
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Behavior-based interest discovery
                  </p>
                </div>
                {visitorSignals.length > 0 && (
                  <Badge className="md:ml-auto mt-2 md:mt-0 bg-deckly-primary text-slate-950 font-medium text-xs px-3 py-1 rounded w-fit">
                    {visitorSignals.length} Viewer
                    {visitorSignals.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              {signalsLoading ? (
                <div className="py-20 flex flex-col items-center gap-4 text-slate-700">
                  <div className="w-12 h-12 border-4 border-white/5 border-t-deckly-primary rounded-full animate-spin shadow-2xl shadow-deckly-primary/10" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">
                    Analyzing deep signals...
                  </p>
                </div>
              ) : visitorSignals.length === 0 ? (
                <div className="py-20 text-center space-y-6">
                  <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-center mx-auto text-slate-700 relative">
                    <div className="absolute inset-0 bg-deckly-primary/5 blur-2xl rounded-full" />
                    <Users size={40} className="relative z-10" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                      No signals identified yet
                    </p>
                    <p className="text-[10px] text-slate-700 max-w-xs mx-auto font-bold uppercase tracking-widest leading-loose">
                      Insights appear when visitors show deep interaction —
                      revisits, extended viewing, or specific bookmarks.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {visitorSignals.map((visitor, idx) => (
                    <motion.div
                      key={visitor.visitorId}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className={cn(
                        "rounded-md border transition-all duration-200 overflow-hidden cursor-pointer",
                        expandedVisitor === visitor.visitorId
                          ? "bg-[#2a2a2a] border-deckly-primary/50"
                          : "bg-surface-low border-[#222] hover:border-[#333] hover:bg-[#2a2a2a]",
                      )}
                      onClick={() =>
                        setExpandedVisitor(
                          expandedVisitor === visitor.visitorId
                            ? null
                            : visitor.visitorId,
                        )
                      }
                    >
                      <div className="p-4 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-background border border-[#222] flex items-center justify-center shrink-0">
                              <span className="text-sm font-semibold text-deckly-primary">
                                V{idx + 1}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white truncate max-w-[180px] md:max-w-xs">
                                {visitor.viewerEmail?.toLowerCase() ||
                                  `Anonymous Viewer`}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-xs text-slate-500 font-medium">
                                  {visitor.totalVisits} Slides
                                </span>
                                <span className="w-1 h-1 rounded-full bg-[#333]" />
                                <span className="text-xs text-slate-500 font-medium">
                                  {visitor.totalTime}s Spend
                                </span>
                                <span className="w-1 h-1 rounded-full bg-[#333]" />
                                <span className="text-xs text-slate-500 font-medium">
                                  {visitor.distinctDays} Day
                                  {visitor.distinctDays > 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                            <div className="text-right hidden md:block">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
                                Intensity
                              </p>
                              <div className="flex gap-0.5 mt-1.5">
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      "w-3 h-1 rounded-full",
                                      i <= visitor.signals.length
                                        ? "bg-deckly-primary"
                                        : "bg-[#222]",
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                            <div
                              className={cn(
                                "w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center transition-all",
                                expandedVisitor === visitor.visitorId &&
                                  "bg-deckly-primary text-slate-950",
                              )}
                            >
                              <ChevronDown
                                size={18}
                                className={cn(
                                  "transition-transform duration-500",
                                  expandedVisitor === visitor.visitorId &&
                                    "rotate-180",
                                )}
                              />
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
                        {expandedVisitor === visitor.visitorId &&
                          visitor.slideBreakdown.length > 0 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{
                                duration: 0.5,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              className="bg-black/20 border-t border-white/5"
                            >
                              <div className="p-6">
                                <p className="text-xs font-semibold text-slate-400 mb-6">
                                  Deep Interaction Timeline
                                </p>
                                <div className="flex items-end gap-1.5 h-[200px] overflow-x-auto pb-8 scrollbar-hide relative group/chart">
                                  {(() => {
                                    const maxT = Math.max(
                                      ...visitor.slideBreakdown.map(
                                        (s) => s.time,
                                      ),
                                      1,
                                    );
                                    return visitor.slideBreakdown.map(
                                      (slide) => {
                                        const percent =
                                          (slide.time / maxT) * 100;
                                        const mins = Math.floor(
                                          slide.time / 60,
                                        );
                                        const secs = slide.time % 60;
                                        const tLabel =
                                          mins > 0
                                            ? `${mins}m ${secs}s`
                                            : `${secs}s`;
                                        return (
                                          <div
                                            key={slide.page}
                                            className="flex flex-col items-center flex-1 min-w-[32px] group/bar relative h-full justify-end"
                                          >
                                            <div className="absolute -top-6 opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap">
                                              <span className="text-[9px] font-bold text-deckly-primary bg-deckly-primary/10 px-2 py-1 rounded border border-deckly-primary/20">
                                                {tLabel}
                                              </span>
                                            </div>
                                            <motion.div
                                              initial={{ height: 0 }}
                                              animate={{
                                                height: `${Math.max(percent, 4)}%`,
                                              }}
                                              transition={{
                                                duration: 0.8,
                                                delay: slide.page * 0.02,
                                              }}
                                              className={cn(
                                                "w-full rounded-t-lg transition-all duration-300 relative overflow-hidden",
                                                percent > 70
                                                  ? "bg-deckly-primary"
                                                  : percent > 30
                                                    ? "bg-emerald-500"
                                                    : "bg-emerald-800",
                                              )}
                                            ></motion.div>
                                            <span className="text-[9px] font-bold text-slate-700 mt-2 absolute -bottom-5">
                                              P{slide.page}
                                            </span>
                                          </div>
                                        );
                                      },
                                    );
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
      </div>
    </DashboardLayout>
  );
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col bg-surface-card border border-[#222] rounded-lg p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-md bg-surface-lowest border border-[#333] flex items-center justify-center text-deckly-primary">
          {icon}
        </div>
        <p className="text-xs font-medium text-slate-400">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
    </div>
  );
}
