import { describe, expect, it } from "vitest";
import { getAccessibleColorSet } from "./accessibleColor";

function luminance(hex: string) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("getAccessibleColorSet", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const color of ["#ffffff", "#071e17", "#ff00aa", "#22cc66", "malformed"]) {
      it(`creates AA text colors for ${color} in ${theme}`, () => {
        const result = getAccessibleColorSet(color, theme);
        expect(contrast(result.background, result.foreground)).toBeGreaterThanOrEqual(4.5);
        expect(result.border).toMatch(/^#[0-9a-f]{6}$/i);
      });
    }
  }
});
