import { useEffect, useRef } from "react";
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
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    const getFocusableElements = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey && activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const focusFrame = requestAnimationFrame(() => {
      const [firstFocusableElement] = getFocusableElements();
      if (firstFocusableElement) {
        firstFocusableElement.focus();
      } else {
        dialogRef.current?.focus();
      }
    });
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocusedElement?.isConnected) previouslyFocusedElement.focus();
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
            ref={dialogRef}
            tabIndex={-1}
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
                Upgrade your plan
              </h2>
              <p className="text-slate-400 font-medium mb-8">
                {featureName} is available exclusively for our{" "}
                <span className="text-deckly-primary font-bold">Share</span>,{" "}
                <span className="text-deckly-primary font-bold">Founder</span>, or{" "}
                <span className="text-deckly-primary font-bold">Raise</span>{" "}
                members.
              </p>

              <div className="space-y-4 mb-10 text-left bg-white/5 rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="w-5 h-5 bg-deckly-primary/20 rounded-full flex items-center justify-center text-deckly-primary text-[10px]">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-semibold">
                    Professional document sharing and presentation controls
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="w-5 h-5 bg-deckly-primary/20 rounded-full flex items-center justify-center text-deckly-primary text-[10px]">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-semibold">
                    Richer viewer, link, and engagement insight
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="w-5 h-5 bg-deckly-primary/20 rounded-full flex items-center justify-center text-deckly-primary text-[10px]">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-semibold">
                    Flexible access settings and download controls
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="w-5 h-5 bg-deckly-primary/20 rounded-full flex items-center justify-center text-deckly-primary text-[10px]">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-semibold">More room, document, storage, and AI capacity</span>
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
