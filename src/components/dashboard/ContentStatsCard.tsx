import { useMemo } from "react";
import { TrendingUp, Layout, Bookmark } from "lucide-react";

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
        label: "Total Visits",
        value: totalViews.toLocaleString(),
        icon: TrendingUp,
      },
      {
        label: "Time Spent",
        value: formatTime(totalTimeSeconds),
        icon: Layout,
      },
      {
        label: "Total Saves",
        value: (totalSaves || 0).toLocaleString(),
        icon: Bookmark,
      },
    ];
  }, [totalViews, totalTimeSeconds, totalSaves]);

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-6">
      {stats.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="bg-surface-card border border-white/5 p-3 sm:p-4 md:p-8 flex flex-col justify-between group hover:brightness-110 transition-all relative overflow-hidden min-h-[108px] sm:min-h-[140px]"
          >
            <div className="flex items-start justify-between gap-2 relative z-10">
              <p className="text-[7px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-[0.18em] sm:tracking-[0.24em] md:tracking-[0.3em] text-slate-500 leading-tight max-w-[4.5rem] sm:max-w-none">
                {item.label}
              </p>
              <div className="p-1.5 sm:p-2 bg-primary/10 rounded-none border border-primary/20 shrink-0">
                <Icon size={10} className="text-primary sm:w-[14px] sm:h-[14px]" />
              </div>
            </div>
            
            <div className="mt-3 sm:mt-4 md:mt-8 flex items-baseline gap-2 sm:gap-3 relative z-10">
              {loading ? (
                <div className="h-6 w-10 sm:h-8 sm:w-16 md:h-10 md:w-24 bg-white/5 animate-pulse" />
              ) : (
                <h3 className="text-[1.15rem] sm:text-2xl md:text-5xl font-bold tracking-tighter text-white leading-none">
                  {item.value}
                </h3>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
