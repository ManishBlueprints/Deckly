import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deckService } from "../services/deckService";
import { noteService } from "../services/noteService";

export function useIsDeckSaved(
    deckId: string | undefined,
    userId: string | undefined,
) {
    return useQuery({
        queryKey: ["deck-saved", deckId, userId],
        queryFn: () => deckService.isDeckSaved(deckId!),
        enabled: !!deckId && !!userId,
    });
}

export function useInvestorNotes(
    deckId: string | undefined,
    userId: string | undefined,
) {
    return useQuery({
        queryKey: ["investor-notes", deckId, userId],
        queryFn: () => noteService.getNote(deckId!),
        enabled: !!deckId && !!userId,
    });
}

export function useSaveToLibraryMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ deckId, save }: { deckId: string; save: boolean }) =>
            save
                ? deckService.saveToLibrary(deckId)
                : deckService.removeFromLibrary(deckId),
        onMutate: async ({ deckId, save }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({
                queryKey: ["deck-saved", deckId],
            });

            // Snapshot the previous value
            const previousSaved = queryClient.getQueryData([
                "deck-saved",
                deckId,
            ]);

            // Optimistically update to the new value
            queryClient.setQueryData(["deck-saved", deckId], save);

            return { previousSaved };
        },
        onError: (_err, { deckId }, context) => {
            // Rollback on error
            if (context?.previousSaved !== undefined) {
                queryClient.setQueryData(
                    ["deck-saved", deckId],
                    context.previousSaved,
                );
            }
        },
        onSettled: (_data, _err, { deckId }) => {
            // Always refetch after error or success to ensure sync
            queryClient.invalidateQueries({ queryKey: ["deck-saved", deckId] });
            queryClient.invalidateQueries({ queryKey: ["user-total-stats"] });
        },
    });
}

export function useSaveNoteMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (
            { deckId, content }: { deckId: string; content: string },
        ) => noteService.saveNote(deckId, content),
        onMutate: async ({ deckId, content }) => {
            await queryClient.cancelQueries({
                queryKey: ["investor-notes", deckId],
            });
            const previousNote = queryClient.getQueryData([
                "investor-notes",
                deckId,
            ]);
            queryClient.setQueryData(["investor-notes", deckId], content);
            return { previousNote };
        },
        onError: (_err, { deckId }, context) => {
            if (context?.previousNote !== undefined) {
                queryClient.setQueryData(
                    ["investor-notes", deckId],
                    context.previousNote,
                );
            }
        },
        onSettled: (_data, _err, { deckId }) => {
            queryClient.invalidateQueries({
                queryKey: ["investor-notes", deckId],
            });
        },
    });
}
