/// <reference types="vitest/globals" />

import { vi } from "vitest";

const invoke = vi.fn();

vi.mock("./supabase", () => ({
  supabase: { functions: { invoke } },
}));

describe("documentProcessingService", () => {
  beforeEach(() => invoke.mockReset());

  it("surfaces the function response message for HTTP errors", async () => {
    const transportError = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify({ error: "The document is too large." }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      }),
    });
    invoke.mockResolvedValue({ data: null, error: transportError });
    const { documentProcessingService } = await import("./documentProcessingService");

    await expect(documentProcessingService.completeUpload("job-1"))
      .rejects.toThrow("The document is too large.");
  });

  it("preserves transport errors when the response has no application message", async () => {
    const transportError = Object.assign(new Error("Network unavailable"), {
      context: new Response("not json", { status: 503 }),
    });
    invoke.mockResolvedValue({ data: null, error: transportError });
    const { documentProcessingService } = await import("./documentProcessingService");

    await expect(documentProcessingService.completeUpload("job-1"))
      .rejects.toBe(transportError);
  });
});
