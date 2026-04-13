import {
  LayoutGrid,
  Folder,
  DoorOpen,
  Bookmark,
  Plus,
  Upload,
  User,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../utils/cn";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const navItems = [
  { icon: LayoutGrid, label: "Home", href: "/" },
  { icon: Folder, label: "Content", href: "/content" },
];

const rightNavItems = [
  { icon: DoorOpen, label: "Rooms", href: "/rooms" },
  { icon: Bookmark, label: "Saved", href: "/saved-decks" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (href: string) => {
    setIsOpen(false);
    navigate(href);
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <nav className="md:hidden fixed bottom-6 left-4 right-4 z-50 bg-[#09090b]/80 backdrop-blur-3xl border border-white/5 flex items-center justify-between px-2 py-2 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] safe-area-pb glass-shiny glass-emerald-border">
        {/* Left Items */}
        <div className="flex-1 flex items-center justify-around gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.label}
                to={item.href}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-1 px-1 rounded-2xl transition-all duration-300 flex-1 relative group min-w-0",
                  isActive ? "text-deckly-primary" : "text-slate-500",
                )}
              >
                <item.icon 
                  size={isActive ? 20 : 18} 
                  fill="currentColor"
                  className={cn("transition-all duration-300", !isActive && "opacity-30")}
                />
                <span className="text-[9px] font-bold uppercase tracking-widest truncate w-full px-1 text-center font-manrope">
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute inset-0 bg-deckly-primary/5 rounded-2xl -z-10"
                  />
                )}
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-dot"
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-deckly-primary rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Central Action Hub */}
        <div className="relative flex items-center justify-center px-2">
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                className="absolute bottom-full mb-6 flex flex-col items-center gap-3 w-48"
              >
                <button
                  onClick={() => handleAction("/rooms/new")}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[#09090b]/90 backdrop-blur-3xl border border-white/10 rounded-2xl text-white shadow-2xl group hover:border-deckly-primary/30 transition-all active:scale-95"
                >
                  <div className="w-8 h-8 rounded-lg bg-deckly-primary/10 flex items-center justify-center border border-deckly-primary/20 group-hover:bg-deckly-primary/20 transition-all text-deckly-primary">
                    <DoorOpen size={16} fill="currentColor" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-200 group-hover:text-white transition-colors">
                    New Room
                  </span>
                </button>

                <button
                  onClick={() => handleAction("/upload")}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[#09090b]/90 backdrop-blur-3xl border border-white/10 rounded-2xl text-white shadow-2xl group hover:border-deckly-primary/30 transition-all active:scale-95"
                >
                  <div className="w-8 h-8 rounded-lg bg-deckly-primary/10 flex items-center justify-center border border-deckly-primary/20 group-hover:bg-deckly-primary/20 transition-all text-deckly-primary">
                    <Upload size={16} fill="currentColor" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-200 group-hover:text-white transition-colors">
                    New Deck
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onClick={() => setIsOpen(!isOpen)}
            whileTap={{ scale: 0.9 }}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl relative z-50",
              isOpen
                ? "bg-slate-900 border border-white/10 text-white rotate-45"
                : "bg-deckly-primary text-slate-950 shadow-[0_4px_20px_rgba(34,197,94,0.4)]",
            )}
          >
            <Plus size={24} strokeWidth={3} />
          </motion.button>
        </div>

        {/* Right Items */}
        <div className="flex-1 flex items-center justify-around gap-1">
          {rightNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.label}
                to={item.href}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-1 px-1 rounded-2xl transition-all duration-300 flex-1 relative group min-w-0",
                  isActive ? "text-deckly-primary" : "text-slate-500",
                )}
              >
                <item.icon 
                  size={isActive ? 20 : 18} 
                  fill="currentColor"
                  className={cn("transition-all duration-300", !isActive && "opacity-30")}
                />
                <span className="text-[9px] font-bold uppercase tracking-widest truncate w-full px-1 text-center font-manrope">
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-active"
                    className="absolute inset-0 bg-deckly-primary/5 rounded-2xl -z-10"
                  />
                )}
                {isActive && (
                  <motion.div
                    layoutId="bottom-nav-dot"
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-deckly-primary rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
