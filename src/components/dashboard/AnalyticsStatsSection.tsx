import { Badge } from "../ui/badge";

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
  return (
    <div className="w-full md:w-[420px] border-b md:border-b-0 md:border-r border-[#222] bg-[#10120f]">
      <div className="px-5 py-4 border-b border-[#222] bg-[#10120f] rounded-tl-lg">
        <h3 className="text-sm font-medium text-slate-200">
          Engagement Metrics
        </h3>
      </div>
      <div className="overflow-x-auto no-scrollbar p-6 md:p-12 md:space-y-16">
        <div className="flex flex-row md:flex-col gap-10 md:space-y-16 md:gap-0 pb-4 md:pb-0 min-w-max md:min-w-0">
          {loading
            ? Array(3)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="h-12 md:h-16 w-24 md:w-32 bg-white/5 animate-pulse rounded-2xl" />
                    <div className="h-4 w-32 md:w-40 bg-white/5 animate-pulse rounded-lg" />
                  </div>
                ))
            : items.map((item, i) => (
                <div key={i} className="group cursor-default">
                  <div className="flex items-start gap-3">
                    <p className="text-4xl md:text-6xl font-bold text-deckly-primary mb-1 tracking-tighter drop-shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all group-hover:drop-shadow-[0_0_25px_rgba(34,197,94,0.5)]">
                      {item.value}
                    </p>
                    {item.sub && (
                      <Badge
                        variant="outline"
                        className="mt-2 md:mt-3 bg-white/5 text-[8px] font-bold uppercase text-slate-500 border-white/10 px-2 py-0.5"
                      >
                        {item.sub}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 group-hover:text-slate-200 transition-colors">
                    {item.label}
                  </p>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
