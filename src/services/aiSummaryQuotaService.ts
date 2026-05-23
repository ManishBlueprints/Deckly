import { supabase } from "./supabase.ts";
import { withRetry } from "../utils/resilience.ts";
import { AI_SUMMARY_QUOTA_WINDOW_HOURS } from "./aiSummaryQuotaPolicy.ts";
import { deriveGuestQuotaKey } from "./aiGuestUsageIdentity.ts";

export {
  AI_SUMMARY_QUOTA_WINDOW_HOURS,
  evaluateAiSummaryQuota,
  evaluateGuestAiSummaryQuota,
  evaluateSignedInAiSummaryQuota,
  getAiSummaryQuotaLimit,
} from "./aiSummaryQuotaPolicy.ts";
export type {
  AiSummaryQuotaDecision,
  AiSummaryQuotaInput,
  AiSummaryQuotaNextAction,
  AiSummaryQuotaReason,
  AiSummaryQuotaScope,
} from "./aiSummaryQuotaPolicy.ts";

export interface AiGuestUsageRecordInput {
  ipAddress: string;
  scopeType: "deck" | "folder" | "data_room";
  scopeId: string;
  contentHash: string;
  modelIdentifier: string;
  modelVersion: string;
  consumedAt?: Date;
}

const AI_SUMMARY_QUOTA_WINDOW_MS = AI_SUMMARY_QUOTA_WINDOW_HOURS * 60 * 60 * 1000;
const AI_GUEST_USAGE_RETENTION_DAYS = 90;

const getGuestQuotaSecret = (): string => {
  const secret = process.env.PROJECT_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || "";

  if (!secret) {
    throw new Error("Missing guest quota secret.");
  }

  return secret;
};

const buildQuotaWindow = (now: Date = new Date()) => {
  const windowEnd = now;
  const windowStart = new Date(windowEnd.getTime() - AI_SUMMARY_QUOTA_WINDOW_MS);

  return {
    windowStart,
    windowEnd,
  };
};

export const getGuestAiSummaryUsageCount = async (
  ipAddress: string,
  now: Date = new Date(),
): Promise<number> => {
  const { windowStart } = buildQuotaWindow(now);
  const guestKey = await deriveGuestQuotaKey(ipAddress, getGuestQuotaSecret());

  return withRetry(async () => {
    const { count, error } = await supabase
      .from("ai_guest_usage")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", guestKey)
      .gte("consumed_at", windowStart.toISOString())
      .lte("consumed_at", now.toISOString());

    if (error) {
      throw error;
    }

    return count ?? 0;
  });
};

export const recordGuestAiSummaryUsage = async ({
  ipAddress,
  scopeType,
  scopeId,
  contentHash,
  modelIdentifier,
  modelVersion,
  consumedAt = new Date(),
}: AiGuestUsageRecordInput): Promise<void> => {
  const consumedAtIso = consumedAt.toISOString();
  const retentionExpiresAt = new Date(
    consumedAt.getTime() + AI_GUEST_USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const guestKey = await deriveGuestQuotaKey(ipAddress, getGuestQuotaSecret());

  const { error } = await supabase.from("ai_guest_usage").insert({
    ip_hash: guestKey,
    usage_date: consumedAtIso.slice(0, 10),
    scope_type: scopeType,
    scope_id: scopeId,
    content_hash: contentHash,
    model_identifier: modelIdentifier,
    model_version: modelVersion,
    usage_kind: "summary",
    consumed_at: consumedAtIso,
    retention_expires_at: retentionExpiresAt,
  });

  if (error) {
    throw error;
  }
};
