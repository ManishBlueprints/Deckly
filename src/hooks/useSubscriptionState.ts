import { useCallback, useEffect, useRef } from "react";
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
  const reconciledCreatedSubscriptionId = useRef<string | null>(null);
  const subscriptionQuery = useQuery({
    queryKey: subscriptionQueryKey(profileId),
    queryFn: subscriptionService.getCurrent,
    enabled: Boolean(profileId),
    staleTime: 30_000,
  });
  const subscription = subscriptionQuery.data;
  const subscriptionId = subscription?.id;
  const providerStatus = subscription?.provider_status;

  const refreshBilling = useCallback(async () => {
    await Promise.all([
      refreshProfile(),
      queryClient.invalidateQueries({ queryKey: subscriptionQueryKey(profileId) }),
      queryClient.invalidateQueries({ queryKey: ["profile", profileId] }),
      queryClient.invalidateQueries({ queryKey: billingHistoryQueryKey(profileId) }),
    ]);
  }, [profileId, queryClient, refreshProfile]);

  useEffect(() => {
    if (!profileId || !subscriptionId || providerStatus !== "created") return;
    if (reconciledCreatedSubscriptionId.current === subscriptionId) return;

    reconciledCreatedSubscriptionId.current = subscriptionId;
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
  }, [profileId, providerStatus, refreshBilling, subscriptionId]);

  return {
    profileId,
    subscription,
    subscriptionLoading: subscriptionQuery.isLoading,
    subscriptionError: subscriptionQuery.error,
    refreshBilling,
  };
}
