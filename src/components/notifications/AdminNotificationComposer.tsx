import { useState, useEffect } from "react";
import { Send, User, AlertTriangle } from "lucide-react";
import {
  useSendAdminMessage,
  useSendBroadcastAll,
} from "../../hooks/useAdminNotifications";
import { Button } from "../ui/button";
import { FormInput } from "../ui/form-input";
import { FormTextarea } from "../ui/form-textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
} from "../ui/alert-dialog";
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

  // Confirmation logic is now handled by AlertDialog state
  useEffect(() => {
    if (!showConfirm) return;
    // AlertDialog handles focus trap and escape key natively
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

      // Defensive check for the returned count (handles both direct number and { count } object)
      const count =
        typeof result === "number"
          ? result
          : result && typeof (result as { count?: number }).count === "number"
            ? (result as { count?: number }).count!
            : 0;

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
          <FormInput
            label="User ID"
            placeholder="Enter user UUID..."
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        )}

        {mode === "broadcast" && (
          <div
            className="bg-destructive/10 border-l-4 border-destructive px-6 py-4 rounded-none text-sm flex items-center gap-4"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <AlertTriangle className="text-destructive shrink-0" size={20} />
            <p className="font-bold text-white">
              Critical: This will broadcast to every registered user.
            </p>
          </div>
        )}

        {/* Title */}
        <FormInput
          label="Title"
          placeholder="Notification title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
        />

        {/* Message */}
        <FormTextarea
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
          disabled={
            !title.trim() ||
            !message.trim() ||
            (mode === "single" && !userId.trim())
          }
          fullWidth
          variant={mode === "broadcast" ? "destructive" : "default"}
        >
          {mode === "single" ? "Send to User" : "Broadcast to All Users"}
        </Button>
      </form>

      {/* Confirmation Modal */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="w-full max-w-lg bg-slate-900 border border-white/10 p-0 overflow-hidden">
          <div className="p-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <h3 className="text-2xl font-bold text-white uppercase tracking-tighter">
                Confirm <span className="text-red-500">Broadcast</span>
              </h3>
            </div>
            <p className="text-sm text-neutral-400 mb-6 uppercase tracking-wider">
              You are authorizing a global broadcast to{" "}
              <strong className="text-white">all users</strong>.
            </p>
            <div className="bg-slate-950 border border-white/5 p-6 mb-10">
              <p className="text-xs uppercase tracking-widest text-deckly-primary font-bold mb-2">
                Payload Preview
              </p>
              <p className="text-lg font-bold text-white mb-2">{title}</p>
              <p className="text-sm text-neutral-400 leading-relaxed">
                {message}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <AlertDialogCancel asChild>
                <Button variant="ghost" className="rounded-none">
                  Abort
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  variant="destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    doSendBroadcast();
                  }}
                  loading={sendBroadcastAll.isPending}
                  className="rounded-none"
                >
                  Authorize Send
                </Button>
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
