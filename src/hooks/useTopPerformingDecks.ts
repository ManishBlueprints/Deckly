import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "../services/analyticsService";
import { getDeckSignalCount } from "../services/interestSignalService";

export interface DeckStat {
    id: string;
    title: string;
    views: number;
    time: number;
}

export function useTopPerformingDecks(userId: string | undefined) {
    return useQuery({
        queryKey: ["top-decks", userId],
        queryFn: async () => {
            const data = await analyticsService.getTopPerformingDecks(userId!);

            const mapped = data.map((d: DeckStat) => ({
                id: d.id,
                title: d.title,
                views: d.views,
                time: d.time,
            }));

            return mapped as DeckStat[];
        },
        enabled: !!userId,
    });
}

export function useDeckSignalCounts(deckIds: string[]) {
    return useQuery({
        queryKey: ["deck-signal-counts", ...deckIds],
        queryFn: async () => {
            if (!deckIds.length) return {};

            const counts: Record<string, number> = {};
            await Promise.all(
                deckIds.map(async (id) => {
                    counts[id] = await getDeckSignalCount(id);
                }),
            );

            return counts;
        },
        enabled: deckIds.length > 0,
    });
}
