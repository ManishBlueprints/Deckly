import {
  LayoutDashboard,
  FileText,
  Monitor,
  BarChart3,
  Bookmark,
  MessageCircle,
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
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: FileText, label: "Content", href: "/content" },
  { icon: Monitor, label: "Rooms", href: "/rooms" },
  { icon: Bookmark, label: "Saved Decks", href: "/saved-decks" },
  { icon: BarChart3, label: "Analytics", href: "/analytics", disabled: true },
  { icon: MessageCircle, label: "Requests", href: "/requests", disabled: true },
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
  const { profile, signOut, session, branding, setBranding } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed);

  function toggleCollapsed() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem("sidebar-collapsed", String(next));
    } catch {}
  }

  return (
    <aside
      style={{ width: isCollapsed ? 72 : 288 }}
      className="bg-[#09090b]/60 backdrop-blur-3xl flex flex-col h-screen border-r border-white/10 shrink-0 relative z-20"
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-deckly-primary/10 rounded-full blur-[100px]" />
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapsed}
        className="absolute top-[72px] -right-3 z-30 w-6 h-6 rounded-full bg-[#1a1a1c] border border-white/10 shadow-xl flex items-center justify-center text-slate-400 hover:text-white hover:border-white/20 transition-colors"
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

      {/* ── Brand Header ── */}
      <div
        className={cn("pt-6 pb-4 relative z-10", isCollapsed ? "px-3" : "px-4")}
      >
        <div
          className={cn(
            "flex items-center gap-3",
            isCollapsed && "justify-center",
          )}
        >
          {/* Logo icon */}
          <div
            onClick={() => setShowSettings(true)}
            className="w-9 h-9 rounded-[10px] bg-white/[0.04] border border-white/10 overflow-hidden shrink-0 flex items-center justify-center shadow-lg relative group cursor-pointer hover:border-white/20 transition-colors"
          >
            <img
              src={branding?.logo_url || penguinMascot}
              alt="Logo"
              className="w-full h-full object-contain p-1 transition-all duration-300 group-hover:opacity-20 group-hover:scale-110"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Settings size={13} className="text-white" />
            </div>
          </div>

          {/* Workspace name */}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white tracking-tight truncate leading-none">
                {branding?.room_name || "My Workspace"}
              </p>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">
                Workspace
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/5 mx-4 mb-3 relative z-10" />

      {/* ── Nav ── */}
      <nav
        className={cn(
          "flex-1 space-y-1 overflow-y-auto scrollbar-none relative z-10",
          isCollapsed ? "px-2" : "px-3",
        )}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.href;

          const iconEl = (
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                isActive
                  ? "bg-deckly-primary text-slate-950 shadow-[0_0_14px_rgba(34,197,94,0.35)]"
                  : "bg-white/[0.03] text-slate-500 group-hover:bg-white/[0.07] group-hover:text-slate-200",
              )}
            >
              <item.icon size={17} />
            </div>
          );

          if (item.disabled) {
            return (
              <div
                key={item.label}
                title={item.label}
                className={cn(
                  "flex items-center gap-3 px-2 py-2 rounded-2xl opacity-35 grayscale cursor-not-allowed",
                  isCollapsed && "justify-center",
                )}
              >
                {iconEl}
                {!isCollapsed && (
                  <>
                    <span className="text-[13px] font-semibold text-slate-400 flex-1">
                      {item.label}
                    </span>
                    <span className="text-[7px] font-black bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                      SOON
                    </span>
                  </>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              to={item.href}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded-2xl transition-colors group",
                isActive
                  ? "bg-white/[0.06] border border-white/5"
                  : "hover:bg-white/[0.04] border border-transparent hover:border-white/5",
                isCollapsed && "justify-center",
              )}
            >
              {iconEl}
              {!isCollapsed && (
                <>
                  <span
                    className={cn(
                      "text-[13px] font-semibold tracking-tight flex-1 truncate",
                      isActive
                        ? "text-white"
                        : "text-slate-400 group-hover:text-slate-200",
                    )}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-deckly-primary shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User Profile ── */}
      <div
        className={cn(
          "mt-auto border-t border-white/5 p-3 relative z-10",
          isCollapsed ? "px-2" : "px-3",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3 p-2.5 rounded-[20px] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 group cursor-pointer transition-colors",
            isCollapsed && "justify-center",
          )}
        >
          {/* Avatar */}
          <div className="w-9 h-9 rounded-[12px] bg-slate-800 border border-white/10 overflow-hidden shrink-0 relative">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-black text-xs">
                {profile?.full_name?.charAt(0) || "U"}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-deckly-primary border-2 border-[#09090b] shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          </div>

          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-white truncate tracking-tight">
                    {profile?.full_name?.split(" ")[0] || "Founder"}
                  </p>
                  {(() => {
                    const t = profile?.tier || "FREE";
                    if (t === "FREE") return null;
                    return (
                      <span
                        className={cn(
                          "text-[7px] font-black px-1.5 py-0.5 rounded-md leading-none border uppercase tracking-wider shrink-0",
                          t === "PRO_PLUS"
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            : "bg-amber-400/10 text-amber-500 border-amber-400/20",
                        )}
                      >
                        {t === "PRO_PLUS" ? "P+" : "PRO"}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-[9px] text-slate-500 font-bold truncate uppercase tracking-widest mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  {session?.user?.email?.split("@")[0] || "account"}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  signOut();
                }}
                className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors active:scale-90 shrink-0"
                title="Sign Out"
              >
                <LogOut size={15} />
              </button>
            </>
          )}
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
