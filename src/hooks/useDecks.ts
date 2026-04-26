import { useQuery } from "@tanstack/react-query";
import { deckService } from "../services/deckService";

export function useDecks(userId: string | undefined) {
    return useQuery({
        queryKey: ["decks", userId],
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
        queryKey: ["deck", deckId],
        queryFn: () => deckService.getDeckById(deckId!, userId),
        enabled: !!deckId,
    });
}
