import { MessageSquare } from "lucide-react";

const placeholderComments = [
  {
    name: "Marcus Thorne",
    org: "Thorne Ventures",
    time: "12m ago",
    text: '"The revenue projections in slide 8 seem ambitious but the unit economics are solid. Let\'s discuss further on Tuesday."',
  },
  {
    name: "Sarah Chen",
    org: "Horizon Capital",
    time: "1h ago",
    text: '"Impressive go-to-market strategy. Can you share the underlying data for the TAM calculations?"',
  },
];

export function CommentsCard() {
  return (
    <div className="bg-surface-card border border-white/5 flex flex-col h-full group min-h-[280px]">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-foreground tracking-tight">
            MESSAGES
          </h3>
          <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 uppercase tracking-widest">
            Coming Soon
          </span>
        </div>
        <button
          disabled
          className="w-8 h-8 bg-primary/20 border border-primary/20 flex items-center justify-center text-primary opacity-50 cursor-not-allowed"
        >
          <span className="text-lg font-bold leading-none">+</span>
        </button>
      </div>

      {/* Placeholder comment items */}
      <div className="flex-1 divide-y divide-white/5 opacity-40 pointer-events-none select-none">
        {placeholderComments.map((c, i) => (
          <div key={i} className="p-6 flex gap-4">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-surface-highest border border-white/10 flex items-center justify-center shrink-0">
              <MessageSquare size={14} className="text-slate-500" />
            </div>
            {/* Content */}
            <div>
              <p className="text-xs font-bold text-foreground mb-0.5">
                {c.name}
              </p>
              <p className="text-[10px] text-slate-500 mb-3">
                {c.org} · {c.time}
              </p>
              <p className="text-sm text-slate-300 leading-relaxed italic">
                {c.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
