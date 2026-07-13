import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { TIER_CONFIG, type Tier } from "../../constants/tiers";

type UpgradeConfirmationDialogProps = {
  targetTier: Exclude<Tier, "FREE"> | null;
  billingCycle: "monthly" | "yearly";
  onClose: () => void;
  onConfirm: () => void;
};

export function UpgradeConfirmationDialog({
  targetTier,
  billingCycle,
  onClose,
  onConfirm,
}: UpgradeConfirmationDialogProps) {
  useEffect(() => {
    if (!targetTier) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [onClose, targetTier]);

  return (
    <AnimatePresence>
      {targetTier && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upgrade-notice-title"
            className="relative w-full max-w-lg overflow-hidden border border-border bg-surface-lowest shadow-[0_32px_120px_-24px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <h3 id="upgrade-notice-title" className="text-xl font-bold text-white">
                Upgrade to {TIER_CONFIG[targetTier].planLabel} now?
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close upgrade notice"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p className="text-sm leading-relaxed text-slate-200">
                Razorpay will calculate the prorated difference for this {billingCycle} plan and charge your saved subscription payment method.
              </p>
              <p className="border border-border bg-surface-low p-4 text-sm leading-relaxed text-muted-foreground">
                You will not be asked to re-enter card details because your existing Razorpay subscription has an authorised mandate. Your plan changes only after Razorpay confirms the charge.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border px-6 py-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground">
                Keep current plan
              </button>
              <button type="button" autoFocus onClick={onConfirm} className="inline-flex items-center justify-center gap-2 bg-deckly-primary px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground transition-all hover:brightness-110">
                Confirm & charge
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
