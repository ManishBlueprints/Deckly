import { TIER_CONFIG, type Tier } from "../constants/tiers";

export const AI_SUMMARY_QUOTA_WINDOW_HOURS = 24;
const AI_SUMMARY_QUOTA_WINDOW_MS = AI_SUMMARY_QUOTA_WINDOW_HOURS * 60 * 60 * 1000;

export type AiSummaryQuotaScope = "signed_in" | "guest";

export type AiSummaryQuotaReason =
  | "allowed"
  | "cached_reopen"
  | "signed_in_limit_reached"
  | "guest_limit_reached";

export type AiSummaryQuotaNextAction = "none" | "auth" | "upgrade";

export interface AiSummaryQuotaDecision {
  scope: AiSummaryQuotaScope;
  allowed: boolean;
  chargeable: boolean;
  reason: AiSummaryQuotaReason;
  nextAction: AiSummaryQuotaNextAction;
  limitPer24Hours: number;
  usedInWindow: number;
  remaining: number;
  windowStart: string;
  windowEnd: string;
  tier?: Tier;
}

export interface AiSummaryQuotaInput {
  scope: AiSummaryQuotaScope;
  usageCount: number;
  cachedReopen?: boolean;
  now?: Date;
  tier?: Tier;
}

const buildQuotaWindow = (now: Date = new Date()) => {
  const windowEnd = now;
  const windowStart = new Date(windowEnd.getTime() - AI_SUMMARY_QUOTA_WINDOW_MS);

  return {
    windowStart,
    windowEnd,
  };
};

const getSignedInAiSummaryLimit = (tier: Tier): number =>
  TIER_CONFIG[tier].aiSummariesPerDay;

export const getAiSummaryQuotaLimit = (
  scope: AiSummaryQuotaScope,
  tier?: Tier,
): number => {
  if (scope === "guest") return 1;
  if (!tier) {
    throw new Error("A signed-in quota check requires a tier.");
  }

  return getSignedInAiSummaryLimit(tier);
};

export const evaluateAiSummaryQuota = ({
  scope,
  usageCount,
  cachedReopen = false,
  now = new Date(),
  tier,
}: AiSummaryQuotaInput): AiSummaryQuotaDecision => {
  const { windowStart, windowEnd } = buildQuotaWindow(now);

  if (cachedReopen) {
    const limitPer24Hours = getAiSummaryQuotaLimit(scope, tier);
    return {
      scope,
      allowed: true,
      chargeable: false,
      reason: "cached_reopen",
      nextAction: "none",
      limitPer24Hours,
      usedInWindow: usageCount,
      remaining: Math.max(limitPer24Hours - usageCount, 0),
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      tier,
    };
  }

  if (scope === "guest") {
    const limitPer24Hours = 1;
    const remaining = Math.max(limitPer24Hours - usageCount, 0);

    if (usageCount >= limitPer24Hours) {
      return {
        scope,
        allowed: false,
        chargeable: false,
        reason: "guest_limit_reached",
        nextAction: "auth",
        limitPer24Hours,
        usedInWindow: usageCount,
        remaining,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
      };
    }

    return {
      scope,
      allowed: true,
      chargeable: true,
      reason: "allowed",
      nextAction: "none",
      limitPer24Hours,
      usedInWindow: usageCount,
      remaining,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    };
  }

  if (!tier) {
    throw new Error("A signed-in quota check requires a tier.");
  }

  const limitPer24Hours = getSignedInAiSummaryLimit(tier);
  const remaining = Math.max(limitPer24Hours - usageCount, 0);

  if (usageCount >= limitPer24Hours) {
    return {
      scope,
      allowed: false,
      chargeable: false,
      reason: "signed_in_limit_reached",
      nextAction: tier === "PRO_PLUS" ? "none" : "upgrade",
      limitPer24Hours,
      usedInWindow: usageCount,
      remaining,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      tier,
    };
  }

  return {
    scope,
    allowed: true,
    chargeable: true,
    reason: "allowed",
    nextAction: "none",
    limitPer24Hours,
    usedInWindow: usageCount,
    remaining,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    tier,
  };
};

export const evaluateSignedInAiSummaryQuota = (
  tier: Tier,
  usageCount: number,
  options?: Omit<AiSummaryQuotaInput, "scope" | "usageCount" | "tier">,
): AiSummaryQuotaDecision =>
  evaluateAiSummaryQuota({
    scope: "signed_in",
    tier,
    usageCount,
    cachedReopen: options?.cachedReopen,
    now: options?.now,
  });

export const evaluateGuestAiSummaryQuota = (
  usageCount: number,
  options?: Omit<AiSummaryQuotaInput, "scope" | "usageCount">,
): AiSummaryQuotaDecision =>
  evaluateAiSummaryQuota({
    scope: "guest",
    usageCount,
    cachedReopen: options?.cachedReopen,
    now: options?.now,
  });
