import { TrendingUp, Timer, Bookmark } from "lucide-react";

interface StatItem {
  label: string;
  value: string;
  sub?: string;
}

interface AnalyticsStatsSectionProps {
  items: StatItem[];
  loading: boolean;
}

export function AnalyticsStatsSection({
  items,
  loading,
}: AnalyticsStatsSectionProps) {
  const icons = [TrendingUp, Timer, Bookmark];

  return (
    <div className="lg:col-span-4 grid grid-cols-1 gap-6">
      {items.map((item, i) => {
        const Icon = icons[i] || TrendingUp;
        return (
          <div 
            key={item.label}
            className="bg-surface-low p-6 flex flex-col justify-between hover:bg-surface-high transition-colors group h-[140px]"
          >
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">{item.label}</p>
              <Icon size={18} className="text-primary group-hover:scale-110 transition-transform" />
            </div>
            {loading ? (
              <div className="h-10 w-24 bg-surface-highest animate-pulse mt-4" />
            ) : (
              <h3 className="text-4xl font-bold mt-4 tracking-tighter text-foreground">
                {item.value}
              </h3>
            )}
          </div>
        );
      })}
    </div>
  );
}
