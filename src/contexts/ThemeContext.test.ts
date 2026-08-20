// @vitest-environment jsdom

import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, readThemePreference, useTheme } from "./ThemeContext";

function Harness() {
  const { theme, toggleTheme } = useTheme();
  return createElement("button", { onClick: toggleTheme }, theme);
}

function SystemPreferenceHarness() {
  const { preference, setTheme } = useTheme();
  return createElement("button", { onClick: () => setTheme("system") }, preference);
}

function renderHarness() {
  return render(createElement(ThemeProvider, null, createElement(Harness)));
}

function mockSystemTheme(initialDark: boolean) {
  let isDark = initialDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    get matches() {
      return isDark;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

  return {
    setDark(nextDark: boolean) {
      isDark = nextDark;
      const event = { matches: nextDark, media: mediaQuery.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
    delete document.documentElement.dataset.theme;
    vi.unstubAllGlobals();
  });

  it("defaults missing storage to system and resolves the current OS theme", () => {
    mockSystemTheme(true);

    expect(readThemePreference()).toBe("system");
    renderHarness();

    expect(screen.queryByRole("button", { name: "dark" })).not.toBeNull();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("tracks OS theme changes while the preference is system", () => {
    const systemTheme = mockSystemTheme(false);
    renderHarness();

    expect(screen.queryByRole("button", { name: "light" })).not.toBeNull();
    act(() => systemTheme.setDark(true));
    expect(screen.queryByRole("button", { name: "dark" })).not.toBeNull();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("persists and applies theme changes", () => {
    mockSystemTheme(false);
    renderHarness();
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(screen.queryByRole("button", { name: "dark" })).not.toBeNull();
    expect(localStorage.getItem("deckly-theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("respects an existing saved preference", () => {
    mockSystemTheme(false);
    localStorage.setItem("deckly-theme", "dark");
    act(() => renderHarness());
    expect(screen.queryByRole("button", { name: "dark" })).not.toBeNull();
  });

  it("keeps an explicit preference when the OS theme changes", () => {
    const systemTheme = mockSystemTheme(false);
    localStorage.setItem("deckly-theme", "light");
    renderHarness();

    act(() => systemTheme.setDark(true));
    expect(screen.queryByRole("button", { name: "light" })).not.toBeNull();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("can return an explicit preference to system mode", () => {
    mockSystemTheme(true);
    localStorage.setItem("deckly-theme", "light");
    render(createElement(ThemeProvider, null, createElement(SystemPreferenceHarness)));

    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(screen.queryByRole("button", { name: "system" })).not.toBeNull();
    expect(localStorage.getItem("deckly-theme")).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themePreference).toBe("system");
  });
});
