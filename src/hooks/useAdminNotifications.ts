import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "../services/notificationService";

const KEYS = {
  all: ["admin-notifications"] as const,
};

export function useSendAdminMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      userId: string;
      title: string;
      message: string;
    }) =>
      notificationService.createNotification({
        userId: data.userId,
        type: "admin_message",
        title: data.title,
        message: data.message,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useSendBroadcast() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      userIds: string[];
      title: string;
      message: string;
    }) =>
      notificationService.sendAdminBroadcast({
        userIds: data.userIds,
        title: data.title,
        message: data.message,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useSendBroadcastAll() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      message: string;
    }) =>
      notificationService.sendBroadcastAll({
        title: data.title,
        message: data.message,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["is-admin", userId] as const,
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await (
        await import("../services/supabase")
      ).supabase.rpc("is_admin", { p_user_id: userId });
      if (error) {
        console.error("Failed to check admin status:", error);
        throw error;
      }
      return !!data;
    },
    enabled: !!userId,
  });
}
