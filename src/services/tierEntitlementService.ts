import { supabase } from "./supabase";
import type { Tier } from "../constants/tiers";

export type FeatureKey =
  | "unlimited_viewers"
  | "link_analytics"
  | "page_analytics"
  | "visitor_signals"
  | "access_controls"
  | "deck_downloads"
  | "custom_logo"
  | "team_collaboration"
  | "custom_colours"
  | "analytics_export"
  | "granular_downloads"
  | "white_label_domain"
  | "diligence_controls";

export type FeatureAvailability = "live" | "coming_soon";

export interface TierLimits {
  maxDataRooms: number;
  maxDocuments: number;
  maxDocumentsPerRoom: number;
  storageLimitBytes: number;
  maxFileSizeBytes: number;
  analyticsRetentionDays: number;
  aiCreditsPerDay: number;
  plannedTeamMembers: number;
}

export interface TierFeature {
  key: FeatureKey;
  label: string;
  description: string;
  availability: FeatureAvailability;
  requiredTier: Tier;
  included: boolean;
}

export interface PricingTier {
  tier: Tier;
  label: string;
  rank: number;
  limits: TierLimits;
  prices: { monthly: number; yearly: number; currency: string };
  features: TierFeature[];
}

export interface PricingCatalog {
  tiers: PricingTier[];
}

export interface MyEntitlements {
  tier: Tier;
  label: string;
  limits: TierLimits;
  storageUsedBytes: number;
  features: FeatureKey[];
}

export type FeatureAccess = {
  state: "available" | "locked" | "coming_soon";
  feature: TierFeature | null;
};

const VALID_TIERS = new Set<Tier>(["FREE", "PRO", "PRO_PLUS", "RAISE"]);
const VALID_FEATURES = new Set<FeatureKey>([
  "unlimited_viewers",
  "link_analytics",
  "page_analytics",
  "visitor_signals",
  "access_controls",
  "deck_downloads",
  "custom_logo",
  "team_collaboration",
  "custom_colours",
  "analytics_export",
  "granular_downloads",
  "white_label_domain",
  "diligence_controls",
]);

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseLimits(value: unknown): TierLimits | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  return {
    maxDataRooms: asNumber(input.maxDataRooms),
    maxDocuments: asNumber(input.maxDocuments),
    maxDocumentsPerRoom: asNumber(input.maxDocumentsPerRoom),
    storageLimitBytes: asNumber(input.storageLimitBytes),
    maxFileSizeBytes: asNumber(input.maxFileSizeBytes),
    analyticsRetentionDays: asNumber(input.analyticsRetentionDays),
    aiCreditsPerDay: asNumber(input.aiCreditsPerDay),
    plannedTeamMembers: asNumber(input.plannedTeamMembers),
  };
}

function parseFeature(value: unknown): TierFeature | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.key !== "string" ||
    !VALID_FEATURES.has(input.key as FeatureKey) ||
    typeof input.label !== "string" ||
    typeof input.description !== "string" ||
    (input.availability !== "live" && input.availability !== "coming_soon") ||
    typeof input.requiredTier !== "string" ||
    !VALID_TIERS.has(input.requiredTier as Tier) ||
    typeof input.included !== "boolean"
  ) return null;

  return {
    key: input.key as FeatureKey,
    label: input.label,
    description: input.description,
    availability: input.availability,
    requiredTier: input.requiredTier as Tier,
    included: input.included,
  };
}

function parsePricingCatalog(value: unknown): PricingCatalog {
  const input = value as { tiers?: unknown } | null;
  if (!Array.isArray(input?.tiers)) throw new Error("Invalid pricing catalogue response.");

  const tiers = input.tiers.map((value): PricingTier | null => {
    if (!value || typeof value !== "object") return null;
    const tier = value as Record<string, unknown>;
    if (
      typeof tier.tier !== "string" ||
      !VALID_TIERS.has(tier.tier as Tier) ||
      typeof tier.label !== "string" ||
      !tier.prices ||
      typeof tier.prices !== "object"
    ) return null;
    const limits = parseLimits(tier.limits);
    if (!limits) return null;
    const prices = tier.prices as Record<string, unknown>;
    const features = Array.isArray(tier.features)
      ? tier.features.map(parseFeature).filter((feature): feature is TierFeature => feature !== null)
      : [];
    return {
      tier: tier.tier as Tier,
      label: tier.label,
      rank: asNumber(tier.rank),
      limits,
      prices: {
        monthly: asNumber(prices.monthly),
        yearly: asNumber(prices.yearly),
        currency: typeof prices.currency === "string" ? prices.currency : "USD",
      },
      features,
    };
  }).filter((tier): tier is PricingTier => tier !== null);

  if (tiers.length !== 4) throw new Error("Pricing catalogue is incomplete.");
  return { tiers: tiers.sort((a, b) => a.rank - b.rank) };
}

function parseEntitlements(value: unknown): MyEntitlements {
  if (!value || typeof value !== "object") throw new Error("Invalid entitlement response.");
  const input = value as Record<string, unknown>;
  const limits = parseLimits(input.limits);
  if (typeof input.tier !== "string" || !VALID_TIERS.has(input.tier as Tier) || !limits) {
    throw new Error("Entitlement response is incomplete.");
  }
  return {
    tier: input.tier as Tier,
    label: typeof input.label === "string" ? input.label : input.tier,
    limits,
    storageUsedBytes: asNumber(input.storageUsedBytes),
    features: Array.isArray(input.features)
      ? input.features.filter((feature): feature is FeatureKey => typeof feature === "string" && VALID_FEATURES.has(feature as FeatureKey))
      : [],
  };
}

export const tierEntitlementService = {
  async getPricingCatalog(): Promise<PricingCatalog> {
    const { data, error } = await supabase.rpc("get_pricing_catalog");
    if (error) throw error;
    return parsePricingCatalog(data);
  },

  async getMyEntitlements(): Promise<MyEntitlements> {
    const { data, error } = await supabase.rpc("get_my_entitlements");
    if (error) throw error;
    return parseEntitlements(data);
  },
};

export function getFeatureAccess(
  catalog: PricingCatalog | undefined,
  tier: Tier | undefined,
  featureKey: FeatureKey,
): FeatureAccess {
  const feature = catalog?.tiers
    .find((entry) => entry.tier === tier)
    ?.features.find((entry) => entry.key === featureKey) ?? null;

  if (!feature) return { state: "locked", feature: null };
  if (!feature.included) return { state: "locked", feature };
  return { state: feature.availability === "live" ? "available" : "coming_soon", feature };
}
