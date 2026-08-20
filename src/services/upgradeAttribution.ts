import type { UpgradeSource } from "./productAnalytics";

const UPGRADE_SOURCES = new Set<UpgradeSource>([
  "profile_direct",
  "data_room_limit",
  "document_analytics_gate",
  "ai_summary_limit",
  "document_format_gate",
  "document_access_gate",
  "download_controls_gate",
  "watermark_gate",
  "data_room_access_gate",
  "unknown_feature_gate",
]);

export function parseUpgradeSource(value: string | null | undefined): UpgradeSource {
  return value && UPGRADE_SOURCES.has(value as UpgradeSource)
    ? (value as UpgradeSource)
    : "profile_direct";
}

export function buildUpgradeUrl(source: UpgradeSource): string {
  return `/profile?section=tier&upgrade_source=${encodeURIComponent(source)}`;
}

export function upgradeSourceForFeature(featureName: string): UpgradeSource {
  const normalized = featureName.toLowerCase();
  if (normalized.includes("watermark")) return "watermark_gate";
  if (normalized.includes("download")) return "download_controls_gate";
  if (normalized.includes("email capture") || normalized.includes("password") || normalized.includes("expiry")) {
    return "document_access_gate";
  }
  if (normalized.includes("support")) return "document_format_gate";
  return "unknown_feature_gate";
}
