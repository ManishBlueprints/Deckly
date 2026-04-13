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
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../utils/cn";
import penguinMascot from "../../assets/penguine.png";
import { useAuth } from "../../contexts/AuthContext";
import { useState, useEffect } from "react";
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

const TIER_CONFIG = {
  FREE: {
    label: "Free",
    className: "bg-slate-800/50 text-slate-500 border-white/5",
  },
  PRO: {
    label: "Pro",
    className: "bg-amber-400 text-slate-950 border-amber-500/50",
  },
  PRO_PLUS: {
    label: "Pro Plus",
    className: "bg-purple-600 text-white border-purple-500/50 shadow-[0_0_15px_rgba(147,51,234,0.3)]",
  },
};

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, branding, setBranding } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed);

  // Listen for programmatic open requests (e.g., from HomeTour)
  useEffect(() => {
    const handleOpenSettings = () => setShowSettings(true);
    window.addEventListener("deckly:open-settings", handleOpenSettings);
    return () =>
      window.removeEventListener("deckly:open-settings", handleOpenSettings);
  }, []);

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
            id="tour-workspace-settings"
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

          const Content = (
            <div
              className={isActive ? "text-primary bg-primary/10 p-1 scale-110 flex shrink-0 transition-all" : "text-slate-500 group-hover:text-slate-200 flex shrink-0 transition-all"}
            >
              <item.icon 
                size={isCollapsed ? 20 : 18} 
                fill="currentColor"
                className={cn(
                  "transition-all",
                  !isActive && "opacity-40 group-hover:opacity-100"
                )}
              />
            </div>
          );

          const inner = (
            <>
              {Content}
              {!isCollapsed && (
                <span className={cn(
                  "text-sm font-medium tracking-wide truncate flex-1 uppercase",
                  isActive ? "text-primary" : "text-inherit"
                )}>
                  {item.label}
                </span>
              )}
            </>
          );

          const className = cn(
            "flex items-center gap-3 px-6 py-3 transition-all relative group",
            isActive
              ? "bg-[#3a3939] text-primary border-l-2 border-primary"
              : item.disabled ? "opacity-30 pointer-events-none" : "text-slate-500 hover:text-white hover:bg-[#1c1c1c]",
            isCollapsed && "justify-center px-0",
          );

          if (item.disabled) {
            return (
              <div 
                key={item.label}
                title={isCollapsed ? item.label : undefined}
                aria-disabled="true"
                className={className}
                tabIndex={-1}
              >
                {inner}
              </div>
            );
          }

          return (
            <Link 
              key={item.label}
              to={item.href} 
              title={isCollapsed ? item.label : undefined}
              className={className}
            >
              {inner}
            </Link>
          );
        })}
      </nav>

      {/* ── User Profile Footer ── */}
      <div className={cn("px-6 mt-auto shrink-0")}>
        <div className={cn("flex flex-col gap-1", isCollapsed && "items-center")}>
          <div
            onClick={() => navigate("/profile")}
            className="flex items-center gap-3 border-t border-white/5 pt-4 cursor-pointer hover:bg-white/5 -mx-2 px-2 py-1 rounded transition-colors"
          >
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
                  <div className="flex items-center gap-2 mt-1.5">
                    {(() => {
                      const tierConfig = (profile?.tier && TIER_CONFIG[profile?.tier as keyof typeof TIER_CONFIG]) || TIER_CONFIG.FREE;
                      return (
                        <span
                          className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm border",
                            tierConfig.className
                          )}
                        >
                          {tierConfig.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    signOut();
                  }}
                  className="p-2 text-red-400 hover:text-white hover:bg-red-500 bg-red-500/10 border border-red-500/20 rounded transition-all shrink-0 group/logout"
                  title="Sign Out"
                >
                  <LogOut size={14} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
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
          onClose={() => {
            setShowSettings(false);
            window.dispatchEvent(new CustomEvent("deckly:settings-closed"));
          }}
          branding={branding}
          onUpdate={(newBranding) => setBranding(newBranding)}
          userProfile={profile || undefined}
        />,
        document.body,
      )}
    </aside>
  );
}
