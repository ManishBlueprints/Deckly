import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

interface DataRoomModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
}

export function DataRoomModalShell({
  isOpen,
  onClose,
  children,
  panelClassName,
}: DataRoomModalShellProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className={panelClassName ?? "pointer-events-auto w-full max-w-2xl rounded-xl border border-border bg-surface-card shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden"}
            >
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
