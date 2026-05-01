import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supabaseBin = process.platform === "win32" ? "npx.cmd" : "npx";
const args = process.argv.slice(2);
const mode = (args[0] ?? "remote").toLowerCase();

function getFlag(name) {
  const exact = args.findIndex((arg) => arg === name);
  if (exact !== -1) {
    return args[exact + 1] ?? "";
  }

  const prefixed = args.find((arg) => arg.startsWith(`${name}=`));
  if (prefixed) {
    return prefixed.slice(name.length + 1);
  }

  return "";
}

function runSupabase(supabaseArgs, options = {}) {
  const result = spawnSync(supabaseBin, ["supabase", ...supabaseArgs], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Supabase command failed: ${redactSupabaseArgs(supabaseArgs).join(" ")}`
    );
  }
}

function redactSupabaseArgs(values) {
  const redacted = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (value === "--password") {
      redacted.push("--password", "[REDACTED]");
      index += 1;
      continue;
    }

    if (value.startsWith("--password=")) {
      redacted.push("--password=[REDACTED]");
      continue;
    }

    redacted.push(value);
  }

  return redacted;
}

function sqlEscape(value) {
  return value.replaceAll("'", "''");
}

function writeTempSql(contents) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "deckly-supabase-"));
  const filePath = path.join(tempDir, "bootstrap.sql");
  writeFileSync(filePath, contents, "utf8");
  return { tempDir, filePath };
}

function cleanupTempSql(tempDir) {
  rmSync(tempDir, { recursive: true, force: true });
}

function verifyLinkedProject(linkedFlag) {
  runSupabase(["db", "query", linkedFlag, "--file", "supabase/bootstrap/verify.sql"]);
}

function bootstrapRemote() {
  const projectRef = getFlag("--project-ref") || process.env.SUPABASE_PROJECT_REF || "";
  const dbPassword = getFlag("--password") || process.env.SUPABASE_DB_PASSWORD || "";
  const adminEmail = getFlag("--admin-email") || process.env.SUPABASE_ADMIN_EMAIL || "";

  if (!projectRef) {
    throw new Error(
      "Missing Supabase project ref. Pass --project-ref or set SUPABASE_PROJECT_REF."
    );
  }

  const linkArgs = ["link", "--project-ref", projectRef, "--yes"];
  if (dbPassword) {
    linkArgs.push("--password", dbPassword);
  }

  runSupabase(linkArgs);
  runSupabase(["db", "push", "--linked", "--include-all", "--yes"]);
  runSupabase(["seed", "--linked", "--yes"]);

  if (adminEmail) {
    const { tempDir, filePath } = writeTempSql(`
INSERT INTO public.admin_emails (email, added_at)
VALUES ('${sqlEscape(adminEmail)}', NOW())
ON CONFLICT (email) DO NOTHING;
`);
    try {
      runSupabase(["db", "query", "--linked", "--file", filePath]);
    } finally {
      cleanupTempSql(tempDir);
    }
  }

  verifyLinkedProject("--linked");
}

function bootstrapLocal() {
  runSupabase(["start", "--yes"]);
  runSupabase(["db", "reset", "--yes"]);
  verifyLinkedProject("--local");
}

function main() {
  if (mode === "remote") {
    bootstrapRemote();
    return;
  }

  if (mode === "local") {
    bootstrapLocal();
    return;
  }

  throw new Error(
    `Unknown bootstrap mode "${mode}". Use "remote" or "local".`
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
