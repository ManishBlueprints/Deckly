import { useState, useEffect, Suspense, lazy, type ReactElement } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TourProvider } from "./contexts/TourContext";
import { deckService } from "./services/deckService";
import { getOnboardingStage } from "./utils/onboarding";
import "./App.css";

// Lazy loaded pages
const Home = lazy(() => import("./pages/Home"));
const Viewer = lazy(() => import("./pages/Viewer"));
const OwnerDeckPreview = lazy(() => import("./pages/OwnerDeckPreview"));
const ManageDeck = lazy(() => import("./pages/ManageDeck"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ContentPage = lazy(() => import("./pages/ContentPage"));
const DeckAnalytics = lazy(() => import("./pages/DeckAnalytics"));
const EditDeck = lazy(() => import("./pages/EditDeck"));
const DataRoomsPage = lazy(() => import("./pages/DataRoomsPage"));
const ManageDataRoom = lazy(() => import("./pages/ManageDataRoom"));
const DataRoomDetail = lazy(() => import("./pages/DataRoomDetail"));
const DataRoomViewer = lazy(() => import("./pages/DataRoomViewer"));
const OwnerDataRoomPreview = lazy(() => import("./pages/OwnerDataRoomPreview"));
const SavedDecks = lazy(() => import("./pages/SavedDecks"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Feedback = lazy(() => import("./pages/Feedback"));
const Profile = lazy(() => import("./pages/Profile"));

const LoadingFallback = () => (
  <div className="min-h-screen bg-deckly-background flex flex-col items-center justify-center p-6 text-center">
    <div className="w-12 h-12 mb-4 relative">
      <div className="absolute inset-0 border-4 border-[#54e98a]/10 rounded-full"></div>
      <div className="absolute inset-0 border-4 border-t-[#54e98a] rounded-full animate-spin"></div>
    </div>
  </div>
);

const WorkspaceLoadError = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <div className="min-h-screen bg-deckly-background flex flex-col items-center justify-center p-6 text-center">
    <div className="max-w-md w-full border border-white/10 bg-white/5 p-6 space-y-4">
      <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold">
        !
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-white">We couldn’t load your workspace</h2>
        <p className="text-sm text-slate-400">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 bg-deckly-primary text-slate-950 text-sm font-bold hover:brightness-110 transition-all"
      >
        Retry
      </button>
    </div>
  </div>
);

const LegacyRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function findHandle() {
      if (!slug) {
        setLoading(false);
        return;
      }
      try {
        const result = await deckService.getDeckBySlugOnly(slug);
        if (result) {
          setRedirectPath(`/${result.handle}/${result.slug}`);
        } else {
          setRedirectPath("/"); // Fallback to home if not found
        }
      } catch (err) {
        console.error("Redirect error:", err);
        setRedirectPath("/");
      } finally {
        setLoading(false);
      }
    }
    findHandle();
  }, [slug]);

  if (loading) return <LoadingFallback />;
  if (redirectPath) return <Navigate to={redirectPath} replace />;
  return <Navigate to="/" replace />;
};

const AppContent = () => {
  const {
    session,
    loading,
    initializationError,
    profile,
    branding,
    profileLoading,
    profileError,
    brandingLoading,
    brandingError,
    refreshProfile,
    refreshBranding,
  } = useAuth();
  const [showSlowMessage, setShowSlowMessage] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (loading) {
      timeout = setTimeout(() => {
        setShowSlowMessage(true);
      }, 1500); // Reduced from 3s to 1.5s for even faster user feedback
    } else {
      setShowSlowMessage(false);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-deckly-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 mb-8 relative">
          <div className="absolute inset-0 border-4 border-[#54e98a]/10 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-[#54e98a] rounded-full animate-spin"></div>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          {initializationError === "connection_slow" || showSlowMessage
            ? "Waking up the Database..."
            : "Initializing Deckly..."}
        </h2>

        <p className="text-slate-400 text-sm max-w-[280px] leading-relaxed mb-8">
          {initializationError === "connection_slow" || showSlowMessage
            ? "Supabase free-tier projects take a few seconds to wake up after being idle. Thanks for your patience!"
            : "Gathering your pitch decks and insights."}
        </p>

        {(showSlowMessage || initializationError === "connection_slow") && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-deckly-primary text-slate-950 rounded-xl text-sm font-bold hover:bg-opacity-90 transition-all active:scale-95"
            >
              Refresh App
            </button>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              Tip: Press <kbd className="bg-white/10 px-1 rounded">F12</kbd> or{" "}
              <kbd className="bg-white/10 px-1 rounded">Cmd+Opt+I</kbd> to see
              diagnostic logs
            </p>
          </div>
        )}
      </div>
    );
  }

  if (session && (profileLoading || brandingLoading)) {
    return <LoadingFallback />;
  }

  if (session && (profileError || brandingError)) {
    const message = profileError && brandingError
      ? "We couldn’t load your profile or workspace settings. Please retry."
      : profileError
        ? "We couldn’t load your profile. Please retry."
        : "We couldn’t load your workspace settings. Please retry.";

    return (
      <WorkspaceLoadError
        message={message}
        onRetry={async () => {
          await Promise.all([refreshProfile(), refreshBranding()]);
        }}
      />
    );
  }

  const onboardingStage = getOnboardingStage(profile, branding);
  const onboardingRedirect = (
    <Navigate
      to={`/profile?onboarding=${onboardingStage === "about-you" ? "about-you" : "workspace"}`}
      replace
    />
  );

  const requireSession = (element: ReactElement) =>
    session ? (onboardingStage === "complete" ? element : onboardingRedirect) : <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-deckly-background text-slate-200 selection:bg-deckly-primary/30 selection:text-deckly-primary">
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route
            path="/content"
            element={requireSession(<ContentPage />)}
          />
          <Route
            path="/upload"
            element={requireSession(<ManageDeck />)}
          />
          <Route
            path="/analytics/:deckId"
            element={requireSession(<DeckAnalytics />)}
          />
          <Route
            path="/preview/deck/:deckId"
            element={requireSession(<OwnerDeckPreview />)}
          />
          <Route
            path="/edit/:deckId"
            element={requireSession(<EditDeck />)}
          />
          <Route
            path="/rooms"
            element={requireSession(<DataRoomsPage />)}
          />
          <Route
            path="/rooms/new"
            element={requireSession(<ManageDataRoom />)}
          />
          <Route
            path="/rooms/:roomId"
            element={requireSession(<DataRoomDetail />)}
          />
          <Route
            path="/preview/room/:roomId"
            element={requireSession(<OwnerDataRoomPreview />)}
          />
          <Route
            path="/rooms/:roomId/edit"
            element={requireSession(<ManageDataRoom />)}
          />
          <Route
            path="/login"
            element={
              !session ? (
                <Login />
              ) : onboardingStage === "complete" ? (
                <Navigate to="/" replace />
              ) : (
                <Navigate
                  to={`/profile?onboarding=${onboardingStage === "about-you" ? "about-you" : "workspace"}`}
                  replace
                />
              )
            }
          />
          <Route
            path="/signup"
            element={
              !session ? (
                <Signup />
              ) : onboardingStage === "complete" ? (
                <Navigate to="/" replace />
              ) : (
                <Navigate
                  to={`/profile?onboarding=${onboardingStage === "about-you" ? "about-you" : "workspace"}`}
                  replace
                />
              )
            }
          />
          <Route
            path="/saved-decks"
            element={requireSession(<SavedDecks />)}
          />
          <Route
            path="/feedback"
            element={requireSession(<Feedback />)}
          />
          <Route
            path="/profile"
            element={session ? <Profile /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/admin"
            element={requireSession(<AdminDashboard />)}
          />
          <Route
            path="/admin/notifications"
            element={requireSession(<Navigate to="/admin" replace />)}
          />
          <Route
            path="/"
            element={requireSession(<Home />)}
          />
          <Route path="/:handle/room/:slug" element={<DataRoomViewer />} />
          <Route path="/:handle/:slug" element={<Viewer />} />
          {/* Legacy Redirect Fallback */}
          <Route path="/:slug" element={<LegacyRedirect />} />
        </Routes>
      </Suspense>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <TourProvider>
        <Router>
          <AppContent />
          <Toaster theme="dark" richColors />
        </Router>
      </TourProvider>
    </AuthProvider>
  );
}

export default App;
