/// <reference types="vitest/globals" />

import { vi } from "vitest";

const mockGetSession = vi.fn(async () => ({ data: { session: null } }));

vi.mock("./supabase.ts", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
}));

describe("aiSummaryService", () => {
  beforeEach(() => {
    mockGetSession.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects empty extraction payloads instead of casting them", async () => {
    const env = import.meta as ImportMeta & {
      env: Record<string, unknown>;
    };
    env.env = {
      ...(env.env ?? {}),
      VITE_SUPABASE_URL: "http://localhost",
      VITE_SUPABASE_PUBLISHABLE_KEY: "anon-key",
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/extract-document-text")) {
        return {
          ok: true,
          status: 200,
          json: async () => null,
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    const { aiSummaryService } = await import("./aiSummaryService.ts");

    await expect(
      aiSummaryService.summarizeScope({
        scope_type: "deck",
        scope_id: "deck-1",
      }),
    ).rejects.toThrow("Expected AI extraction response body to be a JSON object");
  });
});
