import {
  useTopPerformingDecks,
  DeckStat,
} from "../../hooks/useTopPerformingDecks";
import { useUserTotalStats } from "../../hooks/useUserTotalStats";
import { useAuth } from "../../contexts/AuthContext";
import { BarChart3, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatRelativeTime } from "../../utils/date";

export function TopDecksCard() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const {
    data: stats = [],
    isLoading,
    isFetching,
  } = useTopPerformingDecks(userId);

  const { data: userStats } = useUserTotalStats(userId);
  const totalUserViews = userStats?.totalViews || 0;

  const loading = isLoading;
  const isRefreshing = isFetching;

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };
  return (
    <div className="flex flex-col h-full">
      {/* Section heading — same style as screen.png */}
      <div className="flex items-end justify-between mb-6 pb-4 border-b border-white/5">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-foreground">
            TOP PERFORMING DECKS
          </h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
            Active portfolio assets by traction
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isRefreshing && !loading && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                Live
              </span>
            </div>
          )}
          <Link
            to="/content"
            className="text-[10px] font-bold text-primary uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-1.5"
          >
            View All Decks <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* Card grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="bg-surface-low border border-white/5 p-6 h-48 animate-pulse"
              />
            ))}
        </div>
      ) : stats.length === 0 ? (
        <div className="bg-surface-low border border-white/5 flex-1 flex items-center justify-center p-12">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-center">
            No deck data yet
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stats.map((deck: DeckStat, index: number) => {
            const isFeatured = index === 0;

            return (
              <div
                key={deck.id}
                className="bg-surface-low border border-white/5 p-6"
              >
                {/* Top row: icon + badge */}
                <div className="flex items-start justify-between mb-6">
                  <div className="bg-surface-lowest w-10 h-10 flex items-center justify-center shrink-0 border border-white/5">
                    {isFeatured ? (
                      <BarChart3 size={18} className="text-primary" />
                    ) : (
                      <Users size={18} className="text-slate-500" />
                    )}
                  </div>
                  {isFeatured && (
                    <span className="text-[9px] font-bold px-2 py-0.5 uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                      Top Performer
                    </span>
                  )}
                </div>

                {/* Deck title + updated time */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-foreground truncate">
                    {deck.title}
                  </h4>
                  {(deck.updated_at || deck.created_at) && (
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {deck.updated_at ? "Updated" : "Created"}{" "}
                      {formatRelativeTime(deck.updated_at || deck.created_at)}
                    </p>
                  )}
                </div>

                {/* Stats: VIEWERS / TOTAL VIEWS */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                      Avg Session
                    </p>
                    <p className="text-xl font-bold text-foreground tracking-tight">
                      {formatTime(deck.avgSession)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                      Total Views
                    </p>
                    <p className="text-xl font-bold text-foreground tracking-tight">
                      {deck.views.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Share bar */}
                {totalUserViews > 0 && (
                  <div className="mt-4">
                    <div className="relative w-full h-px bg-white/5 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary"
                        style={{
                          width: `${Math.round((deck.views / totalUserViews) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest text-right mt-1">
                      {Math.round((deck.views / totalUserViews) * 100)}% share
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
