import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useDecks } from "../hooks/useDecks";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { DashboardView } from "../components/dashboard/DashboardView";
import { EmptyStateOverlay } from "../components/dashboard/EmptyStateOverlay";
import { HomeTour } from "../components/tours/HomeTour";
import { useQueryClient } from "@tanstack/react-query";
import { dataRoomService } from "../services/dataRoomService";
import { analyticsService } from "../services/analyticsService";
import { organizerService } from "../services/organizerService";

const DEFAULT_STALE_TIME = 30000;

function Home() {
  const { session } = useAuth();

  const {
    data: decks = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useDecks(session?.user?.id);

  const error = queryError ? (queryError as Error).message : null;



  // Layer 1: Global Preloading (Main lists and code chunks)
  const queryClient = useQueryClient();
  useEffect(() => {
    const preloadTimers: ReturnType<typeof setTimeout>[] = [];
    if (session?.user?.id && !loading) {
      // Small delay to ensure initial render is smooth
      const timer = setTimeout(() => {
        const userId = session.user.id;

        // 1. Data Prefetching (Main lists - metadata only)
        // Data Rooms List
        queryClient.prefetchQuery({
          queryKey: ["data-rooms"],
          queryFn: () => dataRoomService.getDataRooms(),
          staleTime: DEFAULT_STALE_TIME,
        });

        // User Stats
        queryClient.prefetchQuery({
          queryKey: ["user-total-stats", userId, "all"],
          queryFn: () => analyticsService.getUserTotalStats(userId),
          staleTime: DEFAULT_STALE_TIME,
        });

        // Saved Decks List (Complete Collection)
        queryClient.prefetchQuery({
          queryKey: ["library-decks", userId],
          queryFn: () => organizerService.getSavedDecksOrganized(userId),
          staleTime: DEFAULT_STALE_TIME,
        });

        queryClient.prefetchQuery({
          queryKey: ["library-folders", userId],
          queryFn: () => organizerService.getFolders(userId),
          staleTime: DEFAULT_STALE_TIME,
        });

        queryClient.prefetchQuery({
          queryKey: ["library-tags", userId],
          queryFn: () => organizerService.getTags(userId),
          staleTime: DEFAULT_STALE_TIME,
        });

        // 2. Code Preloading (Lazy chunks)
        const preloadPages = [
          () => import("./DataRoomsPage"),
          () => import("./ContentPage"),
          () => import("./SavedDecks"),
          () => import("./Profile"),
          () => import("./Viewer"),
        ];
        
        // Execute preloads sequentially to avoid network congestion
        preloadPages.forEach((preload, idx) => {
          const pTimer = setTimeout(() => preload().catch(() => {}), idx * 500);
          preloadTimers.push(pTimer);
        });
      }, 1000);

      return () => {
        clearTimeout(timer);
        preloadTimers.forEach(t => clearTimeout(t));
      };
    }
  }, [session?.user?.id, loading, queryClient]);

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
      <HomeTour deckCount={decks.length} />
      {decks.length === 0 ? <EmptyStateOverlay /> : <DashboardView />}
    </DashboardLayout>
  );
}

export default Home;
