import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useUserTotalStats } from "../../hooks/useUserTotalStats";
import { Loader2 } from "lucide-react";

export function WelcomeBanner() {
  const { profile, session } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const {
    data: stats,
    isLoading,
    isError,
  } = useUserTotalStats(session?.user?.id);

  return (
    <div className="relative overflow-hidden bg-surface-lowest border border-white/5 p-5 sm:p-8 md:p-12 md:py-14 group">
      {/* Mesh grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(84,233,138,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(84,233,138,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8">
        <div className="space-y-3 md:space-y-4">
          <div className="flex items-center gap-3 md:hidden">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Workspace
            </span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tighter leading-none text-foreground">
            Welcome, {firstName}.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base md:text-lg max-w-xl font-light leading-relaxed min-h-12 md:min-h-14">
            {isLoading ? (
              <span className="flex items-center gap-2 text-sm text-slate-500 mt-2">
                <Loader2 size={14} className="animate-spin" />
                Analyzing your portfolio...
              </span>
            ) : isError ? (
              <span className="text-sm font-medium text-red-400">
                Failed to load portfolio stats. Please refresh the page.
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
                  {stats?.deckCount || 0} active decks
                </span>
                . Keep reaching out to investors.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full md:w-auto">
          <Link
            to="/rooms"
            className="px-6 py-3 border border-white/10 text-slate-200 text-xs font-bold uppercase tracking-widest hover:bg-surface-bright transition-all text-center w-full sm:w-auto"
          >
            View Rooms
          </Link>
          <Link
            to="/upload"
            className="px-6 py-3 bg-primary text-black text-xs font-bold uppercase tracking-widest hover:brightness-110 shadow-[0_0_20px_rgba(84,233,138,0.2)] transition-all text-center w-full sm:w-auto"
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
