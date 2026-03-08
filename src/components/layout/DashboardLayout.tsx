import React from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Plus, Upload, Home as RoomIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
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
  const navigate = useNavigate();
  const [fabOpen, setFabOpen] = React.useState(false);

  const handleFabAction = (href: string) => {
    setFabOpen(false);
    navigate(href);
  };

  const loading = false;
  const isRefreshing = false;

  return (
    <div className="flex h-screen bg-[#0f0f0f] overflow-hidden font-outfit selection:bg-deckly-primary/30 text-slate-200">
      {/* Sidebar - desktop only */}
      <div className="hidden md:block relative z-10 w-[240px] shrink-0 border-r border-[#222]">
        <Sidebar />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-[#222] bg-[#0f0f0f] shrink-0 z-20">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-lg font-semibold text-slate-100 flex items-center gap-2 md:gap-3 tracking-tight">
              <img
                src={branding?.logo_url || penguinMascot}
                alt="Logo"
                className="w-6 h-6 object-contain md:hidden rounded-sm"
              />
              <span className="truncate flex items-center gap-2">
                {initialTitle}
                {isRefreshing && !loading && (
                  <div className="text-xs text-slate-500 ml-2 font-normal animate-pulse">
                    Syncing...
                  </div>
                )}
              </span>
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">
                Founder Mode
              </span>
              <div className="w-8 h-4 bg-deckly-primary rounded-full relative cursor-pointer">
                <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-slate-950 rounded-full" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative custom-scrollbar">
          <div className="max-w-6xl mx-auto pb-24 md:pb-0">{children}</div>
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
              <div className="absolute bottom-full right-0 mb-3 flex flex-col gap-2 w-48 bg-[#1a1a1a] border border-[#333] p-1.5 rounded-lg shadow-xl z-[100]">
                <button
                  onClick={() => handleFabAction("/rooms/new")}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#222] transition-colors text-slate-200"
                >
                  <RoomIcon size={16} />
                  <span className="text-sm font-medium">New Room</span>
                </button>

                <button
                  onClick={() => handleFabAction("/upload")}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#222] transition-colors text-slate-200"
                >
                  <Upload size={16} />
                  <span className="text-sm font-medium">New Deck</span>
                </button>
              </div>
            )}

            {/* FAB Button */}
            <button
              onClick={() => setFabOpen(!fabOpen)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 z-[100] relative border border-[#333] shadow-md
                ${fabOpen ? "bg-[#111] text-white" : "bg-deckly-primary text-slate-950 hover:bg-emerald-400"}
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
