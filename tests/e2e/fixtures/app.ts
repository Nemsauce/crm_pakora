import { expect, test as base } from "@playwright/test";

export type AppTheme = "light" | "dark";

export const test = base.extend<{ themeName: AppTheme }>({
  themeName: async ({}, provide, testInfo) => {
    const configuredTheme = testInfo.project.metadata.theme;
    await provide(configuredTheme === "dark" ? "dark" : "light");
  },
  page: async ({ page, themeName }, provide) => {
    await page.addInitScript((theme: AppTheme) => {
      window.localStorage.setItem("theme", theme);
    }, themeName);
    await provide(page);
  },
});

export { expect };
