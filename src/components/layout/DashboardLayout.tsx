import React from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Plus, Pencil, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { deckService } from "../../services/deckService";
import penguinMascot from "../../assets/penguine.png";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  showFab?: boolean;
}

export function DashboardLayout({
  children,
  title: initialTitle = "Dashboard",
  showFab = true,
}: DashboardLayoutProps) {
  const { branding } = useAuth();
  const [roomName, setRoomName] = React.useState<string>(() => {
    try {
      const cached = localStorage.getItem("deckly-room-name");
      return cached || initialTitle;
    } catch {
      return initialTitle;
    }
  });
  const [isEditing, setIsEditing] = React.useState(false);
  const [tempName, setTempName] = React.useState(roomName);
  const loading = false;
  const isRefreshing = false;

  // Sync roomName with branding global state
  React.useEffect(() => {
    if (branding?.room_name) {
      setRoomName(branding.room_name);
      setTempName(branding.room_name);
      localStorage.setItem("deckly-room-name", branding.room_name);
    }
  }, [branding?.room_name]);

  const handleSave = async () => {
    if (!tempName.trim()) {
      setTempName(roomName);
      setIsEditing(false);
      return;
    }

    try {
      await deckService.updateBrandingSettings({ room_name: tempName });
      setRoomName(tempName);
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating room name:", err);
      setTempName(roomName);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setTempName(roomName);
    setIsEditing(false);
  };

  return (
    <div className="flex h-screen bg-[#09090b] overflow-hidden font-outfit selection:bg-deckly-primary/30">
      {/* Premium Background Mesh */}
      <div className="fixed inset-0 pointer-events-none opacity-40 z-0 bg-[radial-gradient(at_0%_0%,rgba(34,197,94,0.15)_0px,transparent_50%),radial-gradient(at_100%_0%,rgba(139,92,246,0.15)_0px,transparent_50%)]" />

      {/* Sidebar - desktop only */}
      <div className="hidden md:block relative z-10">
        <Sidebar />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Top Header */}
        <header className="h-14 md:h-20 flex items-center justify-between px-4 md:px-8 mx-4 md:mx-10 mt-4 md:mt-6 glass-shiny bg-[#09090b]/40 backdrop-blur-2xl border border-white/5 rounded-2xl md:rounded-[2rem] shadow-2xl shrink-0 z-20 overflow-hidden relative group">
          {/* Subtle Green Glow */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-48 h-48 bg-deckly-primary/10 rounded-full blur-[60px] pointer-events-none group-hover:bg-deckly-primary/20 transition-all duration-700" />

          <div className="flex items-center gap-4 flex-1 relative z-10">
            {isEditing ? (
              <div className="flex items-center gap-2 group">
                <input
                  autoFocus
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") handleCancel();
                  }}
                  className="text-2xl md:text-3xl font-bold text-white bg-white/5 border-b-2 border-deckly-primary outline-none px-2 py-1 rounded-t-lg min-w-[300px] tracking-tight"
                />
                <button
                  onClick={handleSave}
                  className="p-2 hover:bg-white/10 rounded-xl text-deckly-primary transition-all active:scale-90"
                >
                  <Check size={24} strokeWidth={3} />
                </button>
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-white/10 rounded-xl text-slate-500 transition-all active:scale-90"
                >
                  <X size={24} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <div
                className="flex items-center gap-4 group cursor-pointer"
                onClick={() => setIsEditing(true)}
              >
                <h1 className="text-lg md:text-3xl font-extrabold text-white flex items-center gap-2 md:gap-3 tracking-tight">
                  <img
                    src={branding?.logo_url || penguinMascot}
                    alt="Logo"
                    className="w-8 h-8 object-contain md:hidden rounded-xl bg-white/[0.05] p-1 border border-white/10"
                  />
                  <span className="truncate flex items-center gap-2">
                    {loading && !roomName ? "..." : roomName}
                    {isRefreshing && !loading && (
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-deckly-primary rounded-full animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.5)] shrink-0" />
                    )}
                  </span>
                </h1>
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-white/10">
                  <Pencil
                    size={14}
                    className="text-slate-400 group-hover:text-deckly-primary transition-colors"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-6">
            {/* Founder Mode Toggle Mockup */}
            <div className="flex items-center gap-3 relative z-10">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                Founder Mode
              </span>
              <div className="w-10 h-5 bg-deckly-primary rounded-full relative shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm"></div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-12 md:pt-6 relative">
          <div className="max-w-7xl mx-auto pb-24 md:pb-0">{children}</div>
        </div>

        {/* Floating Action Button */}
        {showFab && (
          <Link
            to="/upload"
            className="fixed bottom-24 md:bottom-10 right-6 md:right-10 w-20 h-20 bg-deckly-primary rounded-full flex items-center justify-center text-white shadow-2xl shadow-deckly-primary/40 hover:scale-110 active:scale-95 transition-all z-[100] group"
          >
            <Plus
              size={36}
              strokeWidth={3}
              className="group-hover:rotate-90 transition-transform duration-300"
            />
          </Link>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
