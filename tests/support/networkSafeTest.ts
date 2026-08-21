import { expect, test as base } from "@playwright/test";

type NetworkSafetyFixture = {
  networkSafety: void;
};

/**
 * Playwright tests fail closed: every page in the test context may contact only
 * the configured local base URL. Service workers are disabled in the configs so
 * they cannot bypass this context-level route.
 */
export const test = base.extend<NetworkSafetyFixture>({
  networkSafety: [async ({ baseURL, context }, use) => {
    if (!baseURL) {
      throw new Error("Network-safe Playwright tests require a configured baseURL");
    }

    const allowedOrigin = new URL(baseURL).origin;
    await context.route(
      (url) => ["http:", "https:"].includes(url.protocol) && url.origin !== allowedOrigin,
      (route) => route.abort("blockedbyclient"),
    );

    try {
      await use();
    } finally {
      await context.unrouteAll({ behavior: "ignoreErrors" });
    }
  }, { auto: true }],
});

export { expect };
