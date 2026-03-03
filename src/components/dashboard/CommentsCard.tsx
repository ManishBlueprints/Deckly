import { DashboardCard } from "../ui/DashboardCard";
import { Badge } from "../ui/badge";

export function CommentsCard() {
  return (
    <DashboardCard
      title="Recent Comments"
      headerAction={
        <Badge className="bg-white/5 text-[8px] font-bold text-slate-500 uppercase tracking-widest border-white/10 px-2 py-0.5">
          Coming Soon
        </Badge>
      }
      contentClassName="p-16 flex flex-col items-center justify-center text-center bg-white/[0.01]"
    >
      <div className="w-20 h-20 bg-white/[0.02] rounded-3xl flex items-center justify-center mb-8 border border-white/5 shadow-xl transition-all hover:scale-110 hover:border-deckly-primary/30 group">
        <svg
          className="w-10 h-10 text-slate-700 transition-colors group-hover:text-deckly-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </div>
      <p className="text-xs font-bold text-slate-500 max-w-[220px] leading-relaxed uppercase tracking-widest opacity-60">
        Investor comments and reactions will appear here.
      </p>
    </DashboardCard>
  );
}
