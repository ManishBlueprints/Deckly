import { useState, useEffect, Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { deckService } from "./services/deckService";
import "./App.css";

// Lazy loaded pages
const Home = lazy(() => import("./pages/Home"));
const Viewer = lazy(() => import("./pages/Viewer"));
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
const SavedDecks = lazy(() => import("./pages/SavedDecks"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

const LoadingFallback = () => (
  <div className="min-h-screen bg-deckly-background flex flex-col items-center justify-center p-6 text-center">
    <div className="w-12 h-12 mb-4 relative">
      <div className="absolute inset-0 border-4 border-[#54e98a]/10 rounded-full"></div>
      <div className="absolute inset-0 border-4 border-t-[#54e98a] rounded-full animate-spin"></div>
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
  const { session, loading, initializationError } = useAuth();
  const [showSlowMessage, setShowSlowMessage] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (loading) {
      timeout = setTimeout(() => {
        setShowSlowMessage(true);
      }, 3000); // Reduced from 8s to 3s for faster user feedback
    } else {
      setShowSlowMessage(false);
    }
    return () => clearTimeout(timeout);
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

  return (
    <div className="min-h-screen bg-deckly-background text-slate-200 selection:bg-deckly-primary/30 selection:text-deckly-primary">
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route
            path="/content"
            element={session ? <ContentPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/upload"
            element={session ? <ManageDeck /> : <Navigate to="/login" />}
          />
          <Route
            path="/analytics/:deckId"
            element={session ? <DeckAnalytics /> : <Navigate to="/login" />}
          />
          <Route
            path="/edit/:deckId"
            element={session ? <EditDeck /> : <Navigate to="/login" />}
          />
          <Route
            path="/rooms"
            element={session ? <DataRoomsPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/rooms/new"
            element={session ? <ManageDataRoom /> : <Navigate to="/login" />}
          />
          <Route
            path="/rooms/:roomId"
            element={session ? <DataRoomDetail /> : <Navigate to="/login" />}
          />
          <Route
            path="/rooms/:roomId/edit"
            element={session ? <ManageDataRoom /> : <Navigate to="/login" />}
          />
          <Route
            path="/login"
            element={!session ? <Login /> : <Navigate to="/" />}
          />
          <Route
            path="/signup"
            element={!session ? <Signup /> : <Navigate to="/" />}
          />
          <Route
            path="/saved-decks"
            element={session ? <SavedDecks /> : <Navigate to="/login" />}
          />
          <Route
            path="/admin"
            element={session ? <AdminDashboard /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/admin/notifications"
            element={session ? <Navigate to="/admin" replace /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/"
            element={session ? <Home /> : <Navigate to="/login" />}
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
      <Router>
        <AppContent />
        <Toaster theme="dark" richColors />
      </Router>
    </AuthProvider>
  );
}

export default App;
