import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
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
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md" className="bg-ui-surface-elevated p-0 text-ui-text" hideClose={false}>
        <header className="flex items-center justify-between border-b border-ui-border p-6 md:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ui-primary/10 text-ui-primary">
              <BarChart3 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold tracking-tight text-ui-text">
                  Deck Insights
                </DialogTitle>
                <div className="flex items-center gap-1.5 rounded-md border border-ui-border bg-ui-subtle px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter text-ui-muted">
                  <History size={10} className="text-ui-primary" />
                  {tierLabel}
                </div>
              </div>
              <p className="max-w-[240px] truncate text-sm font-medium text-ui-muted">
                {deck.title}
              </p>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto">
          {!pageAnalytics.isLoading && !canUsePageAnalytics ? (
            <FeatureGate access={pageAnalytics.access} />
          ) : loading ? (
            <div className="py-20 flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-ui-primary" size={32} />
              <p className="text-xs font-bold uppercase tracking-widest text-ui-muted">
                Analyzing Engagement
              </p>
            </div>
          ) : error ? (
            <div className="py-20 flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ui-destructive/10 text-ui-destructive">
                <AlertCircle size={32} />
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-ui-text">
                  {error === "timeout" ? "Request Timed Out" : "Sync Failed"}
                </h4>
                <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-ui-muted">
                  {error === "timeout"
                    ? "The data is taking longer than usual to load. This can happen on slow networks."
                    : "We couldn't sync your analytics. This might be a temporary connection issue."}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleRetry}
                icon={RefreshCcw}
                className="border-ui-border bg-ui-subtle text-ui-text hover:bg-ui-surface"
              >
                Try Again
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <Card
                  variant="solid"
                  className="border-ui-border bg-ui-subtle p-5"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ui-primary/10 text-ui-primary">
                      <Eye size={20} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-ui-muted">
                      Total Views
                    </span>
                  </div>
                  <div className="text-3xl font-bold leading-none text-ui-text">
                    {totalViews}
                  </div>
                </Card>

                <Card
                  variant="solid"
                  className="border-ui-border bg-ui-subtle p-5"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ui-chart-3/10 text-ui-chart-3">
                      <Clock size={20} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-ui-muted">
                      Avg. Session
                    </span>
                  </div>
                  <div className="text-3xl font-bold leading-none text-ui-text">
                    {avgTimePerView}s
                  </div>
                </Card>
              </div>

              <div className="rounded-lg border border-ui-border bg-ui-subtle p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-ui-text">
                    {activeTab === "retention"
                      ? "Drop-off Analysis"
                      : "Engagement per Slide"}
                  </h4>
                  <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as "views" | "time" | "retention")}
                  >
                    <TabsList className="h-auto gap-1 rounded-lg bg-ui-surface p-1">
                      {(["views", "time", "retention"] as const).map((tab) => (
                        <TabsTrigger
                          key={tab}
                          value={tab}
                          className={cn(
                            "rounded-md px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest shadow-none transition-all data-[state=active]:bg-ui-primary data-[state=active]:text-ui-primary-text",
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
                  <div className="py-12 text-center text-sm font-medium italic text-ui-muted">
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
                          className="mb-8 flex items-center gap-4 rounded-lg border border-ui-destructive/20 bg-ui-destructive/10 p-4"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ui-destructive text-ui-primary-text">
                            <AlertCircle size={20} />
                          </div>
                          <div>
                            <p className="mb-0.5 text-xs font-bold uppercase tracking-widest text-ui-destructive">
                              Churn Alert
                            </p>
                            <p className="text-sm font-medium leading-tight text-ui-text">
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
                            <span className="w-8 text-[10px] font-bold text-ui-muted">
                              Pg {s.page_number}
                            </span>
                            <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-ui-surface">
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
                                    ? "bg-ui-chart-1"
                                    : activeTab === "time"
                                      ? "bg-ui-chart-3"
                                      : percentage > 40
                                        ? "bg-ui-destructive"
                                        : percentage > 20
                                          ? "bg-orange-500"
                                          : "bg-ui-chart-1/40",
                                )}
                              >
                                <span className="text-[9px] font-bold text-ui-primary-text shadow-sm">
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

        <footer className="flex items-center justify-between border-t border-ui-border bg-ui-subtle p-6">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-ui-muted">
            <Zap size={14} className="text-ui-primary" /> Real-time Sync
          </div>
          <Button onClick={onClose} size="sm" className="px-6">
            Done
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

export default AnalyticsModal;
