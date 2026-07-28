import { test, expect } from "../fixtures/app";
import { expectNoSeriousAccessibilityViolations } from "../helpers/a11y";

test("@a11y login exposes its current public contract", async ({
  page,
  themeName,
}) => {
  await page.goto("/login");

  await expect(page.getByText("CRM Pakora", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Correo")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();

  const root = page.locator("html");
  if (themeName === "dark") {
    await expect(root).toHaveClass(/dark/);
  } else {
    await expect(root).not.toHaveClass(/dark/);
  }

  await expectNoSeriousAccessibilityViolations(page, `login ${themeName}`);
});

test("theme selection persists across reloads", async ({ page, themeName }) => {
  await page.goto("/login");
  await page.reload();

  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("theme")))
    .toBe(themeName);
});

test("public auth shell has no horizontal overflow", async ({ page }) => {
  await page.goto("/login");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
