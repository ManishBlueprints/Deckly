import { useState, useEffect, Suspense, lazy, type ReactElement } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppToaster } from "./components/ui/app-toaster";
import { PresentationThemeBoundary } from "./components/ui/presentation-theme-boundary";
import { WorkspaceShell } from "./components/layout/WorkspaceShell";
import { TourProvider } from "./contexts/TourContext";
import { deckService } from "./services/deckService";
import { getOnboardingStage } from "./utils/onboarding";

// Lazy loaded pages
const Home = lazy(() => import("./pages/Home"));
const Viewer = lazy(() => import("./pages/Viewer"));
const OwnerDeckPreview = lazy(() => import("./pages/OwnerDeckPreview"));
const ManageDeck = lazy(() => import("./pages/ManageDeck"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ContentPage = lazy(() => import("./pages/ContentPage"));
const DeckAnalytics = lazy(() => import("./pages/DeckAnalytics"));
const EditDeck = lazy(() => import("./pages/EditDeck"));
const DataRoomsPage = lazy(() => import("./pages/DataRoomsPage"));
const ManageDataRoom = lazy(() => import("./pages/ManageDataRoom"));
const DataRoomDetail = lazy(() => import("./pages/DataRoomDetail"));
const DataRoomViewer = lazy(() => import("./pages/DataRoomViewer"));
const OwnerDataRoomPreview = lazy(() => import("./pages/OwnerDataRoomPreview"));
const SavedLibrary = lazy(() => import("./pages/SavedLibrary"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Feedback = lazy(() => import("./pages/Feedback"));
const Profile = lazy(() => import("./pages/Profile"));

const LoadingFallback = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-ui-canvas p-6 text-center text-ui-text">
    <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-ui-primary/15 border-t-ui-primary" aria-label="Loading" />
  </div>
);

const WorkspaceLoadError = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-ui-canvas p-6 text-center text-ui-text">
    <div className="w-full max-w-md space-y-4 rounded-[var(--ui-radius-major)] border border-ui-border bg-ui-surface p-6 shadow-[var(--ui-shadow-surface)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-ui-destructive/25 bg-ui-destructive/10 font-bold text-ui-destructive">
        !
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-ui-text">We couldn’t load your workspace</h2>
        <p className="text-sm text-ui-muted">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="rounded-[var(--ui-radius-control)] bg-ui-primary px-6 py-2.5 text-sm font-bold text-ui-primary-text transition-all hover:brightness-105"
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-ui-canvas p-6 text-center text-ui-text">
        <div className="mb-8 h-16 w-16 animate-spin rounded-full border-4 border-ui-primary/15 border-t-ui-primary" aria-label="Loading" />

        <h2 className="mb-2 text-xl font-bold text-ui-text">
          {initializationError === "connection_slow" || showSlowMessage
            ? "Waking up the Database..."
            : "Initializing Deckly..."}
        </h2>

        <p className="mb-8 max-w-[280px] text-sm leading-relaxed text-ui-muted">
          {initializationError === "connection_slow" || showSlowMessage
            ? "Supabase free-tier projects take a few seconds to wake up after being idle. Thanks for your patience!"
            : "Gathering your pitch decks and insights."}
        </p>

        {(showSlowMessage || initializationError === "connection_slow") && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-[var(--ui-radius-control)] bg-ui-primary px-6 py-2.5 text-sm font-bold text-ui-primary-text transition-all hover:brightness-105 active:scale-95"
            >
              Refresh App
            </button>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ui-muted">
              Tip: Press <kbd className="rounded bg-ui-subtle px-1">F12</kbd> or{" "}
              <kbd className="rounded bg-ui-subtle px-1">Cmd+Opt+I</kbd> to see
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
    <div className="min-h-screen bg-ui-canvas text-ui-text">
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
            element={requireSession(<PresentationThemeBoundary><OwnerDeckPreview /></PresentationThemeBoundary>)}
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
            element={requireSession(<PresentationThemeBoundary><OwnerDataRoomPreview /></PresentationThemeBoundary>)}
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
            path="/forgot-password"
            element={!session ? <ForgotPassword /> : <Navigate to="/" replace />}
          />
          <Route path="/reset-password" element={<ResetPassword />} />
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
            path="/saved-library"
            element={requireSession(<SavedLibrary />)}
          />
          <Route
            path="/saved-decks"
            element={requireSession(<Navigate to="/saved-library" replace />)}
          />
          <Route
            path="/feedback"
            element={requireSession(<Feedback />)}
          />
          <Route
            path="/profile"
            element={session ? <WorkspaceShell title="Profile"><Profile /></WorkspaceShell> : <Navigate to="/login" replace />}
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
          <Route path="/:handle/room/:slug" element={<PresentationThemeBoundary><DataRoomViewer /></PresentationThemeBoundary>} />
          <Route path="/:handle/:slug" element={<PresentationThemeBoundary><Viewer /></PresentationThemeBoundary>} />
          {/* Legacy Redirect Fallback */}
          <Route path="/:slug" element={<LegacyRedirect />} />
        </Routes>
      </Suspense>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TourProvider>
          <Router>
            <AppContent />
            <AppToaster />
          </Router>
        </TourProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
