import { Eye, Bookmark, TrendingUp, FileEdit, Mail } from "lucide-react";
import { cn } from "../../lib/utils";
import { useMarkAsRead } from "../../hooks/useNotifications";
import { toast } from "sonner";
import type { Notification, NotificationType } from "../../types";

interface NotificationItemProps {
  notification: Notification;
}

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Eye; color: string }> = {
  deck_view: { icon: Eye, color: "text-ui-info" },
  deck_save: { icon: Bookmark, color: "text-ui-warning" },
  signal_threshold: { icon: TrendingUp, color: "text-ui-destructive" },
  deck_update: { icon: FileEdit, color: "text-ui-info" },
  admin_message: { icon: Mail, color: "text-ui-primary" },
};

const DEFAULT_CONFIG = { icon: Eye, color: "text-ui-muted" };

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const markAsRead = useMarkAsRead();
  const config = TYPE_CONFIG[notification.type] || DEFAULT_CONFIG;
  const Icon = config.icon;
  const isUnread = notification.read_at === null;

  const handleClick = async () => {
    if (isUnread && !markAsRead.isPending) {
      try {
        await markAsRead.mutateAsync({
          id: notification.id,
          userId: notification.user_id,
        });
      } catch (error) {
        console.error("Failed to mark as read:", error);
        toast.error("Failed to mark notification as read");
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={markAsRead.isPending}
      className={cn(
        "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors disabled:opacity-70",
        isUnread ? "bg-ui-subtle hover:bg-ui-surface" : "hover:bg-ui-subtle",
      )}
    >
      {/* Unread indicator */}
      <div className="pt-1 shrink-0">
        {isUnread && (
          <div className="h-1.5 w-1.5 rounded-full bg-ui-primary" />
        )}
      </div>

      {/* Icon */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ui-border",
          isUnread ? "bg-ui-elevated" : "bg-ui-subtle",
        )}
      >
        <Icon size={16} className={config.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-[13px] font-medium leading-tight text-ui-text">
          {notification.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ui-muted">
          {notification.message}
        </p>
        <p className="mt-1 text-[10px] font-medium text-ui-muted">
          {formatTimeAgo(notification.created_at)}
        </p>
      </div>
    </button>
  );
}
