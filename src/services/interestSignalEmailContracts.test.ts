/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const functionSource = readFileSync(
  path.resolve(
    __dirname,
    "../../supabase/functions/send-interest-signal-email/index.ts",
  ),
  "utf8",
);
const supabaseConfig = readFileSync(
  path.resolve(__dirname, "../../supabase/config.toml"),
  "utf8",
);

describe("interest-signal email webhook authentication", () => {
  it("requires a dedicated webhook secret instead of project API credentials", () => {
    expect(functionSource).toContain('Deno.env.get("EMAIL_WEBHOOK_SECRET")');
    expect(functionSource).toContain(
      "if (!supabaseUrl || !serviceRoleKey || !webhookSecret)",
    );
    expect(functionSource).toContain(
      "providedWebhookSecret !== webhookSecret",
    );
    expect(functionSource).not.toContain("serviceRoleKeys");
    expect(functionSource).not.toContain('request.headers.get("authorization")');
  });

  it("documents that JWT verification is replaced by dedicated webhook authentication", () => {
    expect(supabaseConfig).toContain(
      "verify_jwt = false  # Database Webhook is authenticated in-function with EMAIL_WEBHOOK_SECRET",
    );
  });
});
