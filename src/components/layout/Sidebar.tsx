import {
  LayoutGrid,
  Folder,
  DoorOpen,
  LineChart,
  Bookmark,
  MessageSquare,
  LogOut,
  ChevronLeft,
  Settings,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../../utils/cn";
import penguinMascot from "../../assets/penguine.png";
import { useAuth } from "../../contexts/AuthContext";
import { useState } from "react";
import { createPortal } from "react-dom";
import { MascotSettingsModal } from "../dashboard/MascotSettingsModal";

const NAV_ITEMS = [
  { icon: LayoutGrid, label: "Dashboard", href: "/" },
  { icon: Folder, label: "Content", href: "/content" },
  { icon: DoorOpen, label: "Rooms", href: "/rooms" },
  { icon: Bookmark, label: "Saved Decks", href: "/saved-decks" },
  {
    icon: LineChart,
    label: "Full Analytics",
    href: "/analytics",
    disabled: true,
  },
  { icon: MessageSquare, label: "Messages", href: "/requests", disabled: true },
];

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem("sidebar-collapsed") === "true";
  } catch {
    return false;
  }
}

export function Sidebar() {
  const location = useLocation();
  const { profile, signOut, branding, setBranding } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed);

  function toggleCollapsed() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem("sidebar-collapsed", String(next));
    } catch {
      // Ignore localStorage errors (e.g. incognito mode)
    }
  }

  return (
    <aside
      style={{ width: isCollapsed ? 64 : 256 }}
      className="bg-[#0e0e0e] flex flex-col h-screen shrink-0 relative z-50 shadow-[24px_0_48px_rgba(0,0,0,0.4)] transition-all duration-300 py-8"
    >
      {/* Collapse toggle */}
      <button
        onClick={toggleCollapsed}
        className="absolute top-5 -right-3.5 z-50 w-7 h-7 bg-[#0e0e0e] border border-white/5 flex items-center justify-center text-slate-500 hover:text-slate-200 shadow-2xl transition-all active:scale-90"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronLeft
          size={14}
          className={cn(
            "transition-transform duration-200",
            isCollapsed ? "rotate-180" : "rotate-0",
          )}
        />
      </button>

      {/* ── Brand Header (Restored Logic) ── */}
      <div className={cn("p-4 shrink-0 mt-2 mb-8")}>
        <div
          className={cn(
            "flex items-center gap-3",
            isCollapsed && "justify-center",
          )}
        >
          {/* Logo icon */}
          <button
            onClick={() => setShowSettings(true)}
            title="Workspace Settings"
            className="w-10 h-10 bg-surface-low border border-white/5 flex items-center justify-center shrink-0 hover:border-primary transition-colors overflow-hidden relative group"
          >
            <img
              src={branding?.logo_url || penguinMascot}
              alt="Logo"
              className="w-full h-full object-contain p-1"
            />
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Settings size={14} className="text-white fill-white" />
            </div>
          </button>

          {/* Workspace name */}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
                Workspace
              </p>
              <p className="text-[13px] font-bold text-slate-100 truncate leading-tight">
                {branding?.room_name || "Venture Curator"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Nav ── */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto custom-scrollbar p-3 space-y-0.5 mt-2",
        )}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.label}
              to={item.href}
              title={isCollapsed ? item.label : undefined}
              tabIndex={item.disabled ? -1 : undefined}
              aria-disabled={item.disabled ? true : undefined}
              className={cn(
                "flex items-center gap-3 px-6 py-3 transition-all relative group",
                isActive
                  ? "bg-[#3a3939] text-primary border-l-2 border-primary"
                  : item.disabled ? "opacity-30 pointer-events-none" : "text-slate-500 hover:text-white hover:bg-[#1c1c1c]",
                isCollapsed && "justify-center px-0",
              )}
            >
              
              <div
                className={cn(
                  "flex shrink-0 transition-all",
                  isActive ? "text-primary bg-primary/10 p-1 scale-110" : "text-slate-500 group-hover:text-slate-200",
                )}
              >
                <item.icon 
                  size={isCollapsed ? 20 : 18} 
                  strokeWidth={isActive ? 2 : 1.5} 
                  className={cn(
                    "transition-all",
                    !isActive && "opacity-40 group-hover:opacity-100"
                  )}
                />
              </div>
              {!isCollapsed && (
                <span className={cn(
                  "text-sm font-medium tracking-wide truncate flex-1 uppercase",
                  isActive ? "text-primary" : "text-inherit"
                )}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User Profile Footer ── */}
      <div className={cn("px-6 mt-auto shrink-0")}>
        <div className={cn("flex flex-col gap-1", isCollapsed && "items-center")}>
          <div className="flex items-center gap-3 border-t border-white/5 pt-4">
            <div className="w-8 h-8 bg-surface-high overflow-hidden shrink-0 flex items-center justify-center">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || "User"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-slate-400 font-medium text-xs">
                  {profile?.full_name?.charAt(0) || "U"}
                </span>
              )}
            </div>

            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-100 truncate leading-none">
                    {profile?.full_name?.split(" ")[0] || "User"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter truncate mt-1">
                    {profile?.tier || "Managing Partner"}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    signOut();
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors shrink-0"
                  title="Sign Out"
                >
                  <LogOut size={16} strokeWidth={1.5} fill="currentColor" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Settings modal */}
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
    </aside>
  );
}
