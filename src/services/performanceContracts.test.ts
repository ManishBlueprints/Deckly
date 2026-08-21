/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath: string) =>
  readFileSync(path.resolve(__dirname, "../..", relativePath), "utf8");

describe("performance architecture contracts", () => {
  it("keeps room list and reorder operations batched", () => {
    const page = read("src/pages/DataRoomsPage.tsx");
    const service = read("src/services/dataRoomService.ts");
    expect(page).toContain("getDocumentSearchSummariesForRooms");
    expect(service).toContain('rpc("reorder_data_room_documents"');
    expect(service).not.toContain("const updates = orderedDeckIds.map");
  });

  it("loads room and workspace analytics through aggregate RPCs", () => {
    const analytics = read("src/services/analyticsService.ts");
    const roomPage = read("src/pages/DataRoomDetail.tsx");
    expect(analytics).toContain('rpc("get_data_room_analytics_bundle"');
    expect(analytics).toContain('rpc("get_user_total_stats"');
    expect(analytics).toContain('rpc("get_user_daily_metrics"');
    expect(read("src/services/deckService.ts")).toContain('"get_deck_list_analytics"');
    expect(roomPage).toContain("getDataRoomAnalyticsBundle");
    expect(roomPage).not.toContain("getRoomVisitorSignals(roomId)");
  });

  it("bounds independent provider and object-storage work", () => {
    const r2 = read("supabase/functions/_shared/r2.ts");
    const billing = read("supabase/functions/reconcile-subscriptions/index.ts");
    const summaries = read("src/services/aiSummaryInitialOrchestrator.ts");
    expect(r2).toContain("mapWithConcurrency(keys, 8");
    expect(billing).toContain("mapWithConcurrency(subscriptions ?? [], 4");
    expect(summaries).toContain("mapWithConcurrency(");
  });

  it("defines indexes for analytics and worker queue access paths", () => {
    const baseline = read("supabase/migrations/00000000000000_initial_schema.sql");
    const entitlements = read(
      "supabase/migrations/20260716000000_unify_tier_entitlements.sql",
    );
    const processing = read("supabase/migrations/20260818000000_add_document_processing_jobs.sql");
    const hardening = read(
      "supabase/migrations/20260821000000_performance_and_lifecycle_hardening.sql",
    );

    expect(hardening).toContain("idx_page_views_deck_time");
    expect(hardening).toContain("idx_page_views_room_time");
    expect(hardening).toContain("document_processing_jobs_reconcile_idx");
    expect(hardening).toContain("document_processing_jobs_cleanup_idx");
    expect(hardening).toContain("reorder_data_room_documents");
    expect(hardening).toContain("get_data_room_analytics_bundle");
    expect(hardening).toContain("get_user_total_stats");
    expect(hardening).toContain("get_user_daily_metrics");
    expect(hardening).toContain("get_deck_list_analytics");

    // Deployed migrations are immutable; all hardening must remain forward-only.
    expect(baseline).not.toContain("idx_page_views_deck_time");
    expect(entitlements).not.toContain("get_data_room_analytics_bundle");
    expect(processing).not.toContain("document_processing_jobs_reconcile_idx");
  });
});
