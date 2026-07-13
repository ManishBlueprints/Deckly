import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { subscriptionService } from "../services/subscriptionService";

export const subscriptionQueryKey = (profileId: string | undefined) => ["subscription", profileId] as const;
export const billingHistoryQueryKey = (profileId: string | undefined) => ["billing-history", profileId] as const;

/**
 * The only client-side source for the normalized subscription response.
 * Provider payloads remain server-only; this hook coordinates the customer-safe
 * recovery path and ensures every billing mutation refreshes the same caches.
 */
export function useSubscriptionState() {
  const { profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const profileId = profile?.id;
  const subscriptionQuery = useQuery({
    queryKey: subscriptionQueryKey(profileId),
    queryFn: subscriptionService.getCurrent,
    enabled: Boolean(profileId),
    staleTime: 30_000,
  });

  const refreshBilling = useCallback(async () => {
    await Promise.all([
      refreshProfile(),
      queryClient.invalidateQueries({ queryKey: subscriptionQueryKey(profileId) }),
      queryClient.invalidateQueries({ queryKey: ["profile", profileId] }),
      queryClient.invalidateQueries({ queryKey: billingHistoryQueryKey(profileId) }),
    ]);
  }, [profileId, queryClient, refreshProfile]);

  useEffect(() => {
    if (!profileId || subscriptionQuery.data?.provider_status !== "created") return;
    let disposed = false;

    void (async () => {
      try {
        const result = await subscriptionService.refreshCreated();
        if (!disposed && result.reconciled > 0) await refreshBilling();
      } catch {
        // Scheduled reconciliation is the recovery path when Razorpay cannot
        // be reached from this browser session.
      }
    })();

    return () => { disposed = true; };
  }, [profileId, refreshBilling, subscriptionQuery.data?.id, subscriptionQuery.data?.provider_status]);

  return {
    profileId,
    subscription: subscriptionQuery.data,
    subscriptionLoading: subscriptionQuery.isLoading,
    subscriptionError: subscriptionQuery.error,
    refreshBilling,
  };
}
