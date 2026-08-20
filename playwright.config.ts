import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  snapshotDir: "./tests/visual/__snapshots__",
  snapshotPathTemplate: "{snapshotDir}/{testFilePath}-snapshots/{arg}{ext}",
  use: { baseURL: "http://127.0.0.1:6006", colorScheme: "light", reducedMotion: "reduce" },
  webServer: { command: "npm run storybook:preview", port: 6006, reuseExistingServer: !process.env.CI },
  expect: { toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.01 } },
});
