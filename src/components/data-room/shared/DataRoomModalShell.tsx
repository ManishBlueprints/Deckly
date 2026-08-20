import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "../../ui/dialog";
import { cn } from "../../../lib/utils";

interface DataRoomModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  ariaLabel: string;
}

/** Compatibility interface backed by the canonical overlay module. */
export function DataRoomModalShell({
  isOpen,
  onClose,
  children,
  panelClassName,
  ariaLabel,
}: DataRoomModalShellProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="lg"
        className={cn("p-0", panelClassName)}
        closeOnOutsideClick
        hideClose
      >
        <DialogTitle className="sr-only">{ariaLabel}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
