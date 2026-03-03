import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { analyticsService } from "../services/analyticsService";
import { deckService } from "../services/deckService";
import { Deck, DeckStats } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  getVisitorSignals,
  VisitorSignal,
} from "../services/interestSignalService";
import { InterestSignalBadge } from "../components/dashboard/InterestSignalBadge";

export default function DeckAnalytics() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const { session, isPro } = useAuth();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [stats, setStats] = useState<DeckStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "VISITS" | "TIME" | "DROPOFF" | "BOOKMARKS"
  >("VISITS");
  const [visitorSignals, setVisitorSignals] = useState<VisitorSignal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [expandedVisitor, setExpandedVisitor] = useState<string | null>(null);
  const [uniqueVisitors, setUniqueVisitors] = useState(0);
  const [totalSaves, setTotalSaves] = useState(0);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Used to prevent too frequent background refreshes
  const lastFetchedRef = React.useRef<number>(0);
  const lastDeckIdRef = React.useRef<string | undefined>(undefined);
  const FETCH_THROTTLE_MS = 2 * 60 * 1000; // 2 minutes

  useEffect(() => {
    if (deckId && session?.user?.id) {
      const now = Date.now();
      const isNewDeck = lastDeckIdRef.current !== deckId;
      const isInitialLoad = !deck || isNewDeck;
      const shouldThrottle =
        !isInitialLoad && now - lastFetchedRef.current < FETCH_THROTTLE_MS;

      if (shouldThrottle) return;

      if (isInitialLoad) {
        setLoading(true);
        // Clear old data for new deck to prevent flicker
        if (isNewDeck) {
          setDeck(null);
          setStats([]);
        }
      }

      lastFetchedRef.current = now;
      lastDeckIdRef.current = deckId;

      Promise.all([
        deckService.getDeckById(deckId),
        analyticsService.getDeckStats(deckId, !!isPro, session.user.id),
        analyticsService.getUserTotalStats(session.user.id, deckId, true),
        analyticsService.getDeckBookmarks(deckId).catch((err) => {
          console.error("Error fetching bookmarks:", err);
          return []; // Fallback to empty bookmarks if join fails
        }),
      ])
        .then(([deckData, statsData, totalData, bookmarksData]) => {
          setDeck(deckData);
          setStats(statsData || []);
          setTotalSaves(totalData.totalSaves || 0);
          setBookmarks(bookmarksData || []);
        })
        .catch((err) => {
          console.error("Critical error loading analytics:", err);
          // Only show error if we couldn't even get basic deck info
          if (!deck) setError("Failed to load analytics data.");
        })
        .finally(() => setLoading(false));

      // Fetch interest signals
      setSignalsLoading(true);
      getVisitorSignals(deckId)
        .then(setVisitorSignals)
        .finally(() => setSignalsLoading(false));

      // Fetch unique visitor count
      analyticsService.getUniqueVisitorCount(deckId).then(setUniqueVisitors);
    }
  }, [deckId, session?.user?.id, isPro]);

  // Derived Stats
  const totalViews = useMemo(
    () => stats.reduce((acc, curr) => acc + curr.total_views, 0),
    [stats],
  );
  const totalSeconds = useMemo(
    () => stats.reduce((acc, curr) => acc + curr.total_time_seconds, 0),
    [stats],
  );
  const avgTimePerView = useMemo(
    () => (totalViews > 0 ? (totalSeconds / totalViews).toFixed(1) : "0"),
    [totalViews, totalSeconds],
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
    { id: "BOOKMARKS", label: "Bookmarks", shortLabel: "Saved" },
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

  console.log("Analytics State:", { deck, stats, totalSaves, bookmarks });

  return (
    <DashboardLayout title={`${deck?.title || "Deck"} Analytics`}>
      <div className="flex-1 -m-8 relative">
        {/* ═══════════════ HERO SECTION ═══════════════ */}
        <div className="relative pt-24 pb-32 px-6 overflow-hidden">
          {/* Animated Background Accents */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-deckly-primary/10 rounded-full blur-[120px] animate-pulse" />
            <div
              className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] animate-pulse"
              style={{ animationDelay: "2s" }}
            />
          </div>

          <div className="max-w-5xl mx-auto relative z-10">
            {/* Back Button */}
            <button
              onClick={() => navigate("/content")}
              className="flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-12 group transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-deckly-primary/10 group-hover:border-deckly-primary/20 transition-all">
                <ArrowLeft
                  size={14}
                  className="group-hover:-translate-x-0.5 transition-transform"
                />
              </div>
              Return to Content
            </button>

            <div className="flex flex-col items-center text-center">
              {/* Deck Preview Thumbnail */}
              <div className="w-32 h-24 md:w-40 md:h-28 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mb-8 shadow-2xl backdrop-blur-md relative group">
                <div className="absolute inset-0 bg-deckly-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                {deck?.pages?.[0]?.image_url ? (
                  <img
                    src={deck.pages[0].image_url}
                    alt={deck.title}
                    className="w-full h-full object-cover relative z-10 transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <FileText
                    size={32}
                    className="text-slate-500 group-hover:text-deckly-primary transition-colors duration-500 relative z-10"
                  />
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4 uppercase tracking-[0.05em]">
                {deck?.title}
              </h1>

              <p className="text-slate-500 text-[11px] font-bold uppercase tracking-[0.15em] max-w-md mb-8 leading-relaxed">
                {deck?.description ||
                  "In-depth performance insights for your asset."}
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════════ STATS ROW ═══════════════ */}
        <div className="bg-[#0e1117]/50 border-y border-white/5 py-0 px-6 backdrop-blur-md overflow-x-auto scrollbar-hide">
          <div className="max-w-5xl mx-auto min-w-[640px] md:min-w-0">
            <div className="grid grid-cols-4 divide-x divide-white/5">
              <StatItem
                icon={<Eye size={16} />}
                label="Total Visits"
                value={uniqueVisitors.toLocaleString()}
                color="emerald"
              />
              <StatItem
                icon={<Clock size={16} />}
                label="Avg Session"
                value={`${avgTimePerView}s`}
                color="blue"
              />
              <StatItem
                icon={<Bookmark size={16} />}
                label="Bookmarked"
                value={totalSaves.toLocaleString()}
                color="emerald"
              />
              <StatItem
                icon={<MessageSquare size={16} />}
                label="Engagement"
                value={visitorSignals.length.toString()}
                color="blue"
              />
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-16 space-y-16">
          {/* Detailed Engagement Chart Card */}
          <div className="glass-shiny bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-deckly-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex flex-col space-y-8 relative z-10">
              <div className="flex flex-col items-center space-y-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-deckly-primary/10 flex items-center justify-center border border-deckly-primary/20">
                    <BarChart3 size={20} className="text-deckly-primary" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white">
                    Engagement per Slide
                  </h3>
                </div>

                <Tabs
                  value={activeTab}
                  onValueChange={(v) => {
                    const tab = tabs.find((t) => t.id === v);
                    if (tab) setActiveTab(v as any);
                  }}
                  className="w-full"
                >
                  <div className="w-full overflow-x-auto custom-scrollbar pb-4 px-4 md:px-0 flex md:justify-center">
                    <TabsList className="bg-white/5 border border-white/10 p-1.5 h-auto rounded-2xl gap-2 backdrop-blur-md shadow-inner flex shrink-0 w-fit">
                      {tabs.map((tab) => (
                        <TabsTrigger
                          key={tab.id}
                          value={tab.id}
                          className={cn(
                            "rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] px-6 md:px-10 py-3 md:py-4 text-slate-500 data-[state=active]:bg-deckly-primary data-[state=active]:text-slate-950 shadow-xl transition-all duration-300 active:scale-95 whitespace-nowrap shrink-0",
                          )}
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
                {activeTab === "BOOKMARKS" ? (
                  bookmarks.length === 0 ? (
                    <div className="py-20 text-center space-y-6">
                      <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-center mx-auto text-slate-700">
                        <Bookmark size={32} />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        No one has bookmarked this deck yet.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {bookmarks.map((b: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-2xl group/item hover:bg-white/[0.08] hover:border-deckly-primary/20 transition-all duration-300"
                        >
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-xl bg-deckly-primary/10 border border-deckly-primary/20 flex items-center justify-center text-deckly-primary font-bold uppercase text-sm">
                              {b.profiles?.full_name?.[0] || "?"}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white uppercase tracking-wider">
                                {b.profiles?.full_name || "Anonymous Investor"}
                              </p>
                              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                                Saved on{" "}
                                {new Date(b.created_at).toLocaleDateString()}
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
                      ))}
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
                        <div className="p-6 rounded-[2rem] bg-red-500/5 border border-red-500/20 flex items-center gap-6 animate-pulse">
                          <div className="w-12 h-12 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
                            <AlertCircle size={24} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">
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

                          return (
                            <div
                              key={s.page_number}
                              className="flex items-center gap-6 group/row"
                            >
                              <span className="text-[10px] font-bold text-slate-600 w-10 uppercase tracking-widest group-hover/row:text-deckly-primary transition-colors">
                                Pg {s.page_number}
                              </span>
                              <div className="flex-1 h-12 bg-white/5 rounded-2xl overflow-hidden relative border border-white/5 group-hover/row:border-white/10 transition-all">
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
                                    "h-full flex items-center justify-end px-4 rounded-r-xl relative overflow-hidden",
                                    activeTab === "VISITS"
                                      ? "bg-deckly-primary"
                                      : activeTab === "TIME"
                                        ? "bg-white/20"
                                        : percentage > 30
                                          ? "bg-red-500"
                                          : "bg-deckly-primary/60",
                                  )}
                                >
                                  {/* Shimmer Effect */}
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 translate-x-[-100%] group-hover/row:translate-x-[100%] transition-transform duration-1000" />
                                  <span
                                    className={cn(
                                      "text-[10px] font-bold tracking-widest relative z-10",
                                      activeTab === "VISITS" || percentage > 30
                                        ? "text-slate-950"
                                        : "text-white",
                                    )}
                                  >
                                    {value}
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
          <div className="glass-shiny bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden group">
            <div className="space-y-10 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[1.25rem] bg-deckly-primary/10 border border-deckly-primary/20 flex items-center justify-center">
                  <Users size={24} className="text-deckly-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold uppercase tracking-widest text-white">
                    Visitor Signals
                  </h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mt-1">
                    Behavior-based interest discovery
                  </p>
                </div>
                {visitorSignals.length > 0 && (
                  <Badge className="ml-auto bg-deckly-primary text-slate-950 font-bold text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-deckly-primary/20">
                    {visitorSignals.length} Active Viewers
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
                        "rounded-[2rem] border transition-all duration-500 overflow-hidden cursor-pointer",
                        expandedVisitor === visitor.visitorId
                          ? "bg-white/[0.08] border-deckly-primary/30 shadow-2xl"
                          : "bg-white/[0.03] border-white/5 hover:border-white/10 hover:bg-white/[0.05]",
                      )}
                      onClick={() =>
                        setExpandedVisitor(
                          expandedVisitor === visitor.visitorId
                            ? null
                            : visitor.visitorId,
                        )
                      }
                    >
                      <div className="p-6 md:p-8">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative group-hover:border-deckly-primary/30 transition-colors">
                              <div className="absolute inset-0 bg-deckly-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              <span className="text-sm font-bold text-deckly-primary relative z-10 uppercase tracking-widest">
                                V{idx + 1}
                              </span>
                            </div>
                            <div>
                              <p className="text-base font-bold text-white uppercase tracking-wider">
                                {visitor.viewerEmail || `Anonymous Viewer`}
                              </p>
                              <div className="flex items-center gap-4 mt-1">
                                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                                  {visitor.totalVisits} Slides
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                                  {visitor.totalTime}s Spend
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                                  {visitor.distinctDays} Day
                                  {visitor.distinctDays > 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
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
                                        ? "bg-deckly-primary shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                                        : "bg-white/5",
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
                              <div className="p-8">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-8">
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
                                                    ? "bg-deckly-primary/60"
                                                    : "bg-deckly-primary/30",
                                              )}
                                            >
                                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                            </motion.div>
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
  color = "emerald",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: "emerald" | "blue";
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 group/stat cursor-default">
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-500",
          color === "emerald"
            ? "bg-deckly-primary/10 text-deckly-primary group-hover/stat:bg-deckly-primary group-hover/stat:text-slate-950 group-hover/stat:shadow-[0_0_20px_rgba(34,197,94,0.3)]"
            : "bg-blue-500/10 text-blue-400 group-hover/stat:bg-blue-500 group-hover/stat:text-white group-hover/stat:shadow-[0_0_20px_rgba(59,130,246,0.3)]",
        )}
      >
        {icon}
      </div>
      <p className="text-[18px] md:text-2xl font-bold text-white group-hover/stat:scale-110 transition-transform tracking-tight">
        {value}
      </p>
      <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] mt-1">
        {label}
      </p>
    </div>
  );
}
