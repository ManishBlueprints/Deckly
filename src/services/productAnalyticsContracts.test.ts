import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const uploadWorkflow = readFileSync(
  path.join(repoRoot, "src/hooks/useManageDeckWorkflow.ts"),
  "utf8",
);
const asyncReconciler = readFileSync(
  path.join(repoRoot, "supabase/functions/reconcile-document-processing/index.ts"),
  "utf8",
);
const serverCapture = readFileSync(
  path.join(repoRoot, "supabase/functions/_shared/posthog.ts"),
  "utf8",
);
const billingWebhook = readFileSync(
  path.join(repoRoot, "supabase/functions/razorpay-webhook/index.ts"),
  "utf8",
);

describe("product analytics integration contracts", () => {
  it("captures synchronous upload completion before navigation", () => {
    const uploadCaptureIndex = uploadWorkflow.indexOf('productAnalytics.capture("deck_upload_completed"');
    const returnToRoomNavigationIndex = uploadWorkflow.lastIndexOf("navigate(returnToRoom");

    expect(uploadCaptureIndex).toBeGreaterThanOrEqual(0);
    expect(returnToRoomNavigationIndex).toBeGreaterThanOrEqual(0);
    expect(uploadCaptureIndex).toBeLessThan(returnToRoomNavigationIndex);
  });

  it("captures asynchronous upload completion at authoritative publication", () => {
    expect(asyncReconciler).toContain('capturePostHogEvent("deck_upload_completed"');
    expect(asyncReconciler).toContain('`upload-job:${claimed.id}:completed`');
    expect(asyncReconciler).toContain('capturePostHogEvent("deck_link_created"');
  });

  it("keeps server analytics optional and idempotent", () => {
    expect(serverCapture).toContain('Deno.env.get("POSTHOG_PROJECT_API_KEY")');
    expect(serverCapture).toContain("if (!apiKey) return;");
    expect(serverCapture).toContain("distinct_id: distinctId");
  });

  it("emits authoritative and deduplicated billing lifecycle events", () => {
    expect(billingWebhook).toContain('"subscription.charged": "payment_succeeded"');
    expect(billingWebhook).toContain('"subscription.cancelled": "subscription_cancelled"');
    expect(billingWebhook).toContain('`razorpay:${eventId}:${postHogEvent}`');
    expect(billingWebhook).toContain('console.error("Billing analytics delivery failed"');
  });
});
