import type { Page } from "@playwright/test";

import { test, expect } from "../fixtures/app";

async function expectAuthScreenshot(page: Page, name: string) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(name, {
    fullPage: true,
  });
}

test("login visual baseline", async ({ page }) => {
  await page.goto("/login");
  await expectAuthScreenshot(page, "login.png");
});

test("login error visual baseline", async ({ page }) => {
  await page.goto("/login?error=Credenciales%20inv%C3%A1lidas");
  await expectAuthScreenshot(page, "login-error.png");
});

test("invalid invitation visual baseline", async ({ page }) => {
  await page.goto("/set-password");
  await expectAuthScreenshot(page, "set-password-invalid.png");
});
