import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useUserTotalStats } from "../../hooks/useUserTotalStats";
import { useDecks } from "../../hooks/useDecks";
import { Loader2 } from "lucide-react";

export function WelcomeBanner() {
  const { profile, session } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const { data: stats, isLoading: statsLoading } = useUserTotalStats(
    session?.user?.id,
  );
  const { data: decks, isLoading: decksLoading } = useDecks(session?.user?.id);

  const isLoading = statsLoading || decksLoading;

  return (
    <div className="relative overflow-hidden bg-surface-lowest border border-white/5 p-10 md:p-12 md:py-14 group">
      {/* Mesh grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(84,233,138,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(84,233,138,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <h2 className="text-5xl font-bold tracking-tighter leading-none text-foreground">
            Welcome, {firstName}.
          </h2>
          <p className="text-slate-400 text-lg max-w-xl font-light h-14">
            {isLoading ? (
              <span className="flex items-center gap-2 text-sm text-slate-500 mt-2">
                <Loader2 size={14} className="animate-spin" />
                Analyzing your portfolio...
              </span>
            ) : (
              <>
                Your portfolio has reached{" "}
                <span className="text-primary font-medium">
                  {stats?.totalViews || 0} views
                </span>{" "}
                and{" "}
                <span className="text-primary font-medium">
                  {stats?.totalSaves || 0} saves
                </span>{" "}
                across{" "}
                <span className="text-primary font-medium">
                  {decks?.length || 0} active decks
                </span>
                . Keep reaching out to investors.
              </>
            )}
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            to="/rooms"
            className="px-6 py-3 border border-white/10 text-slate-200 text-xs font-bold uppercase tracking-widest hover:bg-surface-bright transition-all"
          >
            View Rooms
          </Link>
          <Link
            to="/upload"
            className="px-6 py-3 bg-primary text-black text-xs font-bold uppercase tracking-widest hover:brightness-110 shadow-[0_0_20px_rgba(84,233,138,0.2)] transition-all"
          >
            New Deck
          </Link>
        </div>
      </div>

      {/* Abstract visual element */}
      <div className="absolute -right-20 -top-20 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
    </div>
  );
}
