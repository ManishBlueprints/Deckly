interface AnalyticsChartProps {
  labels: string[];
  data: number[];
  loading: boolean;
  isTime?: boolean;
}

/**
 * Finds a "nice" maximum value for the Y-axis to avoid awkward labels.
 */
function findNiceMax(val: number, minCeiling: number = 10): number {
  if (val <= 0) return minCeiling;
  const max = Math.max(val, minCeiling);

  if (max <= 50) return Math.ceil(max / 5) * 5;
  if (max <= 100) return Math.ceil(max / 10) * 10;

  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / magnitude;

  let nice;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;

  return nice * magnitude;
}

export function AnalyticsChart({
  labels,
  data,
  loading,
  isTime = false,
}: AnalyticsChartProps) {
  const maxVal = Math.max(...data, 0);
  const niceMax = findNiceMax(maxVal, isTime ? 60 : 10);

  const formatYLabel = (val: number) => {
    if (!isTime) return val;
    if (val === 0) return "0";
    if (val >= 60) return `${Math.round(val / 60)}m`;
    return `${val}s`;
  };

  return (
    <div className="w-full h-full flex flex-col justify-end p-8 md:p-10">
      <div className="flex items-stretch h-64 md:h-72 relative">
        {/* Y-Axis Labels */}
        <div className="w-12 flex flex-col justify-between py-0 pr-4 text-right">
          {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
            <span
              key={ratio}
              className="text-[9px] font-bold text-slate-600 leading-none h-0 flex items-center justify-end uppercase tracking-widest"
            >
              {formatYLabel(Math.round(niceMax * ratio))}
            </span>
          ))}
        </div>

        {/* Chart Grid Area */}
        <div className="flex-1 border-l border-white/5 relative flex items-end justify-between gap-3 px-2">
          {/* Horizontal Grid Lines */}
          {[0.25, 0.5, 0.75, 1.0].map((ratio) => (
            <div
              key={ratio}
              className="absolute inset-x-0 border-t border-white/[0.03] pointer-events-none"
              style={{ bottom: `${ratio * 100}%` }}
            />
          ))}

          {loading
            ? Array(7)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 max-w-16 h-full flex flex-col justify-end pb-2"
                  >
                    <div className="w-full bg-surface-high animate-pulse h-24" />
                  </div>
                ))
            : data.map((val, i) => (
                <div
                  key={i}
                  className="flex-1 max-w-16 h-full group relative flex flex-col justify-end"
                >
                  <div
                    className="w-full relative z-10 bg-primary/40 group-hover:bg-primary transition-all duration-500 shadow-[0_0_20px_rgba(84,233,138,0.1)] group-hover:shadow-[0_0_30px_rgba(84,233,138,0.3)]"
                    style={{ height: `${(val / niceMax) * 100}%` }}
                  />

                  {/* Tooltip */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-surface-highest text-white text-[10px] font-bold px-4 py-2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-20 shadow-2xl scale-90 group-hover:scale-100 border border-white/10 uppercase tracking-widest">
                    {isTime
                      ? `${Math.floor(val / 60)}m ${Math.round(val % 60)}s`
                      : `${val} Visits`}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-surface-highest rotate-45 -translate-y-1/2 border-r border-b border-white/10" />
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* X-Axis Labels */}
      <div className="flex items-start mt-6 pl-12">
        <div className="flex-1 flex justify-between gap-3 px-2">
          {labels.map((label, i) => (
            <div
              key={i}
              className="flex-1 max-w-16 text-center group"
            >
              <span className="text-[9px] font-bold text-slate-600 group-hover:text-primary transition-colors block truncate uppercase tracking-widest">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
