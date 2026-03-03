import {
  LayoutDashboard,
  FileText,
  Monitor,
  BarChart3,
  Bookmark,
  MessageCircle,
  LogOut,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../../utils/cn";
import penguinMascot from "../../assets/penguine.png";
import { useAuth } from "../../contexts/AuthContext";
import { useState } from "react";
import { createPortal } from "react-dom";
import { MascotSettingsModal } from "../dashboard/MascotSettingsModal";
import { Settings } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: FileText, label: "Content", href: "/content" },
  { icon: Monitor, label: "Rooms", href: "/rooms" },
  { icon: Bookmark, label: "Saved Decks", href: "/saved-decks" },
  { icon: BarChart3, label: "Analytics", href: "/analytics", disabled: true },
  { icon: MessageCircle, label: "Requests", href: "/requests", disabled: true },
];

export function Sidebar() {
  const location = useLocation();
  const { profile, signOut, session, branding, setBranding } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <aside className="w-72 bg-[#09090b]/50 backdrop-blur-3xl flex flex-col h-screen border-r border-white/5 shrink-0 relative z-20 glass-shiny">
      {/* Brand/Mascot */}
      <div className="p-8">
        <div
          onClick={() => setShowSettings(true)}
          className="relative w-full aspect-square bg-white/[0.02] rounded-[32px] border border-white/5 overflow-hidden mb-10 group cursor-pointer shadow-2xl transition-all hover:border-deckly-primary/30"
        >
          <img
            src={branding?.logo_url || penguinMascot}
            alt="Deckly Mascot"
            className="w-full h-full object-contain p-6 transition-all group-hover:scale-110 group-hover:opacity-40"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
            <div className="bg-deckly-primary p-3 rounded-2xl shadow-[0_0_20px_rgba(34,197,94,0.4)] translate-y-4 group-hover:translate-y-0 transition-all duration-300">
              <Settings size={20} className="text-slate-950" />
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const content = (
              <>
                <item.icon
                  size={20}
                  className={cn(
                    "transition-all duration-300",
                    isActive
                      ? "text-deckly-primary scale-110"
                      : "text-slate-500 " +
                          (!item.disabled ? "group-hover:text-white" : ""),
                  )}
                />
                <span
                  className={cn(
                    "flex-1 font-semibold tracking-tight transition-colors",
                    isActive
                      ? "text-white"
                      : "text-slate-400 group-hover:text-slate-200",
                  )}
                >
                  {item.label}
                </span>
                {item.disabled && (
                  <span className="text-[8px] font-bold bg-white/5 text-slate-600 border border-white/5 px-2 py-0.5 rounded-md uppercase tracking-widest">
                    SOON
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute left-0 w-1 h-6 bg-deckly-primary rounded-r-full shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                  />
                )}
              </>
            );

            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-4 px-6 py-3.5 rounded-2xl text-sm font-medium opacity-30 grayscale cursor-not-allowed",
                    "text-slate-500",
                  )}
                >
                  {content}
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                to={item.href}
                className={cn(
                  "flex items-center gap-4 px-6 py-3.5 rounded-2xl transition-all duration-300 group text-sm relative",
                  isActive
                    ? "bg-white/5 text-white shadow-xl border border-white/5"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent",
                )}
              >
                {content}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User / Bottom */}
      <div className="mt-auto p-6 border-t border-white/5">
        <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/5 mb-2 hover:bg-white/5 transition-colors group relative overflow-hidden">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-white/10 overflow-hidden shrink-0 shadow-lg">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold text-lg">
                {profile?.full_name?.charAt(0) || "U"}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white truncate tracking-tight">
                {profile?.full_name || "User Name"}
              </p>
              {(() => {
                const t = profile?.tier || "FREE";
                return (
                  <span
                    className={cn(
                      "text-[8px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-md shrink-0 leading-none border shadow-sm",
                      t === "PRO_PLUS"
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        : t === "PRO"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-white/5 text-slate-500 border-white/5",
                    )}
                  >
                    {t === "PRO_PLUS" ? "P+" : t}
                  </span>
                );
              })()}
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold truncate mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
              {session?.user?.email?.split("@")[0] || "Founder"}
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="p-2 text-slate-600 hover:text-red-400 transition-all active:scale-95 group/logout"
            title="Sign Out"
          >
            <LogOut
              size={18}
              className="group-hover/logout:translate-x-0.5 transition-transform"
            />
          </button>
        </div>
      </div>

      {/* Render modal at document root to escape sidebar stacking context */}
      {createPortal(
        <MascotSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          branding={branding}
          onUpdate={(newBranding) => setBranding(newBranding)}
        />,
        document.body,
      )}
    </aside>
  );
}
