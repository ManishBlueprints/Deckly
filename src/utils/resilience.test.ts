/// <reference types="vitest/globals" />

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

  it("retries with exponential backoff and eventually succeeds", async () => {
    vi.useFakeTimers();
    const networkError = new TypeError("Failed to fetch");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue("success");

    const promise = withRetry(fn, { 
      maxRetries: 3, 
      initialDelay: 1000, 
      backoffFactor: 2 
    });

    // 1st attempt fails
    await vi.runAllTicks();
    expect(fn).toHaveBeenCalledTimes(1);

    // Wait for 1st retry (1000ms)
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // Wait for 2nd retry (2000ms)
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toBe("success");
  });

  it("throws immediately on a non-network error without retrying", async () => {
    const appError = new Error("Permission denied");
    const fn = vi.fn().mockRejectedValue(appError);

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow("Permission denied");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting all retries for a network error", async () => {
    vi.useFakeTimers();
    const networkError = new TypeError("Failed to fetch");
    const fn = vi.fn().mockRejectedValue(networkError);

    const promise = withRetry(fn, { maxRetries: 2, initialDelay: 500, backoffFactor: 2 });
    
    // Attach the rejection handler BEFORE running the timers that cause the rejection
    const rejectionExpectation = expect(promise).rejects.toThrow("Failed to fetch");

    // Now run the timers
    await vi.runAllTimersAsync();

    await rejectionExpectation;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("handles maxRetries: 0 by only attempting once", async () => {
    const networkError = new TypeError("NetworkError");
    const fn = vi.fn().mockRejectedValue(networkError);

    await expect(withRetry(fn, { maxRetries: 0 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
