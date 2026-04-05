import React from "react";
import { RotateCcw } from "lucide-react";
import { useTourState } from "../../contexts/TourContext";
import { motion } from "framer-motion";

export const RestartTourButton: React.FC = () => {
  const { resetTours } = useTourState();

  const handleRestart = async () => {
    if (window.confirm("Restart the onboarding tutorial?")) {
      await resetTours();
      window.location.reload();
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleRestart}
      className="fixed bottom-8 right-24 z-[95] flex items-center gap-2 px-4 py-2.5 bg-surface-card border border-white/5 text-slate-400 hover:text-white transition-all shadow-2xl rounded-none group overflow-hidden"
      title="Restart Tutorial"
    >
      <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
      <RotateCcw size={14} className="relative z-10 group-hover:rotate-[-45deg] transition-transform duration-300" />
      <span className="relative z-10 text-[9px] font-black uppercase tracking-[0.2em]">
        Restart Tutorial
      </span>
    </motion.button>
  );
};
