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
    <div className="group relative overflow-hidden rounded-[24px] border border-ui-border bg-ui-surface p-6 shadow-[var(--ui-shadow-surface)] sm:p-8">
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8">
        <div className="space-y-3 md:space-y-4">
          <div className="flex items-center gap-3 md:hidden">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ui-primary">
              Workspace
            </span>
            <span className="h-px flex-1 bg-ui-border" />
          </div>
          <h1 className="text-3xl font-semibold leading-none tracking-[-0.04em] text-ui-text sm:text-4xl">
            Welcome, {firstName}.
          </h1>
          <p className="min-h-12 max-w-xl text-sm leading-relaxed text-ui-muted sm:text-base">
            {isLoading ? (
              <span className="mt-2 flex items-center gap-2 text-sm text-ui-muted">
                <Loader2 size={14} className="animate-spin" />
                Analyzing your portfolio...
              </span>
            ) : isError ? (
              <span className="text-sm font-medium text-ui-destructive">
                Failed to load portfolio stats. Please refresh the page.
              </span>
            ) : (
              <>
                Your portfolio has reached{" "}
                <span className="font-medium text-ui-primary">
                  {stats?.totalViews || 0} views
                </span>{" "}
                and{" "}
                <span className="font-medium text-ui-primary">
                  {stats?.totalSaves || 0} saves
                </span>{" "}
                across{" "}
                <span className="font-medium text-ui-primary">
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
            className="w-full rounded-[14px] border border-ui-border px-6 py-3 text-center text-sm font-semibold text-ui-text transition-all hover:bg-ui-subtle sm:w-auto"
          >
            View rooms
          </Link>
          <Link
            to="/upload"
            className="w-full rounded-[14px] bg-ui-primary px-6 py-3 text-center text-sm font-semibold text-ui-primary-text shadow-[var(--ui-shadow-control)] transition-opacity hover:opacity-90 sm:w-auto"
          >
            New deck
          </Link>
        </div>
      </div>

      {/* Abstract visual element */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-ui-primary/5 blur-[100px]" />
    </div>
  );
}
