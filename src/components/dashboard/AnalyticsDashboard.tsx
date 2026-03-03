import { useEffect, useState, useMemo } from "react";
import { analyticsService } from "../../services/analyticsService";
import { useAuth } from "../../contexts/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { DashboardCard } from "../ui/DashboardCard";
import { AnalyticsChart } from "./AnalyticsChart";
import { AnalyticsStatsSection } from "./AnalyticsStatsSection";

export function AnalyticsDashboard() {
  const { session } = useAuth();

  // Initialize from cache
  const getCachedData = () => {
    try {
      const cached = localStorage.getItem(
        `dashboard-analytics-cache-${session?.user?.id}`,
      );
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const initialCache = getCachedData();
  const [stats, setStats] = useState(
    initialCache?.stats || {
      totalViews: 0,
      totalTimeSeconds: 0,
      totalSaves: 0,
    },
  );
  const [daily, setDaily] = useState<{
    labels: string[];
    visits: number[];
    timeSpent: number[];
    bookmarks: number[];
  }>(
    initialCache?.daily || {
      labels: [],
      visits: [],
      timeSpent: [],
      bookmarks: [],
    },
  );

  const [loading, setLoading] = useState(!initialCache);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      // Only show skeleton if we have no data
      if (stats.totalViews === 0) setLoading(true);
      setIsRefreshing(true);

      Promise.all([
        analyticsService.getUserTotalStats(session.user.id),
        analyticsService.getDailyMetrics(session.user.id),
      ])
        .then(([total, dailyData]) => {
          setStats(total);
          setDaily(dailyData);

          localStorage.setItem(
            `dashboard-analytics-cache-${session.user.id}`,
            JSON.stringify({
              stats: total,
              daily: dailyData,
              timestamp: Date.now(),
            }),
          );
        })
        .catch((err) => console.error("Dashboard fetch error:", err))
        .finally(() => {
          setLoading(false);
          setIsRefreshing(false);
        });
    }
  }, [session?.user?.id]); // Remove initialCache from dependencies

  const overviewItems = useMemo(() => {
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}m ${secs}s`;
    };

    return [
      {
        label: "Total Visit",
        value: stats.totalViews.toLocaleString(),
        sub: "",
      },
      {
        label: "Total Time Spent",
        value: formatTime(stats.totalTimeSeconds),
        sub: "",
      },
      {
        label: "Bookmarked",
        value: (stats.totalSaves || 0).toLocaleString(),
        sub: "",
      },
    ];
  }, [stats]);

  return (
    <DashboardCard
      className="min-h-[400px] md:min-h-[600px] border-white/5 shadow-2xl"
      contentClassName="flex flex-col md:flex-row border-t-0 h-full relative"
    >
      {isRefreshing && !loading && (
        <div className="absolute top-6 right-10 flex items-center gap-3 z-10 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-md">
          <div className="w-2 h-2 bg-deckly-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Syncing
          </span>
        </div>
      )}
      <AnalyticsStatsSection items={overviewItems} loading={loading} />

      <div className="flex-1 flex flex-col bg-white/[0.01]">
        <Tabs defaultValue="VISITS" className="flex-1 flex flex-col">
          <div className="flex items-center justify-center p-6 md:p-10 bg-white/[0.02] border-b border-white/5">
            <TabsList className="bg-white/5 border border-white/10 p-1.5 h-auto rounded-2xl gap-2 backdrop-blur-md shadow-inner">
              <TabsTrigger
                value="VISITS"
                className="rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] px-6 md:px-10 py-3 md:py-4 text-slate-500 data-[state=active]:bg-deckly-primary data-[state=active]:text-slate-950 shadow-xl transition-all duration-300 active:scale-95"
              >
                Visits
              </TabsTrigger>
              <TabsTrigger
                value="TIME"
                className="rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] px-6 md:px-10 py-3 md:py-4 text-slate-500 data-[state=active]:bg-deckly-primary data-[state=active]:text-slate-950 shadow-xl transition-all duration-300 active:scale-95"
              >
                <span className="md:hidden">Time</span>
                <span className="hidden md:inline">Duration</span>
              </TabsTrigger>
              <TabsTrigger
                value="BOOKMARKS"
                className="rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] px-6 md:px-10 py-3 md:py-4 text-slate-500 data-[state=active]:bg-deckly-primary data-[state=active]:text-slate-950 shadow-xl transition-all duration-300 active:scale-95"
              >
                <span className="md:hidden">Saved</span>
                <span className="hidden md:inline">Bookmarks</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="VISITS"
            className="flex-1 m-0 p-0 flex flex-col justify-end"
          >
            <AnalyticsChart
              labels={daily.labels}
              data={daily.visits}
              loading={loading}
            />
          </TabsContent>

          <TabsContent
            value="TIME"
            className="flex-1 m-0 p-0 flex flex-col justify-end"
          >
            <AnalyticsChart
              labels={daily.labels}
              data={daily.timeSpent}
              loading={loading}
              isTime
            />
          </TabsContent>

          <TabsContent
            value="BOOKMARKS"
            className="flex-1 m-0 p-0 flex flex-col justify-end"
          >
            <AnalyticsChart
              labels={daily.labels}
              data={daily.bookmarks}
              loading={loading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardCard>
  );
}
