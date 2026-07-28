import { test, expect } from "../fixtures/app";

test("login visual baseline", async ({ page }) => {
  await page.goto("/login");
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("login.png", {
    fullPage: true,
  });
});
