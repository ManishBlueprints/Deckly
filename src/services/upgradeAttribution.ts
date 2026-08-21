import { isUpgradeSource, type UpgradeSource } from "./productAnalytics";

export function parseUpgradeSource(value: string | null | undefined): UpgradeSource {
  return isUpgradeSource(value) ? value : "profile_direct";
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
