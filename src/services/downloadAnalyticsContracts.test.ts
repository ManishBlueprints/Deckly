/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationSql = readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20260715000000_add_download_analytics.sql"),
  "utf8",
);
const entitlementMigrationSql = readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20260716000000_unify_tier_entitlements.sql"),
  "utf8",
);
const signingSource = readFileSync(
  path.resolve(__dirname, "../../supabase/functions/sign-deck-url/index.ts"),
  "utf8",
);
const deleteAccountSource = readFileSync(
  path.resolve(__dirname, "../../supabase/functions/delete-account/index.ts"),
  "utf8",
);
describe("download analytics contracts", () => {
  it("records source-attributed, idempotent download events through a service-only function", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.deck_download_events");
    expect(migrationSql).toContain("request_id UUID NOT NULL UNIQUE");
    expect(migrationSql).toContain("source_type IN ('deck_link', 'data_room')");
    expect(migrationSql).toContain("ON CONFLICT (request_id) DO NOTHING");
    expect(migrationSql).toContain("GRANT EXECUTE ON FUNCTION public.record_deck_download");
    expect(migrationSql).toContain("TO service_role");
  });

  it("preserves direct-link context and excludes room downloads from it", () => {
    expect(migrationSql).toContain("deck_link_name_snapshot");
    expect(migrationSql).toContain("source_type = 'deck_link'");
    expect(migrationSql).toContain("source_type = 'data_room'");
    expect(migrationSql).toContain("get_deck_download_analytics");
    expect(migrationSql).toContain("get_data_room_download_analytics");
  });

  it("preserves history and names after deck or room deletion", () => {
    expect(migrationSql).toContain("deck_id UUID NOT NULL,");
    expect(migrationSql).toContain("owner_user_id UUID NOT NULL,");
    expect(migrationSql).toContain("data_room_id UUID,");
    expect(migrationSql).not.toContain("deck_id UUID NOT NULL REFERENCES public.decks");
    expect(migrationSql).not.toContain("owner_user_id UUID NOT NULL REFERENCES auth.users");
    expect(migrationSql).not.toContain("data_room_id UUID REFERENCES public.data_rooms");
    expect(migrationSql).toContain("deck_title_snapshot TEXT");
    expect(migrationSql).toContain("data_room_name_snapshot TEXT");
    expect(migrationSql).toContain("v_deck.title");
    expect(migrationSql).toContain("v_data_room_name");
    expect(migrationSql).toContain("array_agg(e.data_room_name_snapshot ORDER BY e.downloaded_at DESC)");
    expect(migrationSql).toContain("array_agg(e.deck_title_snapshot ORDER BY e.downloaded_at DESC)");
    expect(migrationSql).toContain("GROUP BY e.data_room_id");
    expect(migrationSql).toContain("GROUP BY COALESCE(rd.deck_id, e.deck_id)");
  });

  it("includes current room documents with zero downloads and preserves historical downloader files", () => {
    expect(migrationSql).toContain("room_documents AS");
    expect(migrationSql).toContain("FULL OUTER JOIN events e ON e.deck_id = rd.deck_id");
    expect(migrationSql).toContain("downloaded_documents");
  });

  it("defines the paginated data-room analytics RPC and refreshes the API schema cache", () => {
    expect(migrationSql).toContain(
      "DROP FUNCTION IF EXISTS public.get_data_room_download_analytics(UUID, INTEGER)",
    );
    expect(migrationSql).toContain(
      "get_data_room_download_analytics(UUID, INTEGER, INTEGER)",
    );
    expect(migrationSql).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it("records analytics only after generating an authorized download URL", () => {
    expect(signingSource).toContain("const downloadUrl = await presignDownloadUrl");
    expect(signingSource).toContain('admin.rpc("record_deck_download"');
    expect(signingSource).toContain("p_actor_user_id: authenticatedUser?.id ?? null");
    expect(signingSource).toContain("request_id: rawRequestId");
    expect(signingSource).toContain("visitor_id: rawVisitorId");
  });

  it("keeps owner IDs out of public payloads and bounds downloader results", () => {
    expect(migrationSql).toContain("p_actor_user_id UUID DEFAULT NULL");
    expect(migrationSql).toContain("IF p_actor_user_id IS NOT NULL AND p_actor_user_id = v_deck.user_id THEN");
    expect(migrationSql).toContain("p_limit INTEGER DEFAULT 100");
    expect(migrationSql).toContain("LIMIT v_limit");
    expect(migrationSql).toContain("p_offset INTEGER DEFAULT 0");
    expect(migrationSql).toContain("OFFSET v_offset");
    expect(migrationSql).toContain("idx_deck_download_events_room_visitor");
    expect(migrationSql).not.toContain("'id', d.id, 'user_id', d.user_id, 'data_room_id'");
    expect(signingSource).toContain("p_actor_user_id: authenticatedUser?.id ?? null");
  });

  it("erases account analytics and purges events beyond tier retention", () => {
    expect(migrationSql).toContain("erase_deck_download_events_for_account");
    expect(migrationSql).toContain("viewer_email = NULL");
    expect(migrationSql).toContain("extensions.digest");
    expect(migrationSql).not.toContain("DELETE FROM public.deck_download_events WHERE owner_user_id");
    expect(entitlementMigrationSql).toContain("purge_expired_deck_download_events");
    expect(entitlementMigrationSql).toContain("limits.analytics_retention_days");
    expect(entitlementMigrationSql).toContain("purge-deck-download-events");
    expect(deleteAccountSource).toContain('rpc("erase_deck_download_events_for_account"');
  });
});
