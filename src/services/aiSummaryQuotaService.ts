import { supabase } from "./supabase.ts";
import { withRetry } from "../utils/resilience.ts";
import { AI_SUMMARY_QUOTA_WINDOW_HOURS } from "./aiSummaryQuotaPolicy.ts";

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

  return withRetry(async () => {
    const { count, error } = await supabase
      .from("ai_guest_usage")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ipAddress)
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

  const { error } = await supabase.from("ai_guest_usage").insert({
    ip_address: ipAddress,
    usage_date: consumedAtIso.slice(0, 10),
    scope_type: scopeType,
    scope_id: scopeId,
    content_hash: contentHash,
    model_identifier: modelIdentifier,
    model_version: modelVersion,
    usage_kind: "summary",
    consumed_at: consumedAtIso,
  });

  if (error) {
    throw error;
  }
};
