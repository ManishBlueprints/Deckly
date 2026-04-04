import { useState, useRef, useEffect } from "react";
import { Send, User, AlertTriangle } from "lucide-react";
import { useSendAdminMessage, useSendBroadcastAll } from "../../hooks/useAdminNotifications";
import Button from "../common/Button";
import Input from "../common/Input";
import Textarea from "../common/Textarea";
import { toast } from "sonner";

type SendMode = "single" | "broadcast";

export function AdminNotificationComposer() {
  const [mode, setMode] = useState<SendMode>("single");
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const sendMessage = useSendAdminMessage();
  const sendBroadcastAll = useSendBroadcastAll();
  const modalRef = useRef<HTMLDivElement>(null);

  // Accessibility: Focus management and Escape key handling
  useEffect(() => {
    if (!showConfirm) return;

    const previousFocus = document.activeElement as HTMLElement;
    modalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === "Escape") {
        setShowConfirm(false);
        return;
      }

      // Focus trap
      if (e.key === "Tab") {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [showConfirm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }

    if (mode === "broadcast") {
      setShowConfirm(true);
      return;
    }

    await doSendSingle();
  };

  const doSendSingle = async () => {
    if (!userId.trim()) {
      toast.error("User ID is required");
      return;
    }
    try {
      await sendMessage.mutateAsync({
        userId: userId.trim(),
        title: title.trim(),
        message: message.trim(),
      });
      toast.success("Notification sent");
      resetForm();
    } catch {
      toast.error("Failed to send notification");
    }
  };

  const doSendBroadcast = async () => {
    try {
      const result = await sendBroadcastAll.mutateAsync({
        title: title.trim(),
        message: message.trim(),
      });

      // Normalize response shape (handle number or { count: number })
      const count = typeof result === "number" 
        ? result 
        : (result as Record<string, unknown>)?.count ?? 0;

      toast.success(`Broadcast sent to ${count} users`);
      resetForm();
    } catch {
      toast.error("Failed to send broadcast");
    } finally {
      setShowConfirm(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setUserId("");
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mode Toggle */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`flex items-center gap-2 px-6 py-3 rounded-none text-xs uppercase tracking-widest font-bold transition-all ${
              mode === "single"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-surface-container text-muted-foreground border border-border hover:text-white"
            }`}
          >
            <User size={14} />
            Single User
          </button>
          <button
            type="button"
            onClick={() => setMode("broadcast")}
            className={`flex items-center gap-2 px-6 py-3 rounded-none text-xs uppercase tracking-widest font-bold transition-all ${
              mode === "broadcast"
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-surface-container text-muted-foreground border border-border hover:text-white"
            }`}
          >
            <Send size={14} />
            Broadcast All
          </button>
        </div>

        {/* Recipient Input — only for single user mode */}
        {mode === "single" && (
          <Input
            label="User ID"
            placeholder="Enter user UUID..."
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        )}

        {mode === "broadcast" && (
          <div className="bg-destructive/10 border-l-4 border-destructive px-6 py-4 rounded-none text-sm flex items-center gap-4">
            <AlertTriangle className="text-destructive shrink-0" size={20} />
            <p className="uppercase tracking-tight font-black text-white">
              CRITICAL: THIS WILL BROADCAST TO EVERY REGISTERED USER IN THE PLATFORM.
            </p>
          </div>
        )}

        {/* Title */}
        <Input
          label="Title"
          placeholder="Notification title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
        />

        {/* Message */}
        <Textarea
          label="Message"
          placeholder="Notification message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
        />

        {/* Submit */}
        <Button
          type="submit"
          icon={Send}
          loading={sendMessage.isPending || sendBroadcastAll.isPending}
          disabled={!title.trim() || !message.trim() || (mode === "single" && !userId.trim())}
          fullWidth
          variant={mode === "broadcast" ? "danger" : "primary"}
        >
          {mode === "single" ? "Send to User" : "Broadcast to All Users"}
        </Button>
      </form>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <div 
            ref={modalRef}
            tabIndex={-1}
            className="w-full max-w-lg bg-surface-low border border-border rounded-none shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden focus:outline-none"
          >
            <div className="p-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-destructive/10 flex items-center justify-center border border-destructive/20">
                  <AlertTriangle size={24} className="text-destructive" />
                </div>
                <h3 id="confirm-modal-title" className="text-2xl font-black text-white uppercase tracking-tighter">
                  Confirm <span className="text-destructive">Broadcast</span>
                </h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6 uppercase tracking-wider">
                You are authorizing a global broadcast to <strong className="text-white">all users</strong>.
              </p>
              <div className="bg-surface-container border border-border p-6 mb-10">
                <p className="text-xs uppercase tracking-widest text-primary font-bold mb-2">Payload Preview</p>
                <p className="text-lg font-bold text-white mb-2">{title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
              </div>
              <div className="flex gap-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowConfirm(false)}
                  fullWidth
                  className="rounded-none uppercase tracking-widest font-bold"
                >
                  Abort
                </Button>
                <Button
                  variant="danger"
                  onClick={doSendBroadcast}
                  loading={sendBroadcastAll.isPending}
                  fullWidth
                  className="rounded-none uppercase tracking-widest font-bold"
                >
                  Authorize Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
