/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath: string) =>
  readFileSync(path.resolve(__dirname, "../..", relativePath), "utf8");

describe("custom logo entitlement UX", () => {
  it("gates both logo upload surfaces before opening the file picker", () => {
    const profile = read("src/pages/Profile.tsx");
    const workspaceSettings = read("src/components/dashboard/MascotSettingsModal.tsx");

    for (const source of [profile, workspaceSettings]) {
      expect(source).toContain('useTierFeatureAccess');
      expect(source).toContain('"custom_logo"');
      expect(source).toContain("Upgrade to Founder");
      expect(source).toContain("buildUpgradeUrl");
      expect(source).toContain("fileInputRef.current?.click()");
    }
  });
});
