import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "../services/analyticsService";
import { getVisitorSignals } from "../services/interestSignalService";

export function useDeckStats(
    deckId: string | undefined,
    isPro: boolean,
    userId: string | undefined,
) {
    return useQuery({
        queryKey: ["deck-stats", deckId],
        queryFn: () => analyticsService.getDeckStats(deckId!, isPro, userId!),
        enabled: !!deckId && !!userId,
        staleTime: 0,
        refetchInterval: 45000,
        refetchOnWindowFocus: true,
    });
}

export function useDeckBookmarks(deckId: string | undefined) {
    return useQuery({
        queryKey: ["deck-bookmarks", deckId],
        queryFn: () => analyticsService.getDeckBookmarks(deckId!),
        enabled: !!deckId,
        staleTime: 0,
        refetchInterval: 45000,
        refetchOnWindowFocus: true,
    });
}

export function useVisitorSignals(deckId: string | undefined) {
    return useQuery({
        queryKey: ["visitor-signals", deckId],
        queryFn: () => getVisitorSignals(deckId!),
        enabled: !!deckId,
        staleTime: 0,
        refetchInterval: 45000,
        refetchOnWindowFocus: true,
    });
}

export function useUniqueVisitorCount(deckId: string | undefined) {
    return useQuery({
        queryKey: ["unique-visitor-count", deckId],
        queryFn: () => analyticsService.getUniqueVisitorCount(deckId!),
        enabled: !!deckId,
        staleTime: 0,
        refetchInterval: 45000,
        refetchOnWindowFocus: true,
    });
}
