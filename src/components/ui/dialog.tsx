import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { usePortalHost } from "./portal-host";

export type OverlayPresentation = "dialog" | "sheet-right" | "sheet-bottom" | "fullscreen";

export interface OverlayContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  presentation?: OverlayPresentation;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnOutsideClick?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  hideClose?: boolean;
}

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const sizeClass = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
};

const presentationClass: Record<OverlayPresentation, string> = {
  dialog: "left-1/2 top-1/2 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[24px] max-h-[calc(100dvh-2rem)]",
  "sheet-right": "inset-y-0 right-0 h-dvh w-full max-w-xl rounded-l-[24px]",
  "sheet-bottom": "inset-x-0 bottom-0 max-h-[90dvh] w-full rounded-t-[24px]",
  fullscreen: "inset-0 h-dvh w-screen rounded-none",
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  OverlayContentProps
>(
  (
    {
      className,
      children,
      presentation = "dialog",
      size = "md",
      closeOnOutsideClick = true,
      initialFocusRef,
      hideClose = false,
      onPointerDownOutside,
      onOpenAutoFocus,
      ...props
    },
    ref,
  ) => {
    const portalHost = usePortalHost();
    return (
      <DialogPrimitive.Portal container={portalHost ?? undefined}>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--ui-layer-scrim)] bg-ui-scrim/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "fixed z-[var(--ui-layer-dialog)] flex flex-col overflow-hidden border border-ui-border bg-ui-elevated text-ui-text shadow-[var(--ui-shadow-overlay)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            presentationClass[presentation],
            presentation === "dialog" && sizeClass[size],
            presentation === "sheet-right" && "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            presentation === "sheet-bottom" && "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            className,
          )}
          onPointerDownOutside={(event) => {
            if (!closeOnOutsideClick) event.preventDefault();
            onPointerDownOutside?.(event);
          }}
          onOpenAutoFocus={(event) => {
            if (initialFocusRef?.current) {
              event.preventDefault();
              initialFocusRef.current.focus();
            }
            onOpenAutoFocus?.(event);
          }}
          {...props}
        >
          {children}
          {!hideClose && (
            <DialogPrimitive.Close className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-ui-muted transition-colors hover:bg-ui-subtle hover:text-ui-text" aria-label="Close dialog">
              <X size={18} />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("border-b border-ui-border px-6 py-5 pr-16", className)} {...props} />
);
const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", className)} {...props} />
);
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-3 border-t border-ui-border px-6 py-4 sm:flex-row sm:justify-end", className)} {...props} />
);
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold tracking-[-0.02em]", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("mt-1 text-sm text-ui-muted", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription };
