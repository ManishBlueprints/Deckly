import React from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Plus, Upload, Home as RoomIcon } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../../contexts/AuthContext";
import { MascotSettingsModal } from "../dashboard/MascotSettingsModal";
import { NotificationBell } from "../notifications/NotificationBell";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  showFab?: boolean;
}

export function DashboardLayout({
  children,
  title = "Dashboard",
  showFab = true,
}: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { branding, setBranding, profile } = useAuth();
  const [fabOpen, setFabOpen] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);

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
    )?.[1] ?? title;
  const workspaceName =
    branding?.room_name || profile?.full_name || "Workspace";
  const workspaceInitial = workspaceName.charAt(0).toUpperCase() || "W";

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
        <header className="w-full h-16 sticky top-0 z-40 bg-background flex items-center justify-between px-4 sm:px-8 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setShowSettings(true)}
              className="md:hidden flex items-center gap-3 min-w-0 group hover:opacity-80 transition-opacity text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-surface-low border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                {branding?.logo_url ? (
                  <img
                    src={branding.logo_url}
                    alt={workspaceName}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <span className="text-[11px] font-bold text-primary">
                    {workspaceInitial}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
                  Workspace
                </p>
                <p className="text-sm font-bold text-slate-100 truncate leading-tight">
                  {workspaceName}
                </p>
              </div>
            </button>

            <span className="hidden md:inline-flex text-primary text-[10px] font-bold uppercase tracking-[0.3em]">
              {currentLabel}
            </span>
          </div>
          <div className="md:hidden flex items-center">
            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
              {currentLabel}
            </span>
          </div>
          {/* Notification Bell — top right */}
          {profile?.id && <NotificationBell userId={profile.id} />}{" "}
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

      {/* Workspace Settings Modal (Mobile & Global) */}
      {createPortal(
        <MascotSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          branding={branding}
          onUpdate={(newBranding) => setBranding(newBranding)}
          userProfile={profile || undefined}
        />,
        document.body,
      )}
    </div>
  );
}
