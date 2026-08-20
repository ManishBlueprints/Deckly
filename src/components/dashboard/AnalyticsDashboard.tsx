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
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-ui-text sm:text-2xl">
          Engagement trends
        </h2>
        {isRefreshing && !loading && (
          <div className="flex items-center gap-2 rounded-full border border-ui-primary/20 bg-ui-primary/10 px-3 py-1">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-ui-primary" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-ui-primary">
              Live
            </span>
          </div>
        )}
      </div>

      {/* 2-column layout: stats left, chart right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Stats column — left, stacked vertically */}
        <div className="lg:col-span-4 grid grid-rows-3 gap-6">
          {overviewItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                data-tour={`stat-card-${index}`}
                className="group flex flex-col justify-between rounded-[18px] border border-ui-border bg-ui-surface p-6 shadow-[var(--ui-shadow-control)] transition-all hover:border-ui-primary/25"
              >
                <div className="flex justify-between items-start">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ui-muted">
                    {item.label}
                  </p>
                  <Icon size={16} className="text-ui-primary" />
                </div>
                {loading ? (
                  <div className="h-8 w-20 bg-surface-highest animate-pulse mt-4" />
                ) : (
                  <h3 className="mt-4 font-mono text-3xl font-semibold tracking-tight text-ui-text">
                    {item.value}
                  </h3>
                )}
              </div>
            );
          })}
        </div>

        {/* Chart — right */}
        <div
          data-tour="engagement-chart"
          className="flex min-h-[380px] flex-col overflow-hidden rounded-[24px] border border-ui-border bg-ui-surface shadow-[var(--ui-shadow-surface)] lg:col-span-8"
        >
          <Tabs defaultValue="VISITS" className="flex-1 flex flex-col h-full">
            {/* Header: title+subtitle left, tabs right */}
            <div className="flex flex-col gap-4 border-b border-ui-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div>
                <h4 className="text-base font-semibold tracking-tight text-ui-text">
                  Engagement over time
                </h4>
                <p className="mt-0.5 text-xs text-ui-muted">
                  Visitor activity over the last 7 days
                </p>
              </div>
              <TabsList className="bg-transparent gap-3 p-0">
                <TabsTrigger
                  value="VISITS"
                  className="rounded-[10px] border border-transparent bg-transparent px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-ui-muted
                    data-[state=active]:border-ui-primary data-[state=active]:bg-ui-primary data-[state=active]:text-ui-primary-text
                    transition-all"
                >
                  Visits
                </TabsTrigger>
                <TabsTrigger
                  value="TIME"
                  className="rounded-[10px] border border-transparent bg-transparent px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-ui-muted
                    data-[state=active]:border-ui-primary data-[state=active]:bg-ui-primary data-[state=active]:text-ui-primary-text
                    transition-all"
                >
                  Duration
                </TabsTrigger>
                <TabsTrigger
                  value="BOOKMARKS"
                  className="rounded-[10px] border border-transparent bg-transparent px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-ui-muted
                    data-[state=active]:border-ui-primary data-[state=active]:bg-ui-primary data-[state=active]:text-ui-primary-text
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
