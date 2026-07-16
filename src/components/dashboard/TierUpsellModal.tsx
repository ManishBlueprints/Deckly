import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, LockKeyhole, X } from "lucide-react";

interface TierUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

const SHARE_BENEFITS = [
  {
    title: "Share with control",
    detail: "Email capture, password protection, expiry, and download controls.",
  },
  {
    title: "See what moves people",
    detail: "30 days of link analytics, page engagement, and visitor signals.",
  },
  {
    title: "Make more room for momentum",
    detail: "25 documents, 500 MB storage, and 20 daily AI credits.",
  },
];

export function TierUpsellModal({
  isOpen,
  onClose,
  featureName = "Premium features",
}: TierUpsellModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" key="tier-upsell-container">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75"
          />

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tier-upsell-title"
            aria-describedby="tier-upsell-description"
            className="relative w-full max-w-[34rem] overflow-hidden border border-border bg-surface-lowest shadow-2xl"
          >
            <header className="relative isolate overflow-hidden border-b border-deckly-primary/25 bg-[#0a2117] px-5 py-5 sm:px-7">
              <div aria-hidden="true" className="absolute right-12 top-1/2 h-24 w-24 -translate-y-1/2 border border-deckly-primary/10" />
              <div aria-hidden="true" className="absolute right-20 top-1/2 h-14 w-14 -translate-y-1/2 border border-deckly-primary/20 bg-deckly-primary/[0.035]" />
              <div className="relative flex items-start justify-between gap-6">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center border border-deckly-primary/45 bg-deckly-primary/10 text-deckly-primary">
                    <span aria-hidden="true" className="absolute left-0 top-0 h-2 w-2 border-b border-r border-deckly-primary/70" />
                    <LockKeyhole size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-deckly-primary">Available on Share</p>
                    <p className="mt-1 text-xs text-slate-300">Professional sharing controls · starting at $9/month</p>
                  </div>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close upgrade dialog"
                  className="-mr-2 -mt-2 flex h-9 w-9 shrink-0 items-center justify-center text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deckly-primary"
                >
                  <X size={19} aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="px-5 py-6 sm:px-7 sm:py-7">
              <h2 id="tier-upsell-title" className="max-w-md text-balance text-2xl font-semibold tracking-tight text-white">
                Unlock {featureName}
              </h2>
              <p id="tier-upsell-description" className="mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
                Share gives you the confidence to send investor materials with more control and a clearer picture of engagement.
              </p>

              <dl className="mt-6 border-y border-border">
                {SHARE_BENEFITS.map((benefit) => (
                  <div key={benefit.title} className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 border-b border-border py-3.5 last:border-b-0">
                    <Check size={15} strokeWidth={2.5} className="mt-0.5 text-deckly-primary" aria-hidden="true" />
                    <div>
                      <dt className="text-sm font-semibold text-foreground">{benefit.title}</dt>
                      <dd className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{benefit.detail}</dd>
                    </div>
                  </div>
                ))}
              </dl>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/profile?section=tier";
                  }}
                  className="group inline-flex min-h-11 w-full items-center justify-center gap-2 bg-deckly-primary px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-deckly-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deckly-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-lowest sm:w-auto"
                >
                  View Share plan
                  <ArrowRight size={15} className="transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deckly-primary"
                >
                  Keep editing
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
