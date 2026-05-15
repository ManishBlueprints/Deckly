import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deckLinkService } from "../services/deckLinkService";

export const deckLinkQueryKeys = {
  list: (deckId: string) => ["deck-links", deckId] as const,
  disabled: ["deck-links", "disabled"] as const,
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
    queryKey: deckId ? deckLinkQueryKeys.list(deckId) : deckLinkQueryKeys.disabled,
    queryFn: () => deckLinkService.listDeckLinks(deckId!, userId),
    enabled: !!deckId && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useCreateDeckLink(deckId?: string, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input?: CreateDeckLinkInput) =>
      deckLinkService.createDeckLink(deckId!, input, userId),
    onSuccess: async () => {
      if (!deckId) return;
      await invalidateDeckLinkRelatedQueries(queryClient, deckId, userId);
    },
  });
}

export function useEnableDeckLink(deckId?: string, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => deckLinkService.enableDeckLink(deckId!, linkId, userId),
    onSuccess: async () => {
      if (!deckId) return;
      await invalidateDeckLinkRelatedQueries(queryClient, deckId, userId);
    },
  });
}

export function useDisableDeckLink(deckId?: string, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => deckLinkService.disableDeckLink(deckId!, linkId, userId),
    onSuccess: async () => {
      if (!deckId) return;
      await invalidateDeckLinkRelatedQueries(queryClient, deckId, userId);
    },
  });
}

export function useDeleteDeckLink(deckId?: string, userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => deckLinkService.deleteDeckLink(deckId!, linkId, userId),
    onSuccess: async () => {
      if (!deckId) return;
      await invalidateDeckLinkRelatedQueries(queryClient, deckId, userId);
    },
  });
}
type CreateDeckLinkInput = {
  linkName?: string;
  linkAlias?: string;
};
