import { Bell, CheckCheck, Loader2, X } from "lucide-react";
import {
  useNotifications,
  useMarkAllAsRead,
} from "../../hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";
import type { GroupedNotification } from "../../types";

interface NotificationPanelProps {
  userId: string | undefined;
  onClose: () => void;
}

export function NotificationPanel({ userId, onClose }: NotificationPanelProps) {
  const { grouped, isLoading } = useNotifications(userId);
  const markAllAsRead = useMarkAllAsRead();

  const handleMarkAllRead = async () => {
    if (userId) {
      try {
        await markAllAsRead.mutateAsync(userId);
      } catch (error) {
        // Error is typically handled by the mutation's onError callback
        console.error("Failed to mark notifications as read:", error);
      }
    }
  };
  return (
    <div className="flex max-h-[480px] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-ui-border bg-ui-elevated text-ui-text shadow-[var(--ui-shadow-overlay)] sm:w-[400px]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-ui-border px-4 py-3">
        <h2 className="text-sm font-semibold">
          Notifications
        </h2>
        <div className="flex items-center gap-2">
          {grouped.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ui-muted transition-colors hover:bg-ui-subtle hover:text-ui-text"
            >
              <CheckCheck size={12} />
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ui-muted transition-colors hover:bg-ui-subtle hover:text-ui-text"
            aria-label="Close notifications"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-ui-primary" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-ui-border bg-ui-subtle text-ui-muted">
              <Bell className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-ui-text">
              No notifications yet
            </p>
            <p className="mt-1 text-xs text-ui-muted">
              We&apos;ll notify you when something happens
            </p>
          </div>
        ) : (
          <div className="py-2">
            {grouped.map((group: GroupedNotification, index: number) => (
              <div key={`${group.type}-${group.date}`}>
                {/* Group Header */}
                <div className="px-4 py-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-ui-muted">
                    {group.title}
                  </span>
                  {group.count > 1 && (
                    <span className="rounded-md border border-ui-border bg-ui-subtle px-1.5 py-0.5 text-[10px] font-medium text-ui-muted">
                      {group.count}
                    </span>
                  )}
                </div>

                {/* Group Items */}
                {group.notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                  />
                ))}

                {/* Divider between groups */}
                {index < grouped.length - 1 && (
                  <div className="mx-4 my-1 border-t border-ui-border" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
