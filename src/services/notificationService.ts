import { supabase } from "./supabase";
import { withRetry } from "../utils/resilience";
import type {
  GroupedNotification,
  Notification,
  NotificationType,
} from "../types";

export const notificationService = {
  // Get all notifications for a user, ordered by created_at DESC
  async getNotifications(userId: string): Promise<Notification[]> {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as Notification[];
    });
  },

  // Get unread notification count
  async getUnreadCount(userId: string): Promise<number> {
    return withRetry(async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);

      if (error) throw error;
      return count || 0;
    });
  },

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string): Promise<void> {
    await withRetry(async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) throw error;
    });
  },
  // Mark a notification as read
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await withRetry(async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", userId);
      if (error) throw error;
    });
  },

  // Delete a notification
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await withRetry(async () => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", userId);
      if (error) throw error;
    });
  },

  // Create a notification via RPC
  async createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null> {
    const { data: notificationId, error } = await supabase.rpc(
      "create_notification",
      {
        p_user_id: data.userId,
        p_type: data.type,
        p_title: data.title,
        p_message: data.message,
        p_metadata: (data.metadata || {}) as Record<string, unknown>,
      },
    );

    if (error) throw error;
    // RPC can intentionally return NULL when deduplicating duplicate notifications.
    if (!notificationId) return null;
    return notificationId as string;
  },
  // Send admin broadcast to specific users via RPC
  async sendAdminBroadcast(data: {
    userIds: string[];
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<number> {
    const { data: count, error } = await supabase.rpc(
      "create_admin_broadcast",
      {
        p_user_ids: data.userIds,
        p_title: data.title,
        p_message: data.message,
        p_metadata: (data.metadata || {}) as Record<string, unknown>,
      },
    );

    if (error) throw error;
    return count as number;
  },

  // Send admin broadcast to ALL users via RPC
  async sendBroadcastAll(data: {
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<number> {
    const { data: count, error } = await supabase.rpc(
      "create_admin_broadcast_all",
      {
        p_title: data.title,
        p_message: data.message,
        p_metadata: (data.metadata || {}) as Record<string, unknown>,
      },
    );

    if (error) throw error;
    return count as number;
  },

  // Group notifications by type + day
  groupNotifications(notifications: Notification[]): GroupedNotification[] {
    const groups: Record<string, GroupedNotification> = {};

    for (const notification of notifications) {
      const date = notification.created_at.split("T")[0]; // YYYY-MM-DD
      const key = `${notification.type}::${date}`;

      if (!groups[key]) {
        groups[key] = {
          type: notification.type,
          date,
          title: getGroupTitle(notification.type, date),
          count: 0,
          notifications: [],
        };
      }

      groups[key].count++;
      groups[key].notifications.push(notification);
    }

    // Sort groups by date DESC, then by count DESC
    return Object.values(groups).sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.count - a.count;
    });
  },
};

function getGroupTitle(type: NotificationType, date: string): string {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const dayLabel = date === today
    ? "Today"
    : date === yesterday
    ? "Yesterday"
    : date;

  const typeLabels: Record<NotificationType, string> = {
    deck_view: "Views",
    deck_save: "Saves",
    signal_threshold: "High Interest",
    deck_update: "Updates",
    admin_message: "Messages",
  };

  return `${typeLabels[type]} — ${dayLabel}`;
}
