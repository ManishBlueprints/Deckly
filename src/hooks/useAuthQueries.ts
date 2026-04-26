import { useQuery } from "@tanstack/react-query";
import { userService } from "../services/userService";
import { deckService } from "../services/deckService";

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: () =>
      withTimeout(userService.getProfile(userId!), 10000, "Profile load"),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: false,
  });
}

export function useBranding(userId: string | undefined) {
  return useQuery({
    queryKey: ["branding", userId],
    queryFn: () =>
      withTimeout(
        deckService.getBrandingSettings(userId!),
        10000,
        "Branding load",
      ),
    enabled: !!userId,
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: false,
  });
}
