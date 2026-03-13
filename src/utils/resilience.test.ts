import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "./resilience";

// ─── withRetry ───────────────────────────────────────────────────────────────
describe("withRetry", () => {
  // Silence the console.warn that withRetry intentionally emits on retries
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("resolves immediately if the function succeeds on the first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on NetworkError and eventually succeeds", async () => {
    const networkError = new TypeError("NetworkError when attempting to fetch resource");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue("success");

    // Use zero delay to avoid needing fake timers for this success case
    const result = await withRetry(fn, { maxRetries: 3, initialDelay: 0, backoffFactor: 1 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws immediately on a non-network error without retrying", async () => {
    const appError = new Error("Permission denied");
    const fn = vi.fn().mockRejectedValue(appError);

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow("Permission denied");
    // Should only have been called once — no retry on non-network errors
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting all retries for a network error", async () => {
    const networkError = new TypeError("Failed to fetch");
    const fn = vi.fn().mockRejectedValue(networkError);

    await expect(
      withRetry(fn, { maxRetries: 2, initialDelay: 0, backoffFactor: 1 }),
    ).rejects.toThrow("Failed to fetch");
    // Initial attempt + 2 retries = 3 total calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respects the maxRetries option", async () => {
    const networkError = new TypeError("NetworkError");
    const fn = vi.fn().mockRejectedValue(networkError);

    await expect(
      withRetry(fn, { maxRetries: 1, initialDelay: 0, backoffFactor: 1 }),
    ).rejects.toThrow();
    // 1 initial + 1 retry = 2
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
