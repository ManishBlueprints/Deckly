import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Home from "./pages/Home";
import Viewer from "./pages/Viewer";
import ManageDeck from "./pages/ManageDeck";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ContentPage from "./pages/ContentPage";
import DeckAnalytics from "./pages/DeckAnalytics";
import EditDeck from "./pages/EditDeck";
import DataRoomsPage from "./pages/DataRoomsPage";
import ManageDataRoom from "./pages/ManageDataRoom";
import DataRoomDetail from "./pages/DataRoomDetail";
import DataRoomViewer from "./pages/DataRoomViewer";
import SavedDecks from "./pages/SavedDecks";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import "./App.css";

const AppContent = () => {
  const { session, loading, initializationError } = useAuth();
  const [showSlowMessage, setShowSlowMessage] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (loading) {
      timeout = setTimeout(() => {
        setShowSlowMessage(true);
      }, 8000);
    } else {
      setShowSlowMessage(false);
    }
    return () => clearTimeout(timeout);
  }, [loading, initializationError, !!session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-deckly-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 mb-8 relative">
          <div className="absolute inset-0 border-4 border-deckly-primary/10 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-deckly-primary rounded-full animate-spin"></div>
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
          path="/"
          element={session ? <Home /> : <Navigate to="/login" />}
        />
        <Route path="/:username/room/:slug" element={<DataRoomViewer />} />
        <Route path="/:username/:slug" element={<Viewer />} />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
