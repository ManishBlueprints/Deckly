/// <reference types="vitest/globals" />

import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  it("preserves order while enforcing the requested concurrency bound", async () => {
    let active = 0;
    let maximumActive = 0;
    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return value * 2;
    });

    expect(result).toEqual([2, 4, 6, 8, 10]);
    expect(maximumActive).toBeLessThanOrEqual(2);
  });
});
