/// <reference types="node" />
/// <reference types="vitest/globals" />

import fs from "node:fs";
import path from "node:path";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("AI SQL migration contracts", () => {
  it("invalidates legacy guest usage rows instead of backfilling a plain SHA-256 hash", () => {
    const migration = readSource(
      "supabase/migrations/20260523121500_harden_ai_guest_usage_privacy.sql",
    );

    expect(migration).not.toContain("encode(digest(host(ip_address), 'sha256'), 'hex')");
    expect(migration).toContain("SET ip_hash = gen_random_uuid()::text,");
    expect(migration).toContain("retention_expires_at = NOW()");
  });

  it("keeps ai chat session timestamps monotonic when older messages are inserted", () => {
    const migration = readSource(
      "supabase/migrations/20260523113000_add_append_ai_chat_message_rpc.sql",
    );

    expect(migration).toContain(
      "SET last_message_at = GREATEST(COALESCE(last_message_at, v_inserted.created_at), v_inserted.created_at),",
    );
    expect(migration).toContain(
      "updated_at = GREATEST(COALESCE(updated_at, v_inserted.created_at), v_inserted.created_at)",
    );
  });
});
