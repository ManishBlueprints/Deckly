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
    mutationFn: (notificationId: string) =>
      notificationService.markAsRead(notificationId),
    onMutate: async () => {
      // Snapshot current unread count
      const queryKeys = qc.getQueryCache().findAll({
        queryKey: KEYS.all,
      });
      const affectedUserIds = new Set<string>();
      for (const q of queryKeys) {
        const key = q.queryKey as string[];
        const userIdIdx = key.indexOf("unread-count") + 1;
        if (userIdIdx > 0 && key[userIdIdx]) {
          affectedUserIds.add(key[userIdIdx]);
        }
        const listIdx = key.indexOf("list") + 1;
        if (listIdx > 0 && key[listIdx]) {
          affectedUserIds.add(key[listIdx]);
        }
      }

      // Optimistic: decrement unread count for each user
      for (const uid of affectedUserIds) {
        qc.setQueryData<number>(KEYS.unreadCount(uid), (prev) =>
          prev ? Math.max(0, prev - 1) : 0,
        );
      }

      return { affectedUserIds };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error — invalidate to refetch
      if (context) {
        for (const uid of context.affectedUserIds) {
          qc.invalidateQueries({ queryKey: KEYS.unreadCount(uid as string) });
          qc.invalidateQueries({ queryKey: KEYS.list(uid as string) });
        }
      }
    },
    onSettled: () => {
      // Always invalidate after mutation settles
      qc.invalidateQueries({ queryKey: KEYS.all });
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
