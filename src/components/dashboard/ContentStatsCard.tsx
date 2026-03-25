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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="bg-surface-low border border-white/5 p-8 flex flex-col justify-between group hover:brightness-110 transition-all relative overflow-hidden"
          >
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-primary/10 transition-all" />
            
            <div className="flex justify-between items-start relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
                {item.label}
              </p>
              <div className="p-2 bg-primary/10 rounded-none border border-primary/20">
                <Icon size={14} className="text-primary" />
              </div>
            </div>
            
            <div className="mt-8 flex items-baseline gap-3 relative z-10">
              {loading ? (
                <div className="h-10 w-24 bg-white/5 animate-pulse" />
              ) : (
                <h3 className="text-5xl font-bold tracking-tighter text-white">
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
