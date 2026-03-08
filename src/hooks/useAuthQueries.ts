import { useQuery } from "@tanstack/react-query";
import { userService } from "../services/userService";
import { deckService } from "../services/deckService";

export function useProfile(userId: string | undefined) {
    return useQuery({
        queryKey: ["profile", userId],
        queryFn: () => userService.getProfile(userId!),
        enabled: !!userId,
        staleTime: 1000 * 60 * 10, // 10 minutes
    });
}

export function useBranding(userId: string | undefined) {
    return useQuery({
        queryKey: ["branding", userId],
        queryFn: () => deckService.getBrandingSettings(userId!),
        enabled: !!userId,
        staleTime: 1000 * 60 * 30, // 30 minutes
    });
}
