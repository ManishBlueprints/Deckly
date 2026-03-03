import React from "react";

export function AnalyticsSummary() {
  const stats = [
    { label: "Total Visit", value: "500" },
    { label: "Total Time Spent", value: "500" },
    { label: "Bookmarked", value: "100" },
  ];

  return (
    <div className="p-8 space-y-12">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Analytics
      </h3>
      <div className="space-y-12">
        {stats.map((stat, i) => (
          <div key={i}>
            <p className="text-5xl font-bold text-deckly-primary mb-1 tracking-tighter">
              {stat.value}
            </p>
            <p className="text-xs font-bold text-slate-900">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
