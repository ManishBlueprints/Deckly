import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "../services/analyticsService";
import { getVisitorSignals } from "../services/interestSignalService";

// Optimized caching config for analytics data
const ANALYTICS_QUERY_CONFIG = {
  staleTime: 30000, // Data is fresh for 30 seconds
  gcTime: 300000, // Keep in cache for 5 minutes
  refetchInterval: 60000, // Poll every 60 seconds (sufficient for analytics)
  refetchOnWindowFocus: false, // Don't refetch on tab switch (reduces API calls)
} as const;

export function useDeckStats(
    deckId: string | undefined,
    isPro: boolean,
    userId: string | undefined,
    enabled = true,
) {
    return useQuery({
        queryKey: ["deck-stats", deckId, isPro, userId],
        queryFn: () => analyticsService.getDeckStats(deckId!, isPro, userId!),
        enabled: enabled && !!deckId && !!userId,
        ...ANALYTICS_QUERY_CONFIG,
    });
}

export function useDeckBookmarks(
    deckId: string | undefined,
    ownerUserId: string | undefined,
    enabled = true,
) {
    return useQuery({
        queryKey: ["deck-bookmarks", deckId, ownerUserId],
        queryFn: () => analyticsService.getDeckBookmarks(deckId!, ownerUserId!),
        enabled: enabled && !!deckId && !!ownerUserId,
        ...ANALYTICS_QUERY_CONFIG,
    });
}

export function useVisitorSignals(
    deckId: string | undefined,
    ownerUserId: string | undefined,
    enabled = true,
) {
    return useQuery({
        queryKey: ["visitor-signals", deckId, ownerUserId],
        queryFn: () => getVisitorSignals(deckId!, ownerUserId!),
        enabled: enabled && !!deckId && !!ownerUserId,
        ...ANALYTICS_QUERY_CONFIG,
    });
}

export function useUniqueVisitorCount(
    deckId: string | undefined,
    ownerUserId: string | undefined,
    enabled = true,
) {
    return useQuery({
        queryKey: ["unique-visitor-count", deckId, ownerUserId],
        queryFn: () => analyticsService.getUniqueVisitorCount(deckId!, ownerUserId!),
        enabled: enabled && !!deckId && !!ownerUserId,
        ...ANALYTICS_QUERY_CONFIG,
    });
}

export function useDeckLocations(
    deckId: string | undefined,
    ownerUserId: string | undefined,
    enabled = true,
) {
    return useQuery({
        queryKey: ["deck-locations", deckId, ownerUserId],
        queryFn: () => analyticsService.getDeckLocations(deckId!, ownerUserId!),
        enabled: enabled && !!deckId && !!ownerUserId,
        // Locations change less frequently, use longer intervals
        staleTime: 60000,
        gcTime: 600000, // 10 minutes
        refetchInterval: 120000, // Poll every 2 minutes
        refetchOnWindowFocus: false,
    });
}
