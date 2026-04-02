import { Eye, Bookmark, TrendingUp, FileEdit, Mail } from "lucide-react";
import { cn } from "../../utils/cn";
import { useMarkAsRead } from "../../hooks/useNotifications";
import type { Notification, NotificationType } from "../../types";

interface NotificationItemProps {
  notification: Notification;
}

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Eye; color: string }> = {
  deck_view: { icon: Eye, color: "text-blue-400" },
  deck_save: { icon: Bookmark, color: "text-amber-400" },
  signal_threshold: { icon: TrendingUp, color: "text-red-400" },
  deck_update: { icon: FileEdit, color: "text-purple-400" },
  admin_message: { icon: Mail, color: "text-emerald-400" },
};

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
  const config = TYPE_CONFIG[notification.type];
  const Icon = config.icon;
  const isUnread = notification.read_at === null;

  const handleClick = async () => {
    if (isUnread) {
      await markAsRead.mutateAsync(notification.id);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors",
        isUnread
          ? "bg-white/[0.03] hover:bg-white/[0.06]"
          : "hover:bg-white/[0.03]",
      )}
    >
      {/* Unread indicator */}
      <div className="pt-1 shrink-0">
        {isUnread && (
          <div className="w-1.5 h-1.5 rounded-full bg-[#54e98a]" />
        )}
      </div>

      {/* Icon */}
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          isUnread ? "bg-white/10" : "bg-white/5",
        )}
      >
        <Icon size={16} className={config.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-slate-100 truncate leading-tight">
          {notification.title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
          {notification.message}
        </p>
        <p className="text-[10px] text-slate-600 mt-1 font-medium">
          {formatTimeAgo(notification.created_at)}
        </p>
      </div>
    </button>
  );
}
