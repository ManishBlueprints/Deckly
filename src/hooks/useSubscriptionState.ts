import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { subscriptionService } from "../services/subscriptionService";

export const subscriptionQueryKey = (profileId: string | undefined) => ["subscription", profileId] as const;
export const billingHistoryQueryKey = (profileId: string | undefined) => ["billing-history", profileId] as const;
const CREATED_SUBSCRIPTION_RETRY_DELAYS_MS = [5_000, 15_000];

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
  const refreshBillingRef = useRef(refreshBilling);

  useEffect(() => {
    refreshBillingRef.current = refreshBilling;
  }, [refreshBilling]);

  useEffect(() => {
    if (!profileId || !subscriptionId || providerStatus !== "created") return;
    if (reconciledCreatedSubscriptionId.current === subscriptionId) return;

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const reconcileCreatedSubscription = async (attempt: number) => {
      try {
        const result = await subscriptionService.refreshCreated();
        if (disposed) return;

        // A successful authoritative check is enough for this checkout. Avoid
        // rerunning it on unrelated AuthContext rerenders.
        reconciledCreatedSubscriptionId.current = subscriptionId;
        if (result.reconciled > 0) {
          try {
            await refreshBillingRef.current();
          } catch {
            // The provider state was already refreshed. Normal query retries
            // and scheduled reconciliation can recover a cache refresh.
          }
        }
      } catch {
        // Scheduled reconciliation is the recovery path when Razorpay cannot
        // be reached from this browser session. Retry transient browser/Edge
        // failures a bounded number of times without reopening the checkout.
        const retryDelay = CREATED_SUBSCRIPTION_RETRY_DELAYS_MS[attempt];
        if (!disposed && retryDelay !== undefined) {
          retryTimer = setTimeout(() => {
            void reconcileCreatedSubscription(attempt + 1);
          }, retryDelay);
        }
      }
    };

    void reconcileCreatedSubscription(0);

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [profileId, providerStatus, subscriptionId]);

  return {
    profileId,
    subscription,
    subscriptionLoading: subscriptionQuery.isLoading,
    subscriptionError: subscriptionQuery.error,
    refreshBilling,
  };
}
