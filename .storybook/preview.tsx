import type { Decorator, Preview } from "@storybook/react-vite";
import React from "react";
import "../src/index.css";
import { StoryThemeBoundary } from "./StoryThemeBoundary";

// Storybook decorators intentionally live beside the default preview export.
// eslint-disable-next-line react-refresh/only-export-components
const ThemeDecorator: Decorator = (Story, context) => {
  const theme = context.globals.theme === "dark" ? "dark" : "light";
  return <StoryThemeBoundary theme={theme}><Story /></StoryThemeBoundary>;
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
