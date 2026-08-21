import { describe, expect, it } from "vitest";
import {
  fitAspectRatioWithinBounds,
  getAspectRatio,
} from "./viewerDimensions";

describe("viewer dimensions", () => {
  it.each([
    [16 / 9, 1280, 720],
    [3, 1280, 720],
    [4 / 3, 1280, 720],
    [210 / 297, 1280, 720],
    [8.5 / 11, 390, 720],
    [11 / 8.5, 720, 390],
  ])(
    "contains a %s page inside a %sx%s viewport without changing its ratio",
    (aspectRatio, containerWidth, containerHeight) => {
      const dimensions = fitAspectRatioWithinBounds(
        containerWidth,
        containerHeight,
        aspectRatio,
      );

      expect(dimensions.width).toBeLessThanOrEqual(containerWidth);
      expect(dimensions.height).toBeLessThanOrEqual(containerHeight);
      expect(dimensions.width / dimensions.height).toBeCloseTo(aspectRatio);
    },
  );

  it("accepts only positive source dimensions", () => {
    expect(getAspectRatio(1600, 900)).toBeCloseTo(16 / 9);
    expect(getAspectRatio(0, 900)).toBeNull();
    expect(getAspectRatio(1600, null)).toBeNull();
  });

  it("returns an empty frame for invalid input", () => {
    expect(fitAspectRatioWithinBounds(0, 720, 16 / 9)).toEqual({
      width: 0,
      height: 0,
    });
  });
});
