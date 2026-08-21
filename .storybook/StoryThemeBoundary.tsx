import React, { useEffect, useMemo } from "react";
import {
  ThemeContextProvider,
  type ResolvedTheme,
  type ThemeContextValue,
} from "../src/contexts/ThemeContext";

export function StoryThemeBoundary({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: ResolvedTheme;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.themePreference = theme;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }, [theme]);

  const contextValue = useMemo<ThemeContextValue>(() => ({
    theme,
    preference: theme,
    // The Storybook toolbar owns the preview theme. Product controls cannot
    // mutate the global story selection from inside an isolated story.
    setTheme: (_nextTheme) => undefined,
    toggleTheme: () => undefined,
  }), [theme]);

  return (
    <ThemeContextProvider value={contextValue}>
      <div className="min-h-screen bg-ui-canvas font-sans text-ui-text">{children}</div>
    </ThemeContextProvider>
  );
}
