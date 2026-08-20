import posthog from "posthog-js";
import type { Tier } from "../constants/tiers";

export type AnalyticsSourceSurface =
  | "signup"
  | "content_library"
  | "document_editor"
  | "deck_viewer"
  | "room_manager"
  | "room_viewer"
  | "profile_pricing"
  | "upgrade_prompt"
  | "billing";

export type UpgradeSource =
  | "profile_direct"
  | "data_room_limit"
  | "document_analytics_gate"
  | "ai_summary_limit"
  | "document_format_gate"
  | "document_access_gate"
  | "download_controls_gate"
  | "watermark_gate"
  | "data_room_access_gate"
  | "unknown_feature_gate";

type CommonProperties = {
  workspace_id?: string;
  source_surface: AnalyticsSourceSurface;
  plan?: Tier;
  event_id?: string;
};

type DocumentProperties = CommonProperties & {
  deck_id?: string;
  file_type?: string;
  conversion_mode?: string;
  is_edit?: boolean;
  document_count_after?: number;
};

type LinkProperties = CommonProperties & {
  deck_id: string;
  link_id: string;
  link_count_after?: number;
  is_primary?: boolean;
};

type RoomProperties = CommonProperties & {
  room_id: string;
  deck_id?: string;
  document_count_after?: number;
};

type RevenueProperties = CommonProperties & {
  target_plan?: Exclude<Tier, "FREE">;
  billing_interval?: "monthly" | "yearly";
  checkout_id?: string;
  failure_code?: string;
  upgrade_source?: UpgradeSource;
  pricing_session_id?: string;
};

export type ProductAnalyticsEventMap = {
  user_signup_viewed: CommonProperties;
  user_signup_submitted: CommonProperties & { method: "email" | "google" | "github" };
  user_signup_completed: CommonProperties & { method: "email" | "google" | "github" };
  user_signup_failed: CommonProperties & { method: "email" | "google" | "github"; failure_code: string };
  deck_upload_initiated: DocumentProperties;
  deck_upload_queued: DocumentProperties & { deck_id: string; job_id: string };
  deck_upload_completed: DocumentProperties & { deck_id: string };
  deck_upload_failed: DocumentProperties & { failure_code: string };
  deck_updated: DocumentProperties & { deck_id: string };
  deck_deleted: DocumentProperties & { deck_id: string };
  deck_link_created: LinkProperties;
  deck_link_copied: LinkProperties;
  deck_link_enabled: LinkProperties;
  deck_link_disabled: LinkProperties;
  deck_link_deleted: LinkProperties;
  data_room_created: RoomProperties;
  data_room_updated: RoomProperties;
  data_room_published: RoomProperties;
  data_room_link_copied: RoomProperties;
  data_room_deleted: RoomProperties;
  data_room_document_added: RoomProperties;
  data_room_document_removed: RoomProperties;
  deck_viewed: CommonProperties & { deck_id: string; link_id?: string; room_id?: string };
  data_room_viewed: CommonProperties & { room_id: string };
  document_downloaded: CommonProperties & { deck_id: string; link_id?: string; room_id?: string };
  email_captured: CommonProperties & { deck_id?: string; room_id?: string };
  creator_first_external_view_received: CommonProperties & { deck_id: string; link_id?: string };
  upgrade_prompt_viewed: CommonProperties & { upgrade_source: UpgradeSource };
  pricing_viewed: RevenueProperties & { upgrade_source: UpgradeSource; pricing_session_id: string };
  pricing_engaged: RevenueProperties & {
    upgrade_source: UpgradeSource;
    pricing_session_id: string;
    engagement_seconds: 30 | 60;
  };
  upgrade_clicked: RevenueProperties & { target_plan: Exclude<Tier, "FREE"> };
  checkout_started: RevenueProperties & { target_plan: Exclude<Tier, "FREE">; checkout_id: string };
  checkout_completed: RevenueProperties & { target_plan: Exclude<Tier, "FREE">; checkout_id: string };
  checkout_abandoned: RevenueProperties & { target_plan: Exclude<Tier, "FREE">; checkout_id: string };
  checkout_failed: RevenueProperties & { target_plan: Exclude<Tier, "FREE">; failure_code: string };
  plan_changed: RevenueProperties & { target_plan: Exclude<Tier, "FREE"> };
  subscription_cancellation_requested: RevenueProperties;
  subscription_activated: RevenueProperties;
  payment_succeeded: RevenueProperties;
  payment_failed: RevenueProperties & { failure_code: string };
  subscription_cancelled: RevenueProperties;
  subscription_completed: RevenueProperties;
  subscription_expired: RevenueProperties;
};

export type ProductAnalyticsEventName = keyof ProductAnalyticsEventMap;

const SENSITIVE_PROPERTY_KEYS = new Set([
  "email",
  "viewer_email",
  "title",
  "name",
  "room_name",
  "link_name",
  "description",
  "error",
  "error_message",
  "raw_error",
]);

export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([key, value]) => !SENSITIVE_PROPERTY_KEYS.has(key) && value !== undefined)
      .map(([key, value]) => [key === "event_id" ? "$insert_id" : key, value]),
  );
}

export function analyticsFailureCode(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(code)) {
      return code.toLowerCase();
    }
  }
  return fallback;
}

export const productAnalytics = {
  capture<EventName extends ProductAnalyticsEventName>(
    event: EventName,
    properties: ProductAnalyticsEventMap[EventName],
  ): void {
    const safeProperties = sanitizeAnalyticsProperties(
      properties as Record<string, unknown>,
    );
    posthog.capture(event, safeProperties);
  },

  identifyWorkspace(userId: string, plan?: Tier): void {
    posthog.identify(userId, plan ? { plan } : undefined);
    posthog.group("workspace", userId, plan ? { plan } : undefined);
  },
};
