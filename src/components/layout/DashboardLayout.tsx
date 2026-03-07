import React from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Plus, Upload, Home as RoomIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import penguinMascot from "../../assets/penguine.png";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="flex h-screen bg-[#09090b] overflow-hidden font-outfit selection:bg-deckly-primary/30">
      {/* Premium Background Mesh */}
      <div className="fixed inset-0 pointer-events-none opacity-40 z-0 bg-[radial-gradient(at_0%_0%,rgba(34,197,94,0.15)_0px,transparent_50%),radial-gradient(at_100%_0%,rgba(139,92,246,0.15)_0px,transparent_50%)]" />

      {/* Sidebar - desktop only */}
      <div className="hidden md:block relative z-10">
        <Sidebar />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Top Header */}
        <header className="h-14 md:h-20 flex items-center justify-between px-4 md:px-8 mx-4 md:mx-10 mt-4 md:mt-6 glass-shiny bg-[#09090b]/40 backdrop-blur-2xl border border-white/5 rounded-2xl md:rounded-[2rem] shadow-2xl shrink-0 z-20 overflow-hidden relative group">
          {/* Subtle Green Glow */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-48 h-48 bg-deckly-primary/10 rounded-full blur-[60px] pointer-events-none group-hover:bg-deckly-primary/20 transition-all duration-700" />

          <div className="flex items-center gap-4 flex-1 relative z-10">
            <div className="flex items-center gap-4">
              <h1 className="text-lg md:text-3xl font-extrabold text-white flex items-center gap-2 md:gap-3 tracking-tight">
                <img
                  src={branding?.logo_url || penguinMascot}
                  alt="Logo"
                  className="w-8 h-8 object-contain md:hidden rounded-xl bg-white/[0.05] p-1 border border-white/10"
                />
                <span className="truncate flex items-center gap-2">
                  {initialTitle}
                  {isRefreshing && !loading && (
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-deckly-primary rounded-full animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.5)] shrink-0" />
                  )}
                </span>
              </h1>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {/* Founder Mode Toggle Mockup */}
            <div className="flex items-center gap-3 relative z-10">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                Founder Mode
              </span>
              <div className="w-10 h-5 bg-deckly-primary rounded-full relative shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm"></div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-12 md:pt-6 relative">
          <div className="max-w-7xl mx-auto pb-24 md:pb-0">{children}</div>
        </div>

        {/* Floating Action Button */}
        {showFab && (
          <div className="hidden md:block fixed bottom-10 right-10 z-[100]">
            {/* Backdrop */}
            <AnimatePresence>
              {fabOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setFabOpen(false)}
                  className="fixed inset-0 z-[-1]"
                />
              )}
            </AnimatePresence>

            {/* Popout Options */}
            <AnimatePresence>
              {fabOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="absolute bottom-full right-0 mb-4 flex flex-col gap-3 w-52"
                >
                  <button
                    onClick={() => handleFabAction("/rooms/new")}
                    className="w-full flex items-center gap-3 px-5 py-3.5 bg-[#09090b]/95 backdrop-blur-3xl border border-white/10 rounded-2xl text-white shadow-2xl group hover:border-deckly-primary/30 transition-all active:scale-95"
                  >
                    <div className="w-9 h-9 rounded-xl bg-deckly-primary/10 flex items-center justify-center border border-deckly-primary/20 group-hover:bg-deckly-primary/20 transition-all text-deckly-primary shrink-0">
                      <RoomIcon size={16} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-200 group-hover:text-white transition-colors">
                      New Room
                    </span>
                  </button>

                  <button
                    onClick={() => handleFabAction("/upload")}
                    className="w-full flex items-center gap-3 px-5 py-3.5 bg-[#09090b]/95 backdrop-blur-3xl border border-white/10 rounded-2xl text-white shadow-2xl group hover:border-deckly-primary/30 transition-all active:scale-95"
                  >
                    <div className="w-9 h-9 rounded-xl bg-deckly-primary/10 flex items-center justify-center border border-deckly-primary/20 group-hover:bg-deckly-primary/20 transition-all text-deckly-primary shrink-0">
                      <Upload size={16} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-200 group-hover:text-white transition-colors">
                      New Deck
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* FAB Button */}
            <motion.button
              onClick={() => setFabOpen(!fabOpen)}
              whileTap={{ scale: 0.92 }}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${
                fabOpen
                  ? "bg-slate-900 border border-white/10 text-white"
                  : "bg-deckly-primary text-slate-950 shadow-deckly-primary/40 hover:scale-110"
              }`}
            >
              <motion.div
                animate={{ rotate: fabOpen ? 45 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <Plus size={36} strokeWidth={3} />
              </motion.div>
            </motion.button>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
