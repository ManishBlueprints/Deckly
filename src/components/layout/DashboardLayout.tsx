import React from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Plus, Upload, Home as RoomIcon } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, Settings } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  showFab?: boolean;
}

export function DashboardLayout({
  children,
  title: _initialTitle = "Dashboard",
  showFab = true,
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [fabOpen, setFabOpen] = React.useState(false);

  const pageLabels: Record<string, string> = {
    "/": "Dashboard",
    "/content": "Content",
    "/rooms": "Rooms",
    "/upload": "Upload Deck",
    "/saved-decks": "Saved Decks",
    "/analytics": "Analytics",
    "/messages": "Messages",
    "/settings": "Settings",
  };

  const currentLabel =
    Object.entries(pageLabels).find(([path]) =>
      path === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(path),
    )?.[1] ?? "Dashboard";

  const handleFabAction = (href: string) => {
    setFabOpen(false);
    navigate(href);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden font-manrope selection:bg-primary/20 text-foreground">
      {/* Sidebar - desktop only */}
      <div className="hidden md:block relative z-20 shrink-0">
        <Sidebar />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Top Header */}
        <header className="w-full h-16 sticky top-0 z-40 bg-background flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <span className="text-primary text-[10px] font-bold uppercase tracking-[0.3em]">
              {currentLabel}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <button
                className="text-slate-400 hover:bg-surface-high p-2 transition-all active:scale-95"
                title="Notifications"
              >
                <Bell size={18} />
              </button>
              <button
                className="text-slate-400 hover:bg-surface-high p-2 transition-all active:scale-95"
                title="Settings"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 relative custom-scrollbar">
          <div className="max-w-[1600px] mx-auto pb-24 md:pb-0">{children}</div>
        </div>

        {/* Floating Action Button */}
        {showFab && (
          <div className="hidden md:block fixed bottom-8 right-8 z-[100]">
            {/* Backdrop */}
            {fabOpen && (
              <div
                onClick={() => setFabOpen(false)}
                className="fixed inset-0 z-[90]"
              />
            )}

            {/* Popout Options */}
            {fabOpen && (
              <div className="absolute bottom-full right-0 mb-3 flex flex-col gap-2 w-48 bg-deckly-background border border-white/5 p-1.5 rounded-lg shadow-xl z-[100]">
                <button
                  onClick={() => handleFabAction("/rooms/new")}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 transition-colors text-slate-200"
                >
                  <RoomIcon size={16} />
                  <span className="text-sm font-medium">New Room</span>
                </button>

                <button
                  onClick={() => handleFabAction("/upload")}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 transition-colors text-slate-200"
                >
                  <Upload size={16} />
                  <span className="text-sm font-medium">New Deck</span>
                </button>
              </div>
            )}

            {/* FAB Button */}
            <button
              onClick={() => setFabOpen(!fabOpen)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 z-[100] relative border border-white/10 shadow-md
                ${fabOpen ? "bg-deckly-background text-white" : "bg-deckly-primary text-slate-950 hover:bg-emerald-400"}
              `}
            >
              <div
                className={`transition-transform duration-200 ${fabOpen ? "rotate-45" : ""}`}
              >
                <Plus size={24} strokeWidth={2.5} />
              </div>
            </button>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
