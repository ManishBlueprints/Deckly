/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const initialSchemaSql = readFileSync(
  path.resolve(
    __dirname,
    "../../supabase/migrations/00000000000000_initial_schema.sql",
  ),
  "utf8",
);
const addDeckLinksMigrationSql = readFileSync(
  path.resolve(
    __dirname,
    "../../supabase/migrations/20260514120000_add_deck_links.sql",
  ),
  "utf8",
);
const compatibilityMigrationSql = readFileSync(
  path.resolve(
    __dirname,
    "../../supabase/migrations/20260514130000_sync_deck_public_compatibility.sql",
  ),
  "utf8",
);
const migrationSql = readFileSync(
  path.resolve(
    __dirname,
    "../../supabase/migrations/20260514140000_rewrite_public_deck_link_resolution.sql",
  ),
  "utf8",
);
const aliasOnlyMigrationSql = readFileSync(
  path.resolve(
    __dirname,
    "../../supabase/migrations/20260515140000_restore_alias_only_deck_links.sql",
  ),
  "utf8",
);
const passwordRateLimitMigrationSql = readFileSync(
  path.resolve(
    __dirname,
    "../../supabase/migrations/20260522100000_scope_deck_password_rate_limit_by_handle.sql",
  ),
  "utf8",
);
const deckAnalyticsOwnershipMigrationSql = readFileSync(
  path.resolve(
    __dirname,
    "../../supabase/migrations/20260531000000_harden_deck_analytics_ownership.sql",
  ),
  "utf8",
);
const libraryMetadataMigrationSql = readFileSync(
  path.resolve(
    __dirname,
    "../../supabase/migrations/20260518133000_add_library_deck_metadata_rpc.sql",
  ),
  "utf8",
);
const signDeckUrlSource = readFileSync(
  path.resolve(__dirname, "../../supabase/functions/sign-deck-url/index.ts"),
  "utf8",
);
const downloadControlsMigrationSql = readFileSync(
  path.resolve(
    __dirname,
    "../../supabase/migrations/20260714020000_add_deck_download_controls.sql",
  ),
  "utf8",
);
const effectivePublicDeckSql = [
  initialSchemaSql,
  addDeckLinksMigrationSql,
  compatibilityMigrationSql,
  migrationSql,
  aliasOnlyMigrationSql,
  passwordRateLimitMigrationSql,
].join("\n");

describe("public deck SQL alias-only contracts", () => {
  it("keeps bare-route compatibility scoped to enabled primary links only", () => {
    expect(aliasOnlyMigrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.get_decks_public(",
    );
    expect(aliasOnlyMigrationSql).toContain("p_handle IS NULL");
    expect(aliasOnlyMigrationSql).toContain("p_slug_or_alias = d.slug");
    expect(effectivePublicDeckSql).toContain("dl.is_primary = TRUE");
    expect(effectivePublicDeckSql).toContain("dl.is_enabled = TRUE");
  });

  it("resolves tokenless custom alias paths by handle plus link_alias", () => {
    expect(aliasOnlyMigrationSql).toContain("p_handle IS NOT NULL");
    expect(aliasOnlyMigrationSql).toContain("dl.link_alias = p_slug_or_alias");
    expect(aliasOnlyMigrationSql).not.toContain("p_link_token");
  });

  it("keeps owner canonical slug routes pinned to the primary link row", () => {
    expect(aliasOnlyMigrationSql).toContain("COALESCE(auth.uid()");
    expect(aliasOnlyMigrationSql).toContain(
      "(p_slug_or_alias = d.slug AND dl.is_primary = TRUE)",
    );
  });

  it("keeps compatibility wrappers while exposing alias-aware RPC overloads", () => {
    expect(aliasOnlyMigrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.get_decks_public()",
    );
    expect(aliasOnlyMigrationSql).toContain(
      "FROM public.get_decks_public(NULL, NULL);",
    );
    expect(aliasOnlyMigrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.check_deck_password(p_slug TEXT, p_password TEXT)",
    );
    expect(aliasOnlyMigrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.get_deck_payload(p_slug TEXT, p_password TEXT)",
    );
  });

  it("scopes password rate limits by handle plus slug-or-alias", () => {
    expect(passwordRateLimitMigrationSql).toContain("v_rate_limit_key TEXT := COALESCE(p_handle, '') || ':' || p_slug_or_alias;");
    expect(passwordRateLimitMigrationSql).toContain("public.check_rate_limit(v_ip, v_rate_limit_key)");
    expect(passwordRateLimitMigrationSql).toContain("public.clear_rate_limit(v_ip, v_rate_limit_key)");
    expect(passwordRateLimitMigrationSql).toContain("public.record_failed_attempt(v_ip, v_rate_limit_key)");
  });
});

describe("sign-deck-url revalidation contract", () => {
  it("revalidates with the same handle and slug-or-alias used for payload fetches", () => {
    expect(signDeckUrlSource).toContain("handle");
    expect(signDeckUrlSource).toContain(
      'p_handle: typeof handle === "string" ? handle : null',
    );
    expect(signDeckUrlSource).toContain(
      'const deckSlug = typeof slug === "string" ? slug : null;',
    );
    expect(signDeckUrlSource).toContain("p_slug_or_alias: deckSlug");
  });
});

describe("deck download controls contracts", () => {
  it("persists a disabled-by-default deck-level permission with paid-tier enforcement", () => {
    expect(downloadControlsMigrationSql).toContain("ADD COLUMN IF NOT EXISTS allow_download BOOLEAN NOT NULL DEFAULT FALSE");
    expect(downloadControlsMigrationSql).toContain("Download controls require a paid plan.");
    expect(downloadControlsMigrationSql).toContain("tr_disable_deck_downloads_on_free_downgrade");
    expect(downloadControlsMigrationSql).toContain("p_allow_download boolean DEFAULT false");
  });

  it("exposes the effective permission across direct decks and room payloads", () => {
    expect(downloadControlsMigrationSql).toContain("allow_download boolean");
    expect(downloadControlsMigrationSql).toContain("COALESCE(owner_profile.tier, 'FREE') IN ('PRO', 'PRO_PLUS', 'RAISE')");
    expect(downloadControlsMigrationSql).toContain("CREATE OR REPLACE FUNCTION public.get_data_room_payload");
  });

  it("requires an explicit server-authorized download intent", () => {
    expect(signDeckUrlSource).toContain('intent !== "download"');
    expect(signDeckUrlSource).toContain("Downloads are not permitted for this deck");
    expect(signDeckUrlSource).toContain("presignDownloadUrl");
    expect(signDeckUrlSource).toContain("deck_id: rawDeckId");
  });
});

describe("saved deck metadata contract", () => {
  it("exposes deck-id-based saved library hydration for owners and canonical public decks", () => {
    expect(libraryMetadataMigrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.get_library_deck_metadata(",
    );
    expect(libraryMetadataMigrationSql).toContain("p_deck_ids UUID[]");
    expect(libraryMetadataMigrationSql).toContain("COALESCE(auth.uid()");
    expect(libraryMetadataMigrationSql).toContain("dl.is_primary = TRUE");
    expect(libraryMetadataMigrationSql).toContain("dl.is_enabled = TRUE");
    expect(libraryMetadataMigrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_library_deck_metadata(UUID[]) TO authenticated;",
    );
  });
});

describe("password rate limit contract", () => {
  it("keeps deck password retries scoped by handle and slug-or-alias", () => {
    expect(passwordRateLimitMigrationSql).toContain(
      "v_rate_limit_key TEXT := COALESCE(p_handle, '') || ':' || p_slug_or_alias;",
    );
    expect(passwordRateLimitMigrationSql).toContain(
      "public.check_rate_limit(v_ip, v_rate_limit_key)",
    );
    expect(passwordRateLimitMigrationSql).toContain(
      "public.clear_rate_limit(v_ip, v_rate_limit_key)",
    );
    expect(passwordRateLimitMigrationSql).toContain(
      "public.record_failed_attempt(v_ip, v_rate_limit_key)",
    );
  });
});

describe("deck analytics ownership contract", () => {
  it("requires deck ownership for visitor count and location RPCs", () => {
    expect(deckAnalyticsOwnershipMigrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.count_unique_visitors",
    );
    expect(deckAnalyticsOwnershipMigrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.get_deck_locations",
    );
    expect(deckAnalyticsOwnershipMigrationSql).toContain(
      "IF auth.uid() IS NULL THEN",
    );
    expect(deckAnalyticsOwnershipMigrationSql).toContain(
      "AND d.user_id = auth.uid()",
    );
    expect(deckAnalyticsOwnershipMigrationSql).toContain("SECURITY DEFINER");
    expect(deckAnalyticsOwnershipMigrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.count_unique_visitors(UUID) TO authenticated;",
    );
    expect(deckAnalyticsOwnershipMigrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_deck_locations(UUID) TO authenticated;",
    );
  });
});
