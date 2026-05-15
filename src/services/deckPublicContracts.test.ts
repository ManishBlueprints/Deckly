/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const initialSchemaSql = readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/00000000000000_initial_schema.sql"),
  "utf8",
);
const addDeckLinksMigrationSql = readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20260514120000_add_deck_links.sql"),
  "utf8",
);
const compatibilityMigrationSql = readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20260514130000_sync_deck_public_compatibility.sql"),
  "utf8",
);
const migrationSql = readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20260514140000_rewrite_public_deck_link_resolution.sql"),
  "utf8",
);
const aliasOnlyMigrationSql = readFileSync(
  path.resolve(__dirname, "../../supabase/migrations/20260515140000_restore_alias_only_deck_links.sql"),
  "utf8",
);
const signDeckUrlSource = readFileSync(
  path.resolve(__dirname, "../../supabase/functions/sign-deck-url/index.ts"),
  "utf8",
);
const effectivePublicDeckSql = [
  initialSchemaSql,
  addDeckLinksMigrationSql,
  compatibilityMigrationSql,
  migrationSql,
  aliasOnlyMigrationSql,
].join("\n");

describe("public deck SQL alias-only contracts", () => {
  it("keeps bare-route compatibility scoped to enabled primary links only", () => {
    expect(aliasOnlyMigrationSql).toContain("CREATE OR REPLACE FUNCTION public.get_decks_public(");
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
    expect(aliasOnlyMigrationSql).toContain("(p_slug_or_alias = d.slug AND dl.is_primary = TRUE)");
  });

  it("keeps compatibility wrappers while exposing alias-aware RPC overloads", () => {
    expect(aliasOnlyMigrationSql).toContain("CREATE OR REPLACE FUNCTION public.get_decks_public()");
    expect(aliasOnlyMigrationSql).toContain("FROM public.get_decks_public(NULL, NULL);");
    expect(aliasOnlyMigrationSql).toContain("CREATE OR REPLACE FUNCTION public.check_deck_password(p_slug TEXT, p_password TEXT)");
    expect(aliasOnlyMigrationSql).toContain("CREATE OR REPLACE FUNCTION public.get_deck_payload(p_slug TEXT, p_password TEXT)");
  });
});

describe("sign-deck-url revalidation contract", () => {
  it("revalidates with the same handle and slug-or-alias used for payload fetches", () => {
    expect(signDeckUrlSource).toContain("handle");
    expect(signDeckUrlSource).toContain("p_handle: typeof handle === \"string\" ? handle : null");
    expect(signDeckUrlSource).toContain("const deckSlug = typeof slug === \"string\" ? slug : null;");
    expect(signDeckUrlSource).toContain("p_slug_or_alias: deckSlug");
  });
});
