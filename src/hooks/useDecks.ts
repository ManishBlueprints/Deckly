import { useQuery } from "@tanstack/react-query";
import { deckService } from "../services/deckService";

export const deckQueryKeys = {
    list: (userId: string) => ["decks", userId] as const,
    detail: (deckId: string) => ["deck", deckId] as const,
};

export function useDecks(userId: string | undefined) {
    return useQuery({
        queryKey: userId ? deckQueryKeys.list(userId) : ["decks", undefined],
        queryFn: () => deckService.getDecksWithAnalytics(userId!),
        enabled: !!userId,
        staleTime: 30_000,
    });
}

export function useDeck(
    deckId: string | undefined,
    userId: string | undefined,
) {
    return useQuery({
        queryKey: deckId ? deckQueryKeys.detail(deckId) : ["deck", undefined],
        queryFn: () => deckService.getDeckById(deckId!, userId),
        enabled: !!deckId,
    });
}
