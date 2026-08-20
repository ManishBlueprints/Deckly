import type { CSSProperties } from "react";

export interface AccessibleColorSet {
  background: string;
  foreground: string;
  border: string;
}

const FALLBACK = "#10834f";

function normalizeHex(input: string): string | null {
  const value = input.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(value);
  if (short) return `#${short[1].split("").map((part) => `${part}${part}`).join("")}`.toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

function channels(hex: string) {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
}

function luminance(hex: string) {
  const values = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function mix(hex: string, target: number, amount: number) {
  return `#${channels(hex).map((channel) => Math.round(channel + (target - channel) * amount).toString(16).padStart(2, "0")).join("")}`;
}

export function getAccessibleColorSet(input: string | null | undefined, theme: "light" | "dark"): AccessibleColorSet {
  const base = normalizeHex(input ?? "") ?? FALLBACK;
  const background = mix(base, theme === "light" ? 255 : 0, theme === "light" ? 0.86 : 0.66);
  const foreground = luminance(background) > 0.38 ? "#071e17" : "#ffffff";
  return {
    background,
    foreground,
    border: mix(base, theme === "light" ? 255 : 0, theme === "light" ? 0.52 : 0.28),
  };
}

export function asItemColorVariables(colors: AccessibleColorSet) {
  return {
    "--item-color": colors.background,
    "--item-color-foreground": colors.foreground,
    "--item-color-border": colors.border,
  } as CSSProperties;
}
