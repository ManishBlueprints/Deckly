import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function WelcomeBanner() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "Founder";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#09090b]/40 backdrop-blur-2xl p-8 md:p-12 mb-12 glass-shiny group"
    >
      {/* Decorative Emerald Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-deckly-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-deckly-primary/20 transition-all duration-700" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-deckly-primary/10 border border-deckly-primary/20">
            <Sparkles size={14} className="text-deckly-primary animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-deckly-primary">
              v2.0 Dashboard
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight">
            {getGreeting()},{" "}
            <span className="text-deckly-primary">{firstName}</span>.
          </h1>

          <p className="text-slate-400 text-sm md:text-base font-medium max-w-xl">
            Welcome back to your command center. Your pitch decks are performing
            <span className="text-white font-bold ml-1">12% better</span> this
            week.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Link to="/upload" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto px-8 py-4 bg-deckly-primary text-slate-950 font-bold text-xs uppercase tracking-[0.2em] rounded-2xl shadow-[0_10px_30px_rgba(34,197,94,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3">
              <Upload size={18} />
              New Deck
            </button>
          </Link>
          <Link to="/rooms" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-2 group/btn">
              View Rooms
              <ArrowRight
                size={16}
                className="group-hover/btn:translate-x-1 transition-transform"
              />
            </button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
