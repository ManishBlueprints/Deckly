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
        label: "Visits",
        value: totalViews.toLocaleString(),
      },
      {
        label: "Time Spent",
        value: formatTime(totalTimeSeconds),
      },
      {
        label: "Saves",
        value: (totalSaves || 0).toLocaleString(),
      },
    ] as { label: string; value: string; sub?: string }[];
  }, [totalViews, totalTimeSeconds, totalSaves]);

  return (
    <DashboardCard className="py-6 md:py-8 px-6 md:px-10 bg-[#10120f] border border-[#222] rounded-lg">
      <div className="flex flex-row items-center justify-around gap-4 md:gap-8">
        {stats.map((stat, i) => (
          <div key={i} className="text-center group flex-1 min-w-0">
            <div className="flex items-start justify-center gap-1 md:gap-2 mb-2">
              <span
                className={cn(
                  "text-3xl md:text-5xl font-semibold tracking-tight transition-transform group-hover:scale-105 duration-300 text-deckly-primary",
                )}
              >
                {loading ? "..." : stat.value}
              </span>
              {stat.sub && (
                <Badge
                  variant="outline"
                  className="bg-[#10120f] text-xs font-medium text-slate-400 border-[#333] mt-1 md:mt-3 hidden md:inline-flex capitalize"
                >
                  {stat.sub}
                </Badge>
              )}
            </div>
            <p className="text-xs font-medium text-slate-400 capitalize">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
