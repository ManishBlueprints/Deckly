import { useQuery } from "@tanstack/react-query";
import { deckService } from "../services/deckService";

export function useDecks(userId: string | undefined) {
    return useQuery({
        queryKey: ["decks", userId],
        queryFn: () => deckService.getDecksWithAnalytics(userId!),
        enabled: !!userId,
    });
}
