import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/theme",
  use: {
    baseURL: "http://127.0.0.1:4174",
    reducedMotion: "reduce",
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174 --strictPort",
    port: 4174,
    reuseExistingServer: !process.env.CI,
    gracefulShutdown: { signal: "SIGINT", timeout: 5_000 },
  },
});
