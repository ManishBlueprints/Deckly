import { useState } from "react";
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
      const count = await sendBroadcastAll.mutateAsync({
        title: title.trim(),
        message: message.trim(),
      });
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "single"
                ? "bg-deckly-primary/10 text-deckly-primary border border-deckly-primary/20"
                : "bg-white/5 text-slate-500 border border-white/10 hover:text-slate-300"
            }`}
          >
            <User size={14} />
            Single User
          </button>
          <button
            type="button"
            onClick={() => setMode("broadcast")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "broadcast"
                ? "bg-deckly-primary/10 text-deckly-primary border border-deckly-primary/20"
                : "bg-white/5 text-slate-500 border border-white/10 hover:text-slate-300"
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
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-sm text-amber-300">
            This will send a notification to <strong>all users</strong> in the system.
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0e0e0e] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Confirm Broadcast</h3>
              </div>
              <p className="text-sm text-slate-400 mb-2">
                You are about to send this notification to <strong className="text-white">all users</strong>:
              </p>
              <div className="bg-white/5 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-slate-200">{title}</p>
                <p className="text-xs text-slate-500 mt-1">{message}</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowConfirm(false)}
                  fullWidth
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={doSendBroadcast}
                  loading={sendBroadcastAll.isPending}
                  fullWidth
                >
                  Broadcast
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
