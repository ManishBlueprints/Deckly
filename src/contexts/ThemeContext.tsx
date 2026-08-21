/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ResolvedTheme = "light" | "dark";
export type ThemePreference = ResolvedTheme | "system";

export interface ThemeContextValue {
  theme: ResolvedTheme;
  preference: ThemePreference;
  setTheme(theme: ThemePreference): void;
  toggleTheme(): void;
}

const STORAGE_KEY = "deckly-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeContextProvider({
  value,
  children,
}: {
  value: ThemeContextValue;
  children: React.ReactNode;
}) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" || stored === "system"
      ? stored
      : "system";
  } catch {
    return "system";
  }
}

function readSystemTheme(): ResolvedTheme {
  if (typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

function applyTheme(theme: ResolvedTheme, preference: ThemePreference) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  const canvasColor = getComputedStyle(root).getPropertyValue("--ui-canvas").trim();
  if (canvasColor) {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", `rgb(${canvasColor})`);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readSystemTheme);
  const theme = resolveTheme(preference, systemTheme);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => applyTheme(theme, preference), [preference, theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next);
    const nextResolvedTheme = resolveTheme(next, readSystemTheme());
    applyTheme(nextResolvedTheme, next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A restricted browser can still use the in-memory preference.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, preference, setTheme, toggleTheme }),
    [preference, setTheme, theme, toggleTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
