import type { Decorator, Preview } from "@storybook/react-vite";
import React, { useEffect } from "react";
import "../src/index.css";
import { ThemeProvider } from "../src/contexts/ThemeContext";

// Storybook decorators intentionally live beside the default preview export.
// eslint-disable-next-line react-refresh/only-export-components
const ThemeDecorator: Decorator = (Story, context) => {
  const theme = context.globals.theme === "dark" ? "dark" : "light";
  window.localStorage.setItem("deckly-theme", theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  return <ThemeProvider><div className="min-h-screen bg-ui-canvas font-sans text-ui-text"><Story /></div></ThemeProvider>;
};

const preview: Preview = {
  decorators: [ThemeDecorator],
  globalTypes: {
    theme: {
      description: "Deckly theme",
      defaultValue: "light",
      toolbar: { icon: "paintbrush", items: ["light", "dark"], dynamicTitle: true },
    },
  },
  parameters: {
    layout: "fullscreen",
    // Playwright owns deterministic axe runs for every visual story in CI.
    a11y: { test: "off" },
    viewport: {
      options: {
        desktop: { name: "Desktop", styles: { width: "1440px", height: "1024px" } },
        mobile: { name: "Mobile", styles: { width: "390px", height: "844px" } },
      },
    },
  },
};

export default preview;
