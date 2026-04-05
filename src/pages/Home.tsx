import { useAuth } from "../contexts/AuthContext";
import { useDecks } from "../hooks/useDecks";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { DashboardView } from "../components/dashboard/DashboardView";
import { EmptyStateOverlay } from "../components/dashboard/EmptyStateOverlay";
import { WorkspaceSetupModal } from "../components/dashboard/WorkspaceSetupModal";
import { HomeTour } from "../components/tours/HomeTour";

function Home() {
  const { session, profile } = useAuth();

  const {
    data: decks = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useDecks(session?.user?.id);

  const error = queryError ? (queryError as Error).message : null;

  if (error) {
    return (
      <DashboardLayout title="Error">
        <div className="flex flex-col items-center justify-center p-6 text-center py-20">
          <div className="w-16 h-16 mb-8 text-red-500">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="w-full h-full"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Error loading dashboard
          </h2>
          <p className="text-slate-500 text-sm max-w-[280px] leading-relaxed mb-8">
            {error}
          </p>
          <button
            onClick={() => refetch()}
            className="px-8 py-3 bg-deckly-primary text-white rounded-xl text-sm font-bold hover:bg-opacity-90 transition-all active:scale-95"
          >
            Try Again
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="flex flex-col items-center justify-center py-40 gap-4 text-slate-400">
          <div className="w-10 h-10 border-2 border-deckly-primary/20 border-t-deckly-primary rounded-full animate-spin" />
          <p className="font-medium">Loading your stats...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dashboard">
      <WorkspaceSetupModal
        isOpen={!!profile && !profile.handle}
        userId={session?.user?.id || ""}
        onComplete={() => {
          window.location.reload();
        }}
      />
      <HomeTour />
      {decks.length === 0 ? <EmptyStateOverlay /> : <DashboardView />}
    </DashboardLayout>
  );
}

export default Home;
