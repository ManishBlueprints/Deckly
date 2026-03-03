import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Upload, Share2, BarChart3, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { useAuth } from "../../contexts/AuthContext";

const steps = [
  {
    icon: Upload,
    title: "Upload",
    description:
      "Drop a PDF pitch deck and we'll convert it into a shareable, trackable link.",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    icon: Share2,
    title: "Share",
    description:
      "Send your unique link to investors. They view it beautifully — no downloads.",
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    icon: BarChart3,
    title: "Track",
    description:
      "See who viewed, how long they spent, and which slides got the most attention.",
    color: "bg-violet-500/10 text-violet-600",
  },
];

export function EmptyStateOverlay() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  return (
    <div className="relative">
      {/* Greyed-out dashboard ghost behind */}
      <div
        className="absolute inset-0 blur-[4px] opacity-[0.15] pointer-events-none select-none"
        aria-hidden
      >
        <div className="space-y-12 pb-12">
          {/* Ghost top row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="bg-white/5 rounded-[32px] border border-white/10 h-64 shadow-2xl" />
            <div className="bg-white/5 rounded-[32px] border border-white/10 h-64 shadow-2xl" />
          </div>
          {/* Ghost analytics */}
          <div className="bg-white/5 rounded-[32px] border border-white/10 h-80 shadow-2xl" />
        </div>
      </div>

      {/* Overlay content */}
      <div className="relative z-10 flex items-center justify-center min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-xl mx-auto"
        >
          <div className="bg-[#09090b]/40 backdrop-blur-2xl rounded-[40px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-10 md:p-16 text-center space-y-10 relative overflow-hidden group glass-shiny">
            {/* Ambient Shine */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-deckly-primary/10 rounded-full blur-[80px] pointer-events-none" />

            {/* Welcome */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
                className="w-20 h-20 mx-auto rounded-[24px] bg-deckly-primary/10 border border-deckly-primary/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)]"
              >
                <Sparkles size={32} className="text-deckly-primary" />
              </motion.div>
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Hey {firstName} 👋
              </h2>
              <p className="text-sm md:text-base text-slate-400 max-w-sm mx-auto leading-relaxed font-medium">
                Your data room is ready. Upload your first deck and start
                tracking investor engagement in real time.
              </p>
            </div>

            {/* 3-Step Journey */}
            <div className="grid grid-cols-3 gap-4 md:gap-6">
              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex flex-col items-center gap-3 p-4 md:p-6 rounded-3xl bg-white/[0.03] border border-white/5 transition-all hover:bg-white/[0.05] hover:border-white/10"
                >
                  <div
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center bg-white/5 shadow-inner border border-white/5`}
                  >
                    <step.icon size={24} className="text-white opacity-80" />
                  </div>
                  <p className="text-xs md:text-sm font-bold text-white uppercase tracking-widest">
                    {step.title}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Connecting arrows (desktop only) */}
            <div className="hidden md:flex items-center justify-center gap-2 -mt-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">
                Step 1
              </span>
              <ArrowRight size={14} className="text-slate-700" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">
                Step 2
              </span>
              <ArrowRight size={14} className="text-slate-700" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">
                Step 3
              </span>
            </div>

            {/* CTA */}
            <Link to="/upload" className="hidden md:block w-full">
              <Button className="w-full h-16 rounded-[20px] bg-deckly-primary hover:bg-deckly-primary/90 text-slate-900 font-bold text-xs uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(34,197,94,0.3)] transition-all active:scale-95 group/btn border-none">
                <Upload
                  size={18}
                  className="mr-3 transition-transform group-hover/btn:-translate-y-1"
                />
                Upload Your First Deck
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
