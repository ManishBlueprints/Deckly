import { useEffect, useRef } from "react";
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!targetTier) return;
    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.getAttribute("aria-hidden") !== "true" && element.tabIndex >= 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus({ preventScroll: true });
      }
      previouslyFocusedElementRef.current = null;
    };
  }, [targetTier]);

  const billingLabel = billingCycle === "yearly" ? "annual" : "monthly";

  return (
    <AnimatePresence>
      {targetTier && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            ref={dialogRef}
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
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby="upgrade-notice-title"
            className="relative w-full max-w-lg overflow-hidden border border-border bg-surface-lowest shadow-[0_32px_120px_-24px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <h3 id="upgrade-notice-title" className="text-xl font-bold text-white">
                Upgrade to {TIER_CONFIG[targetTier].planLabel} on {billingLabel} billing now?
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
                Razorpay will calculate the prorated difference for this {billingLabel} plan and charge your saved subscription payment method.
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
