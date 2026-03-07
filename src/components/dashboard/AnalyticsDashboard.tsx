import { useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { DashboardCard } from "../ui/DashboardCard";
import { AnalyticsChart } from "./AnalyticsChart";
import { AnalyticsStatsSection } from "./AnalyticsStatsSection";
import { useUserTotalStats } from "../../hooks/useUserTotalStats";
import { useDailyMetrics } from "../../hooks/useDailyMetrics";

export function AnalyticsDashboard() {
  const { session } = useAuth();

  const {
    data: stats,
    isLoading: statsLoading,
    isFetching: statsFetching,
  } = useUserTotalStats(session?.user?.id);
  const {
    data: daily,
    isLoading: dailyLoading,
    isFetching: dailyFetching,
  } = useDailyMetrics(session?.user?.id);

  const loading = (statsLoading || dailyLoading) && !stats;
  const isRefreshing = statsFetching || dailyFetching;

  const overviewItems = useMemo(() => {
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}m ${secs}s`;
    };

    return [
      {
        label: "Total Visit",
        value: (stats?.totalViews || 0).toLocaleString(),
        sub: "",
      },
      {
        label: "Total Time Spent",
        value: formatTime(stats?.totalTimeSeconds || 0),
        sub: "",
      },
      {
        label: "Bookmarked",
        value: (stats?.totalSaves || 0).toLocaleString(),
        sub: "",
      },
    ];
  }, [stats]);

  const dailyData = daily || {
    labels: [],
    visits: [],
    timeSpent: [],
    bookmarks: [],
  };

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
              labels={dailyData.labels}
              data={dailyData.visits}
              loading={loading}
            />
          </TabsContent>

          <TabsContent
            value="TIME"
            className="flex-1 m-0 p-0 flex flex-col justify-end"
          >
            <AnalyticsChart
              labels={dailyData.labels}
              data={dailyData.timeSpent}
              loading={loading}
              isTime
            />
          </TabsContent>

          <TabsContent
            value="BOOKMARKS"
            className="flex-1 m-0 p-0 flex flex-col justify-end"
          >
            <AnalyticsChart
              labels={dailyData.labels}
              data={dailyData.bookmarks}
              loading={loading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardCard>
  );
}
