import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "../services/analyticsService";

export function useUserTotalStats(userId: string | undefined, deckId?: string) {
    return useQuery({
        queryKey: ["user-total-stats", userId, deckId || "all"],
        queryFn: () =>
            analyticsService.getUserTotalStats(userId!, deckId, true),
        enabled: !!userId,
    });
}
