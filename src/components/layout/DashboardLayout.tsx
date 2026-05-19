import React from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import {
  Plus,
  Upload,
  Home as RoomIcon,
  User,
  LogOut,
  LifeBuoy,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAuth } from "../../contexts/AuthContext";
import { MascotSettingsModal } from "../dashboard/MascotSettingsModal";
import { NotificationBell } from "../notifications/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

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
  const { branding, setBranding, profile, signOut } = useAuth();
  const [fabOpen, setFabOpen] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);

  const pageLabels: Record<string, string> = {
    "/": "Dashboard",
    "/content": "Content",
    "/rooms": "Rooms",
    "/upload": "Upload Deck",
    "/saved-library": "Saved Library",
    "/saved-decks": "Saved Library",
    "/analytics": "Analytics",
    "/messages": "Messages",
    "/feedback": "Help & Feedback",
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

          <div className="flex items-center gap-2 md:gap-3">
            {profile?.id && <NotificationBell userId={profile.id} />}

            {/* Mobile Profile Link */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="md:hidden w-8 h-8 rounded-full bg-surface-low border border-white/5 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-primary/30 transition-all active:scale-90"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-bold text-primary/60">
                      {profile?.full_name?.charAt(0).toUpperCase() || "U"}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-2">
                <DropdownMenuLabel className="flex items-center gap-3 py-3 px-3 font-bold text-slate-100">
                  {profile?.avatar_url ? (
                    <div className="w-8 h-8 rounded-full bg-surface-low border border-white/10 overflow-hidden shrink-0">
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-primary">
                        {profile?.full_name?.charAt(0).toUpperCase() || "U"}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate leading-tight">
                      {profile?.full_name || "Account"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => navigate("/profile")}
                  className="flex items-center gap-2 py-3 cursor-pointer"
                >
                  <User size={16} className="text-primary" />
                  <span className="font-bold text-slate-200">Edit Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/feedback")}
                  className="flex items-center gap-2 py-3 cursor-pointer"
                >
                  <LifeBuoy size={16} className="text-primary" />
                  <span className="font-bold text-slate-200">
                    Help & Feedback
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={signOut}
                  className="flex items-center gap-2 py-3 cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-400/10"
                >
                  <LogOut size={16} />
                  <span className="font-bold">Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              <div className="absolute bottom-full right-0 mb-5 flex flex-col gap-3 w-64 bg-surface-low border border-white/10 p-2.5 rounded-none shadow-2xl shadow-primary/10 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-200">
                <button
                  onClick={() => handleFabAction("/rooms/new")}
                  className="w-full flex items-center gap-5 px-5 py-4 rounded-none hover:bg-primary/10 transition-all group text-slate-200 hover:text-primary"
                >
                  <div className="w-11 h-11 rounded-none bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <RoomIcon size={24} />
                  </div>
                  <div className="flex flex-col items-start translate-y-[1px]">
                    <span className="text-base font-bold tracking-tight">New Room</span>
                    <span className="text-[11px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">Create workspace</span>
                  </div>
                </button>
 
                <button
                  onClick={() => handleFabAction("/upload")}
                  className="w-full flex items-center gap-5 px-5 py-4 rounded-none hover:bg-primary/10 transition-all group text-slate-200 hover:text-primary"
                >
                  <div className="w-11 h-11 rounded-none bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Upload size={24} />
                  </div>
                  <div className="flex flex-col items-start translate-y-[1px]">
                    <span className="text-base font-bold tracking-tight">New Deck</span>
                    <span className="text-[11px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">Upload assets</span>
                  </div>
                </button>
              </div>
            )}
 
            {/* FAB Button */}
            <button
              onClick={() => setFabOpen(!fabOpen)}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 z-[100] relative border border-white/10 shadow-lg hover:scale-110 active:scale-95
                ${fabOpen ? "bg-[#1a1a1a] text-white" : "bg-deckly-primary text-slate-950 hover:bg-emerald-400 hover:shadow-primary/30"}
              `}
            >
              <div
                className={`transition-transform duration-300 ${fabOpen ? "rotate-45" : ""}`}
              >
                <Plus size={36} strokeWidth={2.5} />
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
