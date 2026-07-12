import { describe, expect, it } from "vitest";
import { resolvePostHogConfig } from "./posthogConfig";

describe("PostHog environment configuration", () => {
  it("prefers the current public variable names", () => {
    expect(
      resolvePostHogConfig({
        VITE_PUBLIC_POSTHOG_KEY: "public-key",
        VITE_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
        VITE_POSTHOG_KEY: "legacy-key",
        VITE_POSTHOG_HOST: "https://legacy.posthog.com",
      }),
    ).toEqual({
      apiKey: "public-key",
      apiHost: "https://us.i.posthog.com",
    });
  });

  it("supports existing deployments that still use legacy variable names", () => {
    expect(
      resolvePostHogConfig({
        VITE_POSTHOG_KEY: "legacy-key",
        VITE_POSTHOG_HOST: "https://legacy.posthog.com",
      }),
    ).toEqual({
      apiKey: "legacy-key",
      apiHost: "https://legacy.posthog.com",
    });
  });
});
