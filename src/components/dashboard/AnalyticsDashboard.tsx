import { useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { AnalyticsChart } from "./AnalyticsChart";
import { useUserTotalStats } from "../../hooks/useUserTotalStats";
import { useDailyMetrics } from "../../hooks/useDailyMetrics";
import { TrendingUp, Timer, Bookmark } from "lucide-react";

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
      return `${mins}m`;
    };

    return [
      {
        label: "Total Visits",
        value: (stats?.totalViews || 0).toLocaleString(),
        icon: TrendingUp,
      },
      {
        label: "Time Spent",
        value: formatTime(stats?.totalTimeSeconds || 0),
        icon: Timer,
      },
      {
        label: "Total Saves",
        value: (stats?.totalSaves || 0).toLocaleString(),
        icon: Bookmark,
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
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tighter text-foreground uppercase">
          Engagement Trends
        </h2>
        {isRefreshing && !loading && (
          <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20">
            <div className="w-1.5 h-1.5 bg-primary animate-pulse" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-primary">
              Live
            </span>
          </div>
        )}
      </div>

      {/* 2-column layout: stats left, chart right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Stats column — left, stacked vertically */}
        <div className="lg:col-span-4 grid grid-rows-3 gap-6">
          {overviewItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="bg-surface-low border border-white/5 p-6 flex flex-col justify-between group hover:brightness-110 transition-all"
              >
                <div className="flex justify-between items-start">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
                    {item.label}
                  </p>
                  <Icon size={16} className="text-primary" />
                </div>
                {loading ? (
                  <div className="h-8 w-20 bg-surface-highest animate-pulse mt-4" />
                ) : (
                  <h3 className="text-4xl font-bold mt-4 tracking-tighter text-foreground">
                    {item.value}
                  </h3>
                )}
              </div>
            );
          })}
        </div>

        {/* Chart — right */}
        <div className="lg:col-span-8 bg-surface-low border border-white/5 flex flex-col min-h-[380px]">
          <Tabs defaultValue="VISITS" className="flex-1 flex flex-col h-full">
            {/* Header: title+subtitle left, tabs right */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
              <div>
                <h4 className="text-base font-bold text-foreground tracking-tight">
                  Engagement Trends
                </h4>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Visitor activity over the last 7 days
                </p>
              </div>
              <TabsList className="bg-transparent gap-3 p-0">
                <TabsTrigger
                  value="VISITS"
                  className="rounded-none text-[10px] font-bold uppercase tracking-widest px-3 py-1.5
                    text-slate-500 bg-transparent border border-transparent
                    data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:border-primary
                    transition-all"
                >
                  Visits
                </TabsTrigger>
                <TabsTrigger
                  value="TIME"
                  className="rounded-none text-[10px] font-bold uppercase tracking-widest px-3 py-1.5
                    text-slate-500 bg-transparent border border-transparent
                    data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:border-primary
                    transition-all"
                >
                  Duration
                </TabsTrigger>
                <TabsTrigger
                  value="BOOKMARKS"
                  className="rounded-none text-[10px] font-bold uppercase tracking-widest px-3 py-1.5
                    text-slate-500 bg-transparent border border-transparent
                    data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:border-primary
                    transition-all"
                >
                  Saves
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="VISITS"
              className="flex-1 m-0 p-0 flex flex-col"
            >
              <AnalyticsChart
                labels={dailyData.labels}
                data={dailyData.visits}
                loading={loading}
              />
            </TabsContent>

            <TabsContent value="TIME" className="flex-1 m-0 p-0 flex flex-col">
              <AnalyticsChart
                labels={dailyData.labels}
                data={dailyData.timeSpent}
                loading={loading}
                isTime
              />
            </TabsContent>

            <TabsContent
              value="BOOKMARKS"
              className="flex-1 m-0 p-0 flex flex-col"
            >
              <AnalyticsChart
                labels={dailyData.labels}
                data={dailyData.bookmarks}
                loading={loading}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
