import { checkA11y, injectAxe } from "axe-playwright";
import { expect, test } from "../support/networkSafeTest";

const stories = [
  "screens-workspace--saved-library-populated",
  "screens-workspace--saved-library-empty",
  "screens-workspace--saved-library-deleted-source",
  "screens-workspace--rooms-empty",
  "screens-workspace--rooms-populated",
  "screens-workspace--rooms-expired",
  "screens-workspace--rooms-plan-limit",
  "screens-workspace--content-empty",
  "screens-workspace--content-populated",
  "screens-workspace--overview-empty",
  "screens-workspace--overview-populated",
  "screens-workspace--profile-plan",
  "screens-overview-active-decks--populated",
  "screens-overview-active-decks--empty",
  "screens-overview-active-decks--loading",
  "patterns-overlays--dialog-open",
  "patterns-overlays--confirmation-open",
  "patterns-overlays--popover-open",
  "patterns-overlays--product-tour-open",
];

const storyA11yContexts: Partial<Record<(typeof stories)[number], string>> = {
  "patterns-overlays--product-tour-open": ".react-joyride__tooltip",
};

const interactionStories = [
  {
    name: "command-palette",
    story: "screens-workspace--content-populated",
    a11yContext: "[role='dialog']",
    open: async (page: import("@playwright/test").Page) => {
      await page.keyboard.press("Control+K");
      await expect(page.getByPlaceholder("Search commands…")).toBeVisible();
    },
  },
  {
    name: "workspace-menu",
    story: "screens-workspace--content-populated",
    a11yContext: "[role='menu']",
    open: async (page: import("@playwright/test").Page) => {
      if ((page.viewportSize()?.width ?? 0) < 768) {
        const mobileTrigger = page.getByRole("button", { name: "Open workspace and profile menu" });
        await expect(mobileTrigger).toBeVisible();
        await mobileTrigger.click();
      } else {
        const desktopTrigger = page.getByRole("button", { name: /Manish Kumar Founder plan/ });
        await expect(desktopTrigger).toBeVisible();
        await desktopTrigger.click();
      }
      await expect(page.getByRole("menuitem", { name: "Workspace settings" })).toBeVisible();
    },
  },
  {
    name: "notifications",
    story: "screens-workspace--content-populated",
    a11yContext: "[role='dialog']",
    open: async (page: import("@playwright/test").Page) => {
      await page.getByRole("button", { name: "Notifications" }).click();
      await expect(page.getByText("No notifications yet")).toBeVisible();
    },
  },
  {
    name: "content-links-expanded",
    story: "screens-workspace--content-populated",
    a11yContext: "[data-testid='deck-link-panel-deck-series-a']",
    open: async (page: import("@playwright/test").Page) => {
      await page.getByRole("button", { name: "Expand links for Series A Narrative" }).click();
      await expect(page.getByTestId("deck-link-panel-deck-series-a").locator(":visible").first()).toBeVisible();
    },
  },
] as const;

async function openStory(
  page: import("@playwright/test").Page,
  story: string,
  theme: "light" | "dark",
  viewport: { width: number; height: number },
) {
  await page.clock.setFixedTime(new Date("2026-08-20T10:00:00+05:30"));
  await page.setViewportSize(viewport);
  await page.goto(`/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`);
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content: "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }",
  });
  await injectAxe(page);
}

async function checkStoryA11y(page: import("@playwright/test").Page, context?: string) {
  const options = { detailedReport: true, detailedReportOptions: { html: true } } as const;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await checkA11y(page, context, options);
      return;
    } catch (error) {
      const axeIsBusy = error instanceof Error && error.message.includes("Axe is already running");
      if (!axeIsBusy || attempt === 4) {
        throw error;
      }

      await page.waitForTimeout(250);
    }
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const story of stories) {
    test(`${story} ${theme} desktop`, async ({ page }) => {
      await openStory(page, story, theme, { width: 1440, height: 1024 });
      await checkStoryA11y(page, storyA11yContexts[story]);
      await expect(page).toHaveScreenshot(`${story}-${theme}-desktop.png`, { fullPage: true });
    });

    test(`${story} ${theme} mobile`, async ({ page }) => {
      await openStory(page, story, theme, { width: 390, height: 844 });
      await checkStoryA11y(page, storyA11yContexts[story]);
      await expect(page).toHaveScreenshot(`${story}-${theme}-mobile.png`, { fullPage: true });
    });
  }

  for (const interaction of interactionStories) {
    test(`${interaction.name} ${theme} desktop`, async ({ page }) => {
      await openStory(page, interaction.story, theme, { width: 1440, height: 1024 });
      await interaction.open(page);
      await checkStoryA11y(page, interaction.a11yContext);
      await expect(page).toHaveScreenshot(`${interaction.name}-${theme}-desktop.png`, { fullPage: true });
    });

    test(`${interaction.name} ${theme} mobile`, async ({ page }) => {
      await openStory(page, interaction.story, theme, { width: 390, height: 844 });
      await interaction.open(page);
      await checkStoryA11y(page, interaction.a11yContext);
      await expect(page).toHaveScreenshot(`${interaction.name}-${theme}-mobile.png`, { fullPage: true });
    });
  }
}
