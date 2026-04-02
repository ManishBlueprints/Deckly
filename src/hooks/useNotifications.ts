import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "../services/notificationService";
import type { GroupedNotification } from "../types";

const KEYS = {
  all: ["notifications"] as const,
  list: (userId: string) => [...KEYS.all, "list", userId] as const,
  unreadCount: (userId: string) => [...KEYS.all, "unread-count", userId] as const,
};

const STALE_TIME = 30_000;
const REFRESH_INTERVAL = 30_000;

export function useNotifications(userId: string | undefined) {
  const notificationsQ = useQuery({
    queryKey: userId ? KEYS.list(userId) : [...KEYS.all, "noop"],
    queryFn: () => notificationService.getNotifications(userId!),
    enabled: !!userId,
    staleTime: STALE_TIME,
    refetchInterval: REFRESH_INTERVAL,
  });

  const rawNotifications = notificationsQ.data ?? [];
  const grouped: GroupedNotification[] =
    notificationService.groupNotifications(rawNotifications);

  return {
    notifications: rawNotifications,
    grouped,
    isLoading: notificationsQ.isLoading,
    isError: notificationsQ.isError,
    refetch: notificationsQ.refetch,
  };
}

export function useUnreadCount(userId: string | undefined) {
  const countQ = useQuery({
    queryKey: userId ? KEYS.unreadCount(userId) : [...KEYS.all, "unread-noop"],
    queryFn: () => notificationService.getUnreadCount(userId!),
    enabled: !!userId,
    staleTime: STALE_TIME,
    refetchInterval: REFRESH_INTERVAL,
  });

  return {
    count: countQ.data ?? 0,
    isLoading: countQ.isLoading,
  };
}

export function useMarkAsRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      notificationService.markAsRead(id, userId),
    onMutate: async ({ userId }) => {
      // Snapshot current unread count for rollback
      const prevCount = qc.getQueryData<number>(KEYS.unreadCount(userId));

      // Optimistic: decrement unread count for this user only
      qc.setQueryData<number>(KEYS.unreadCount(userId), (prev) =>
        prev ? Math.max(0, prev - 1) : 0,
      );

      return { userId, prevCount };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context) {
        qc.setQueryData(KEYS.unreadCount(context.userId), context.prevCount);
      }
    },
    onSettled: (_data, _err, _vars, context) => {
      // Always invalidate after mutation settles
      if (context) {
        qc.invalidateQueries({ queryKey: KEYS.unreadCount(context.userId) });
        qc.invalidateQueries({ queryKey: KEYS.list(context.userId) });
      }
    },
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => notificationService.markAllAsRead(userId),
    onSuccess: (_data, userId) => {
      qc.setQueryData(KEYS.unreadCount(userId), 0);
      qc.invalidateQueries({ queryKey: KEYS.list(userId) });
    },
  });
}
