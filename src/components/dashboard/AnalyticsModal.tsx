import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  X,
  BarChart3,
  Clock,
  Eye,
  Loader2,
  Zap,
  History,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";
import { analyticsService } from "../../services/analyticsService";
import { Deck, DeckPageStats } from "../../types";
import { cn } from "../../lib/utils";
import { useAuth } from "../../contexts/AuthContext";
import { useTierFeatureAccess } from "../../hooks/useTierEntitlements";
import { FeatureGate } from "../billing/FeatureGate";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { TIER_CONFIG } from "../../constants/tiers";

interface AnalyticsModalProps {
  deck: Deck;
  onClose: () => void;
}

function AnalyticsModal({ deck, onClose }: AnalyticsModalProps) {
  const { session, isPro, profile } = useAuth();
  const userId = session?.user?.id;
  const pageAnalytics = useTierFeatureAccess(profile?.tier, "page_analytics", Boolean(profile));
  const canUsePageAnalytics = pageAnalytics.access.state === "available";
  const [stats, setStats] = useState<DeckPageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"timeout" | "failed" | null>(null);
  const [activeTab, setActiveTab] = useState<"views" | "time" | "retention">(
    "views",
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const tierLabel = pageAnalytics.data?.tiers.find((entry) => entry.tier === profile?.tier)?.label
    ?? TIER_CONFIG[profile?.tier ?? "FREE"].planLabel;

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const performFetch = async () => {
      if (!pageAnalytics.isLoading && !canUsePageAnalytics) {
        setLoading(false);
        setStats([]);
        return;
      }
      setLoading(true);
      setError(null);

      // Safety timeout: 15s for extra resilience (cold starts)
      timeoutId = setTimeout(() => {
        if (mounted) {
          setLoading(false);
          setError("timeout");
          console.warn("Analytics fetch timed out (15s)");
        }
      }, 15000);

      try {
        const pageStats = await analyticsService.getDeckStats(
          deck.id,
          isPro,
          userId
        );
        if (mounted) {
          setStats(pageStats || []);
          setError(null);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
        if (mounted) setError("failed");
      } finally {
        if (mounted) {
          setLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    performFetch();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [canUsePageAnalytics, deck.id, isPro, pageAnalytics.isLoading, refreshTrigger, userId]);

  const handleRetry = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const totalViews = stats.reduce((acc, curr) => acc + curr.total_views, 0);
  const totalSeconds = stats.reduce(
    (acc, curr) => acc + curr.total_time_seconds,
    0,
  );
  const avgTimePerView =
    totalViews > 0 ? (totalSeconds / totalViews).toFixed(1) : 0;

  const maxViews = Math.max(...stats.map((s) => s.total_views), 1);
  const maxTime = Math.max(
    ...stats.map((s) => s.total_time_seconds / (s.total_views || 1)),
    1,
  );

  // Calculate Drop-Off Stats
  const dropOffStats = useMemo(() => {
    return stats.map((s, idx) => {
      const nextSlide = stats[idx + 1];
      const dropOffCount = nextSlide
        ? Math.max(0, s.total_views - nextSlide.total_views)
        : 0;
      const dropOffPercent =
        s.total_views > 0 ? (dropOffCount / s.total_views) * 100 : 0;
      return {
        ...s,
        dropOffCount,
        dropOffPercent,
      };
    });
  }, [stats]);

  const criticalSlide = useMemo(() => {
    if (dropOffStats.length === 0) return null;
    return [...dropOffStats].sort(
      (a, b) => b.dropOffPercent - a.dropOffPercent,
    )[0];
  }, [dropOffStats]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
      >
        <header className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-deckly-primary/10 text-deckly-primary rounded-2xl flex items-center justify-center">
              <BarChart3 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Deck Insights
                </h3>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                  <History size={10} className="text-deckly-primary" />
                  {tierLabel}
                </div>
              </div>
              <p className="text-sm text-slate-400 font-medium truncate max-w-[240px]">
                {deck.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={20} />
          </button>
        </header>

        <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto">
          {!pageAnalytics.isLoading && !canUsePageAnalytics ? (
            <FeatureGate access={pageAnalytics.access} />
          ) : loading ? (
            <div className="py-20 flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-deckly-primary" size={32} />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
                Analyzing Engagement
              </p>
            </div>
          ) : error ? (
            <div className="py-20 flex flex-col items-center gap-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
                <AlertCircle size={32} />
              </div>
              <div className="space-y-2">
                <h4 className="text-white font-bold">
                  {error === "timeout" ? "Request Timed Out" : "Sync Failed"}
                </h4>
                <p className="text-slate-500 text-sm max-w-[280px] leading-relaxed mx-auto">
                  {error === "timeout"
                    ? "The data is taking longer than usual to load. This can happen on slow networks."
                    : "We couldn't sync your analytics. This might be a temporary connection issue."}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleRetry}
                icon={RefreshCcw}
                className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
              >
                Try Again
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <Card
                  variant="solid"
                  className="p-5 border-white/10 bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-deckly-primary/10 text-deckly-primary rounded-xl flex items-center justify-center">
                      <Eye size={20} />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                      Total Views
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-white leading-none">
                    {totalViews}
                  </div>
                </Card>

                <Card
                  variant="solid"
                  className="p-5 border-white/10 bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-deckly-secondary/10 text-deckly-secondary rounded-xl flex items-center justify-center">
                      <Clock size={20} />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                      Avg. Session
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-white leading-none">
                    {avgTimePerView}s
                  </div>
                </Card>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                  <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                    {activeTab === "retention"
                      ? "Drop-off Analysis"
                      : "Engagement per Slide"}
                  </h4>
                  <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as "views" | "time" | "retention")}
                  >
                    <TabsList className="bg-white/5 p-1 h-auto rounded-xl gap-1">
                      {(["views", "time", "retention"] as const).map((tab) => (
                        <TabsTrigger
                          key={tab}
                          value={tab}
                          className={cn(
                            "px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all data-[state=active]:bg-deckly-primary data-[state=active]:text-white shadow-none",
                          )}
                        >
                          {tab === "views"
                            ? "Views"
                            : tab === "time"
                              ? "Time"
                              : "Drop-off"}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                {stats.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 italic text-sm font-medium">
                    No activity recorded yet for this deck.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeTab === "retention" &&
                      criticalSlide &&
                      criticalSlide.dropOffPercent > 20 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-4"
                        >
                          <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0">
                            <AlertCircle size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-0.5">
                              Churn Alert
                            </p>
                            <p className="text-sm text-slate-300 font-medium leading-tight">
                              Slide {criticalSlide.page_number} has the highest
                              drop-off rate (
                              {criticalSlide.dropOffPercent.toFixed(0)}%).
                              Consider revising its content.
                            </p>
                          </div>
                        </motion.div>
                      )}

                    {(activeTab === "retention" ? dropOffStats : stats).map(
                      (s: DeckPageStats & { dropOffPercent?: number }) => {
                        const avgTime =
                          s.total_views > 0
                            ? s.total_time_seconds / s.total_views
                            : 0;
                        const viewPercent = (s.total_views / maxViews) * 100;
                        const timePercent = (avgTime / maxTime) * 100;
                        const retentionPercent = s.dropOffPercent || 0;

                        const percentage =
                          activeTab === "views"
                            ? viewPercent
                            : activeTab === "time"
                              ? timePercent
                              : retentionPercent;

                        return (
                          <div
                            key={s.page_number}
                            className="flex items-center gap-4"
                          >
                            <span className="text-[10px] font-bold text-slate-600 w-8">
                              Pg {s.page_number}
                            </span>
                            <div className="flex-1 h-7 bg-white/5 rounded-lg overflow-hidden relative">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                  width:
                                    activeTab === "retention"
                                      ? `${Math.max(percentage, 2)}%`
                                      : `${percentage}%`,
                                }}
                                transition={{ duration: 1, ease: "circOut" }}
                                className={cn(
                                  "h-full flex items-center justify-end px-3 rounded-lg",
                                  activeTab === "views"
                                    ? "bg-deckly-primary"
                                    : activeTab === "time"
                                      ? "bg-deckly-secondary"
                                      : percentage > 40
                                        ? "bg-red-500"
                                        : percentage > 20
                                          ? "bg-orange-500"
                                          : "bg-deckly-primary/40",
                                )}
                              >
                                <span className="text-[9px] font-bold text-white shadow-sm">
                                  {activeTab === "views"
                                    ? s.total_views
                                    : activeTab === "time"
                                      ? `${avgTime.toFixed(1)}s`
                                      : `${(s.dropOffPercent || 0).toFixed(0)}%`}
                                </span>
                              </motion.div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="p-6 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-widest">
            <Zap size={14} className="text-deckly-primary" /> Real-time Sync
          </div>
          <Button onClick={onClose} size="sm" className="px-6">
            Done
          </Button>
        </footer>
      </motion.div>
    </div>
  );
}

export default AnalyticsModal;
