import {
  useTopPerformingDecks,
  useDeckSignalCounts,
} from "../../hooks/useTopPerformingDecks";
import { useUserTotalStats } from "../../hooks/useUserTotalStats";
import { useAuth } from "../../contexts/AuthContext";
import { DashboardCard } from "../ui/DashboardCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

export function TopDecksCard() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const {
    data: stats = [],
    isLoading,
    isFetching,
  } = useTopPerformingDecks(userId);

  const deckIds = stats.map((s) => s.id);
  const { data: signalCounts = {} } = useDeckSignalCounts(deckIds);

  const { data: userStats } = useUserTotalStats(userId);
  const totalUserViews = userStats?.totalViews || 0;

  const loading = isLoading;
  const isRefreshing = isFetching;

  return (
    <DashboardCard
      title="Top Performing Decks"
      headerAction={
        <div className="flex items-center gap-3">
          {isRefreshing && !loading && (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-deckly-primary rounded-full animate-ping" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">
                Syncing
              </span>
            </div>
          )}
          <div className="w-2 h-2 rounded-full bg-deckly-primary animate-pulse shadow-[0_0_8px_rgba(42,212,133,0.5)]"></div>
        </div>
      }
    >
      <Table>
        <TableHeader className="hidden">
          <TableRow>
            <TableHead>Deck</TableHead>
            <TableHead className="text-right">Stats</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array(3)
              .fill(0)
              .map((_, i) => (
                <TableRow
                  key={i}
                  className="border-b border-white/5 last:border-0"
                >
                  <TableCell className="p-8">
                    <div className="h-5 w-40 bg-white/5 animate-pulse rounded-lg" />
                  </TableCell>
                  <TableCell className="p-8 text-right">
                    <div className="h-5 w-20 bg-white/5 animate-pulse rounded-lg ml-auto" />
                  </TableCell>
                </TableRow>
              ))
          ) : stats.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={2}
                className="p-16 text-center text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em]"
              >
                No statistical data available yet
              </TableCell>
            </TableRow>
          ) : (
            stats.map((deck, idx) => (
              <TableRow
                key={deck.id}
                className="hover:bg-white/[0.02] border-b border-white/5 last:border-0 group transition-all duration-300"
              >
                <TableCell className="px-8 py-8 min-w-[240px]">
                  <span className="font-bold text-slate-200 group-hover:text-deckly-primary transition-colors text-lg tracking-tight">
                    {deck.title}
                  </span>
                  {signalCounts[deck.id] > 0 && (
                    <p className="text-[10px] font-bold text-deckly-primary mt-1 uppercase tracking-widest opacity-80">
                      {signalCounts[deck.id]} Interested Viewer
                      {signalCounts[deck.id] > 1 ? "s" : ""}
                    </p>
                  )}
                </TableCell>
                <TableCell className="px-8 py-8 text-right">
                  <div className="flex gap-10 justify-end items-center">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white group-hover:text-deckly-primary transition-colors leading-none tracking-tighter">
                        {deck.views.toLocaleString()}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mt-1">
                        Views
                      </p>
                    </div>

                    {/* Share Metric */}
                    <div className="text-right flex flex-col items-end group/share relative">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-2 bg-white/5 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-deckly-primary rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                            style={{
                              width: `${totalUserViews > 0 ? Math.round((deck.views / totalUserViews) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <p className="text-2xl font-bold text-white group-hover:text-deckly-primary transition-colors leading-none tracking-tighter">
                          {totalUserViews > 0
                            ? Math.round((deck.views / totalUserViews) * 100)
                            : 0}
                          %
                        </p>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mt-1">
                        Share
                      </p>

                      {/* Tooltip */}
                      <div
                        className={`absolute ${idx === 0 ? "top-full mt-3" : "bottom-full mb-3"} right-0 w-56 p-3 bg-[#09090b] text-[10px] text-slate-400 rounded-xl opacity-0 group-hover/share:opacity-100 transition-all pointer-events-none z-50 text-center font-bold leading-tight shadow-[0_10px_40px_rgba(0,0,0,0.8)] border border-white/10 uppercase tracking-widest scale-90 group-hover/share:scale-100 origin-right`}
                      >
                        Percentage of your total audience that viewed this deck.
                        <div
                          className={`absolute ${idx === 0 ? "bottom-full border-b-[#09090b]" : "top-full border-t-[#09090b]"} right-6 border-8 border-transparent`}
                        />
                      </div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {!loading && stats.length > 0 && stats.length < 3 && (
        <div className="h-24"></div>
      )}
    </DashboardCard>
  );
}
