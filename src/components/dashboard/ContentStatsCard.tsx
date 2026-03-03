import { useMemo } from "react";
import { DashboardCard } from "../ui/DashboardCard";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";

interface ContentStatsCardProps {
  totalViews: number;
  totalTimeSeconds: number;
  totalSaves: number;
  loading?: boolean;
}

export function ContentStatsCard({
  totalViews,
  totalTimeSeconds,
  totalSaves,
  loading,
}: ContentStatsCardProps) {
  const stats = useMemo(() => {
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}m ${secs}s`;
    };

    return [
      {
        label: "Total Visit",
        value: totalViews.toLocaleString(),
      },
      {
        label: "Total Time Spent",
        value: formatTime(totalTimeSeconds),
      },
      {
        label: "Bookmarked",
        value: (totalSaves || 0).toLocaleString(),
      },
    ] as { label: string; value: string; sub?: string }[];
  }, [totalViews, totalTimeSeconds, totalSaves]);

  return (
    <DashboardCard className="py-6 md:py-16 px-6 md:px-12 border-white/5 shadow-2xl glass-shiny">
      <div className="flex flex-row items-center justify-around gap-4 md:gap-12">
        {stats.map((stat, i) => (
          <div key={i} className="text-center group flex-1 min-w-0">
            <div className="flex items-start justify-center gap-1 md:gap-2 mb-2">
              <span
                className={cn(
                  "text-3xl md:text-7xl font-bold tracking-tighter transition-transform group-hover:scale-105 duration-500 text-deckly-primary shadow-premium",
                )}
              >
                {loading ? "..." : stat.value}
              </span>
              {stat.sub && (
                <Badge
                  variant="outline"
                  className="bg-white/5 text-[8px] font-bold uppercase text-slate-500 border-white/10 mt-1 md:mt-3 hidden md:inline-flex"
                >
                  {stat.sub}
                </Badge>
              )}
            </div>
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-[0.2em] leading-tight">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
