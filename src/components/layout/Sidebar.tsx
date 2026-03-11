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
  {
    icon: BarChart3,
    label: "Full Analytics",
    href: "/analytics",
    disabled: true,
  },
  { icon: MessageCircle, label: "Messages", href: "/requests", disabled: true },
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
    } catch {
      // Ignore localStorage errors (e.g. incognito mode)
    }
  }

  return (
    <aside
      style={{ width: isCollapsed ? 64 : 240 }}
      className="bg-[#10120f] flex flex-col h-screen border-r border-[#222] shrink-0 relative z-20 transition-all duration-300"
    >
      {/* Collapse toggle */}
      <button
        onClick={toggleCollapsed}
        className="absolute top-5 -right-3.5 z-30 w-7 h-7 rounded-full bg-[#10120f] border border-[#333] flex items-center justify-center text-slate-400 hover:text-slate-200 shadow-xl transition-all active:scale-90"
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
      <div className={cn("p-4 shrink-0 mt-2")}>
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
            className="w-8 h-8 rounded-md bg-[#1a1a1a] border border-[#333] flex items-center justify-center shrink-0 hover:border-deckly-primary transition-colors overflow-hidden relative group"
          >
            <img
              src={branding?.logo_url || penguinMascot}
              alt="Logo"
              className="w-full h-full object-contain p-1"
            />
            {/* Minimal settings icon overlay */}
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Settings size={14} className="text-white" />
            </div>
          </button>

          {/* Workspace name */}
          {!isCollapsed && (
            <div className="flex-1 min-w-0 flex items-center justify-between group">
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => setShowSettings(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setShowSettings(true);
                  }
                }}
              >
                <p className="text-[13px] font-semibold text-slate-200 truncate leading-tight">
                  {branding?.room_name || "Workspace"}
                </p>
              </div>{" "}
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

          if (item.disabled) {
            return (
              <div
                key={item.label}
                title={item.label}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md opacity-40 cursor-not-allowed",
                  isCollapsed && "justify-center px-0",
                )}
              >
                <div className="text-slate-500 flex shrink-0">
                  <item.icon size={16} strokeWidth={1.5} />
                </div>
                {!isCollapsed && (
                  <>
                    <span className="text-[13px] font-medium text-slate-400 flex-1 truncate">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      Soon
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
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                isActive
                  ? "bg-[#1a1a1a] text-deckly-primary"
                  : "text-slate-400 hover:bg-[#1a1a1a] hover:text-slate-200",
                isCollapsed && "justify-center px-0",
              )}
            >
              <div
                className={cn(
                  "flex shrink-0",
                  isActive ? "text-deckly-primary" : "text-slate-400",
                )}
              >
                <item.icon size={16} strokeWidth={1.5} />
              </div>
              {!isCollapsed && (
                <span className={cn("text-[13px] font-medium truncate flex-1")}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User Profile Footer ── */}
      <div className={cn("p-3 shrink-0 border-t border-[#222] bg-[#10120f]")}>
        <div
          className={cn(
            "flex items-center gap-3 p-2 rounded-md transition-colors group",
            isCollapsed && "justify-center",
          )}
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-[#333] overflow-hidden shrink-0 flex items-center justify-center">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-slate-400 font-medium text-xs">
                {profile?.full_name?.charAt(0) ||
                  session?.user?.email?.charAt(0) ||
                  "U"}
              </span>
            )}
          </div>

          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-slate-200 truncate">
                    {profile?.full_name?.split(" ")[0] || "User"}
                  </p>
                  {(() => {
                    const t = profile?.tier || "FREE";
                    let badgeStyles =
                      "border-[#333] text-slate-400 bg-slate-800/50";
                    let badgeLabel = "FREE";

                    if (t === "PRO") {
                      badgeStyles =
                        "border-sky-500/30 text-sky-400 bg-sky-500/10";
                      badgeLabel = "PRO";
                    } else if (t === "PRO_PLUS") {
                      badgeStyles =
                        "border-fuchsia-500/30 text-fuchsia-400 bg-fuchsia-500/10";
                      badgeLabel = "PRO+";
                    }

                    return (
                      <span
                        className={cn(
                          "text-[9px] font-mono px-1 border rounded shrink-0 leading-relaxed uppercase",
                          badgeStyles,
                        )}
                      >
                        {badgeLabel}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5 pr-2">
                  {session?.user?.email}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  signOut();
                }}
                className="p-1.5 text-slate-500 hover:text-slate-200 rounded-md hover:bg-[#222] transition-colors shrink-0"
                title="Sign Out"
              >
                <LogOut size={16} strokeWidth={1.5} />
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
