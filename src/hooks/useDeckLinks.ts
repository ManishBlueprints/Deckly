import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deckLinkService } from "../services/deckLinkService";
import { deckQueryKeys } from "./useDecks";
import { productAnalytics } from "../services/productAnalytics";

type CreateDeckLinkInput = {
  linkName?: string;
  linkAlias?: string;
};

export const deckLinkQueryKeys = {
  list: (deckId: string, userId?: string) =>
    ["deck-links", deckId, userId ?? "anonymous"] as const,
  noDeck: ["deck-links", "no-deck"] as const,
  deckList: deckQueryKeys.list,
  deckDetail: (deckId: string) => ["deck", deckId] as const,
};

async function invalidateDeckLinkRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  deckId: string,
  userId?: string,
) {
  const invalidations = [
    queryClient.invalidateQueries({
      queryKey: deckLinkQueryKeys.list(deckId, userId),
    }),
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
    queryKey: deckId
      ? deckLinkQueryKeys.list(deckId, userId)
      : deckLinkQueryKeys.noDeck,
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
    onSuccess: async (link) => {
      if (!deckId) return;
      await invalidateDeckLinkRelatedQueries(queryClient, deckId, userId);
      const links = await deckLinkService.listDeckLinks(deckId, userId);
      productAnalytics.capture("deck_link_created", {
        workspace_id: userId,
        source_surface: "content_library",
        deck_id: deckId,
        link_id: link.id,
        link_count_after: links.length,
        is_primary: link.is_primary,
        event_id: `link:${link.id}:created`,
      });
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
    onSuccess: async (link) => {
      if (!deckId) return;
      await invalidateDeckLinkRelatedQueries(queryClient, deckId, userId);
      productAnalytics.capture("deck_link_enabled", {
        workspace_id: userId,
        source_surface: "content_library",
        deck_id: deckId,
        link_id: link.id,
        is_primary: link.is_primary,
        event_id: `link:${link.id}:enabled:${link.updated_at ?? Date.now()}`,
      });
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
    onSuccess: async (link) => {
      if (!deckId) return;
      await invalidateDeckLinkRelatedQueries(queryClient, deckId, userId);
      productAnalytics.capture("deck_link_disabled", {
        workspace_id: userId,
        source_surface: "content_library",
        deck_id: deckId,
        link_id: link.id,
        is_primary: link.is_primary,
        event_id: `link:${link.id}:disabled:${link.updated_at ?? Date.now()}`,
      });
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
    onSuccess: async (_data, linkId) => {
      if (!deckId) return;
      await invalidateDeckLinkRelatedQueries(queryClient, deckId, userId);
      const links = await deckLinkService.listDeckLinks(deckId, userId);
      productAnalytics.capture("deck_link_deleted", {
        workspace_id: userId,
        source_surface: "content_library",
        deck_id: deckId,
        link_id: linkId,
        link_count_after: links.length,
        event_id: `link:${linkId}:deleted`,
      });
    },
  });
}
