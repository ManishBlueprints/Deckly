import { X, CheckCheck } from "lucide-react";
import { useNotifications, useMarkAllAsRead } from "../../hooks/useNotifications";
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
      await markAllAsRead.mutateAsync(userId);
    }
  };

  return (
    <div className="w-[380px] max-h-[480px] bg-[#0e0e0e] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
          Notifications
        </h3>
        <div className="flex items-center gap-2">
          {grouped.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-200 uppercase tracking-wider transition-colors flex items-center gap-1"
            >
              <CheckCheck size={12} />
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-[#54e98a]/20 border-t-[#54e98a] rounded-full animate-spin" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-10 h-10 mb-3 rounded-full bg-white/5 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-500">
              No notifications yet
            </p>
            <p className="text-xs text-slate-600 mt-1">
              We&apos;ll notify you when something happens
            </p>
          </div>
        ) : (
          <div className="py-2">
            {grouped.map((group: GroupedNotification, index: number) => (
              <div key={`${group.type}-${group.date}`}>
                {/* Group Header */}
                <div className="px-4 py-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {group.title}
                  </span>
                  {group.count > 1 && (
                    <span className="text-[10px] font-medium text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">
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
                  <div className="mx-4 my-1 border-t border-white/5" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
