import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "../services/analyticsService";

export const userTotalStatsQueryKeys = {
    allForUser: (userId: string) => ["user-total-stats", userId] as const,
    detail: (userId: string, deckId?: string) => ["user-total-stats", userId, deckId || "all"] as const,
};

export function useUserTotalStats(userId: string | undefined, deckId?: string) {
    return useQuery({
        queryKey: userId ? userTotalStatsQueryKeys.detail(userId, deckId) : ["user-total-stats", undefined, deckId || "all"],
        queryFn: () => analyticsService.getUserTotalStats(userId!, deckId),
        enabled: !!userId,
    });
}
