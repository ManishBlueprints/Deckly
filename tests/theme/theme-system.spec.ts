import { expect, test } from "@playwright/test";

test("uses and follows the system theme when no preference is stored", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();

  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");

  await context.close();
});

test("keeps an explicit app preference when it differs from the system", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  await context.addInitScript(() => localStorage.setItem("deckly-theme", "light"));
  const page = await context.newPage();

  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");

  await context.close();
});
