import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "../services/analyticsService";

export function useDailyMetrics(userId: string | undefined, deckId?: string) {
    return useQuery({
        queryKey: ["daily-metrics", userId, deckId || "all"],
        queryFn: () => analyticsService.getDailyMetrics(userId!, deckId),
        enabled: !!userId,
    });
}
