import { useQuery } from "@tanstack/react-query";
import { getFeatureAccess, tierEntitlementService, type FeatureKey } from "../services/tierEntitlementService";
import type { Tier } from "../constants/tiers";

export function usePricingCatalog(enabled = true) {
  return useQuery({
    queryKey: ["pricing-catalog"],
    queryFn: () => tierEntitlementService.getPricingCatalog(),
    enabled,
    staleTime: 1000 * 60 * 10,
  });
}

export function useMyEntitlements(enabled = true, tier?: Tier) {
  return useQuery({
    queryKey: ["my-entitlements", tier],
    queryFn: () => tierEntitlementService.getMyEntitlements(),
    enabled,
    staleTime: 1000 * 60,
  });
}

export function useTierFeatureAccess(tier: Tier | undefined, featureKey: FeatureKey, enabled = true) {
  const catalog = usePricingCatalog(enabled);
  return {
    ...catalog,
    access: getFeatureAccess(catalog.data, tier, featureKey),
  };
}
