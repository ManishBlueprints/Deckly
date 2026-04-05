import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isLoading ? undefined : onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-sm bg-surface-card border border-white/10 rounded-none overflow-hidden shadow-2xl"
        >
          <div className="p-8 text-center">
            {/* Icon */}
            <div
              className={cn(
                "w-16 h-16 rounded-none flex items-center justify-center mx-auto mb-6 border",
                variant === "danger"
                  ? "bg-red-500/10 text-red-500 border-red-500/10"
                  : "bg-deckly-primary/10 text-deckly-primary border-deckly-primary/10",
              )}
            >
              <AlertTriangle size={32} />
            </div>

            <h3 className="text-xl font-headline font-bold uppercase tracking-tight text-white mb-2">
              {title}
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed active:select-none mb-8 px-4 font-medium">
              {message}
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={cn(
                  "w-full h-14 rounded-none text-xs font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 active:scale-[0.98] border-none shadow-none",
                  variant === "danger"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-deckly-primary text-slate-950 hover:bg-deckly-primary/90",
                )}
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  confirmText
                )}
              </button>

              <button
                onClick={onClose}
                disabled={isLoading}
                className="w-full py-4 text-slate-500 hover:text-white text-[10px] font-bold uppercase tracking-[0.3em] transition-colors disabled:opacity-30"
              >
                {cancelText}
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-none transition-all disabled:opacity-0"
          >
            <X size={20} />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
