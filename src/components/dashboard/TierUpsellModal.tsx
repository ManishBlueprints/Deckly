import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Check, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";

interface TierUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

export function TierUpsellModal({
  isOpen,
  onClose,
  featureName = "Premium Features",
}: TierUpsellModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      // Prevent scrolling when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          key="tier-upsell-container"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tier-upsell-title"
            className="relative w-full max-w-lg bg-[#121212] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
          >
            {/* Top Decorative Banner */}
            <div className="h-32 bg-gradient-to-br from-deckly-primary/20 via-deckly-primary/5 to-transparent relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_50%,#00f2fe,transparent)] animate-pulse" />
              <div className="absolute top-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-deckly-primary/20 rounded-2xl flex items-center justify-center text-deckly-primary border border-deckly-primary/30">
                <Sparkles size={32} />
              </div>
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 pt-4 text-center">
              <h2
                id="tier-upsell-title"
                className="text-2xl font-bold text-white tracking-tight mb-3"
              >
                Upgrade to PRO
              </h2>
              <p className="text-slate-400 font-medium mb-8">
                {featureName} is available exclusively for our{" "}
                <span className="text-deckly-primary font-bold">PRO</span> and{" "}
                <span className="text-deckly-primary font-bold">PRO Plus</span>{" "}
                members.
              </p>

              <div className="space-y-4 mb-10 text-left bg-white/5 rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="w-5 h-5 bg-deckly-primary/20 rounded-full flex items-center justify-center text-deckly-primary text-[10px]">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-semibold">
                    Interactive Mode (Auto Convert Your Files to High Quality
                    Images)
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="w-5 h-5 bg-deckly-primary/20 rounded-full flex items-center justify-center text-deckly-primary text-[10px]">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-semibold">
                    PPTX, DOCX, and XLSX Support
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="w-5 h-5 bg-deckly-primary/20 rounded-full flex items-center justify-center text-deckly-primary text-[10px]">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-semibold">
                    90 Days Analytics & Viewer Insights
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="w-5 h-5 bg-deckly-primary/20 rounded-full flex items-center justify-center text-deckly-primary text-[10px]">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-semibold">5 Data Rooms</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  className="w-full bg-deckly-primary hover:bg-deckly-primary/90 text-white font-regular py-6 rounded-2xl text-lg group"
                  onClick={() => {
                    // Navigate to pricing or show payment modal
                    window.location.href = "/settings?tab=billing";
                  }}
                >
                  <span>Upgrade Now</span>
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <button
                  onClick={onClose}
                  className="py-3 text-slate-500 hover:text-slate-300 font-bold text-sm transition-colors uppercase tracking-widest"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
