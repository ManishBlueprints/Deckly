import {
  LayoutDashboard,
  FileText,
  Monitor,
  BarChart3,
  Bookmark,
  MessageCircle,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../../utils/cn";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { icon: LayoutDashboard, label: "Home", href: "/" },
  { icon: FileText, label: "Content", href: "/content" },
  { icon: Monitor, label: "Rooms", href: "/rooms" },
  { icon: Bookmark, label: "Saved", href: "/saved-decks" },
  { icon: BarChart3, label: "Stats", href: "/analytics", disabled: true },
  { icon: MessageCircle, label: "Inbox", href: "/requests", disabled: true },
];

export function BottomNav() {
  const location = useLocation();
  const { profile } = useAuth();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const handleDisabledClick = (label: string) => {
    setActiveTooltip(label);
    setTimeout(() => setActiveTooltip(null), 2000);
  };

  return (
    <nav className="md:hidden fixed bottom-6 left-3 right-3 z-50 bg-[#09090b]/60 backdrop-blur-3xl border border-white/5 flex items-center justify-between px-1 py-2.5 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] safe-area-pb glass-shiny glass-emerald-border">
      {navItems.map((item) => {
        const isActive = location.pathname === item.href;

        if (item.disabled) {
          return (
            <div
              key={item.label}
              className="flex flex-col items-center justify-center py-1 flex-1 relative min-w-0"
            >
              <button
                onClick={() => handleDisabledClick(item.label)}
                className="flex flex-col items-center gap-1 opacity-20 grayscale cursor-default w-full"
              >
                <item.icon size={18} className="text-white" />
                <span className="text-[9px] font-bold uppercase tracking-tight truncate w-full px-1 text-white">
                  {item.label}
                </span>
              </button>

              <AnimatePresence>
                {activeTooltip === item.label && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="absolute bottom-full mb-4 px-3 py-1.5 bg-deckly-primary text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-lg shadow-xl pointer-events-none whitespace-nowrap z-50"
                  >
                    Coming Soon
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-deckly-primary" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        }

        return (
          <Link
            key={item.label}
            to={item.href}
            aria-label={item.label}
            className={cn(
              "flex flex-col items-center gap-1 py-1 px-1 rounded-xl transition-all duration-300 flex-1 relative group min-w-0",
              isActive
                ? "text-deckly-primary"
                : "text-slate-400 hover:text-slate-600",
            )}
          >
            <item.icon
              size={isActive ? 20 : 18}
              className={cn(
                "transition-all duration-300 relative z-10",
                isActive && "drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]",
              )}
            />
            <span
              className={cn(
                "text-[9px] font-bold uppercase tracking-tight relative z-10 truncate w-full px-1 text-center transition-all duration-300",
                isActive ? "opacity-100" : "opacity-70",
              )}
            >
              {item.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="bottom-nav-active"
                className="absolute inset-x-1 inset-y-0 bg-white/[0.05] rounded-xl border border-white/5"
              />
            )}
            {isActive && (
              <motion.div
                layoutId="bottom-nav-dot"
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-deckly-primary rounded-full shadow-[0_0_10px_rgba(34,197,94,0.6)]"
              />
            )}
          </Link>
        );
      })}

      {/* User Profile */}
      <div className="flex flex-col items-center justify-center py-1 px-1 flex-1 relative min-w-0">
        <div
          className={cn(
            "w-7 h-7 rounded-full bg-slate-800 border overflow-hidden shrink-0 shadow-lg transition-all duration-300",
            "border-white/10 group-hover:border-deckly-primary/30",
          )}
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name || "User"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold text-[10px]">
              {profile?.full_name?.charAt(0) || "U"}
            </div>
          )}
        </div>
        <span className="text-[9px] font-bold uppercase tracking-tight text-slate-500 mt-1 truncate w-full px-1 text-center">
          Me
        </span>
      </div>
    </nav>
  );
}
