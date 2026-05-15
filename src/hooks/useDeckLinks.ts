import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deckLinkService } from "../services/deckLinkService";

type CreateDeckLinkInput = {
  linkName?: string;
  linkAlias?: string;
};

export const deckLinkQueryKeys = {
  list: (deckId: string) => ["deck-links", deckId] as const,
  noDeck: ["deck-links", "no-deck"] as const,
  deckList: (userId: string) => ["decks", userId] as const,
  deckDetail: (deckId: string) => ["deck", deckId] as const,
};

async function invalidateDeckLinkRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  deckId: string,
  userId?: string,
) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: deckLinkQueryKeys.list(deckId) }),
    queryClient.invalidateQueries({ queryKey: deckLinkQueryKeys.deckDetail(deckId) }),
  ];

  if (userId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: deckLinkQueryKeys.deckList(userId) }),
    );
  }

  await Promise.all(invalidations);
}

export function useDeckLinks(
  deckId?: string,
  userId?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: deckId ? deckLinkQueryKeys.list(deckId) : deckLinkQueryKeys.noDeck,
    queryFn: () => deckLinkService.listDeckLinks(deckId!, userId),
    enabled: !!deckId && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useCreateDeckLink(deckId?: string, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input?: CreateDeckLinkInput) => {
      if (!deckId) {
        throw new Error("A deck ID is required to create a deck link.");
      }

      if (input) {
        return deckLinkService.createDeckLink(deckId, input, userId);
      }

      return deckLinkService.createDefaultDeckLink(deckId, userId);
    },
    onSuccess: async () => {
      if (!deckId) return;
      await invalidateDeckLinkRelatedQueries(queryClient, deckId, userId);
    },
  });
}

export function useEnableDeckLink(deckId?: string, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => {
      if (!deckId) {
        throw new Error("A deck ID is required to enable a deck link.");
      }

      return deckLinkService.enableDeckLink(deckId, linkId, userId);
    },
    onSuccess: async () => {
      if (!deckId) return;
      await invalidateDeckLinkRelatedQueries(queryClient, deckId, userId);
    },
  });
}

export function useDisableDeckLink(deckId?: string, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => {
      if (!deckId) {
        throw new Error("A deck ID is required to disable a deck link.");
      }

      return deckLinkService.disableDeckLink(deckId, linkId, userId);
    },
    onSuccess: async () => {
      if (!deckId) return;
      await invalidateDeckLinkRelatedQueries(queryClient, deckId, userId);
    },
  });
}

export function useDeleteDeckLink(deckId?: string, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => {
      if (!deckId) {
        throw new Error("A deck ID is required to delete a deck link.");
      }

      return deckLinkService.deleteDeckLink(deckId, linkId, userId);
    },
    onSuccess: async () => {
      if (!deckId) return;
      await invalidateDeckLinkRelatedQueries(queryClient, deckId, userId);
    },
  });
}
