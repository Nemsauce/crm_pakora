import type { Page } from "@playwright/test";

import { test, expect, type AppTheme } from "../fixtures/app";
import {
  expectNoSeriousAccessibilityViolations,
  getSeriousAccessibilityViolations,
} from "../helpers/a11y";

async function expectProjectTheme(page: Page, themeName: AppTheme) {
  const root = page.locator("html");

  if (themeName === "dark") {
    await expect(root).toHaveClass(/dark/);
  } else {
    await expect(root).not.toHaveClass(/dark/);
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

test("@a11y login exposes its current public contract", async ({
  page,
  themeName,
}) => {
  await page.goto("/login");

  await expect(page.getByText("CRM Pakora", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Correo")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(page.getByRole("link", { name: /registr/i })).toHaveCount(0);

  await expectProjectTheme(page, themeName);

  await expectNoSeriousAccessibilityViolations(page, `login ${themeName}`);
});

test("@a11y login renders a query error without changing its flow", async ({
  page,
  themeName,
}) => {
  await page.goto("/login?error=Credenciales%20inv%C3%A1lidas");

  await expect(page.getByText("Credenciales inválidas")).toBeVisible();
  await expect(page.getByLabel("Correo")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expectProjectTheme(page, themeName);
  await expectNoHorizontalOverflow(page);

  if (themeName === "light") {
    const violations = await getSeriousAccessibilityViolations(page);
    expect(
      violations.map(({ id }) => id),
      "G3 must remove the known light-theme login error contrast debt.",
    ).toEqual(["color-contrast"]);
    expect(violations[0]?.nodes).toHaveLength(1);
    expect(violations[0]?.nodes[0]?.target).toEqual(["p"]);
  } else {
    await expectNoSeriousAccessibilityViolations(
      page,
      `login error ${themeName}`,
    );
  }
});

test("@a11y set-password rejects an invitation without a session", async ({
  page,
  themeName,
}) => {
  await page.goto("/set-password");

  await expect(page.getByText("Enlace no válido", { exact: true })).toBeVisible();
  await expect(
    page.getByText("El enlace de invitación es inválido o ya expiró."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir al login" })).toHaveAttribute(
    "href",
    "/login",
  );
  await expectProjectTheme(page, themeName);
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAccessibilityViolations(
    page,
    `set-password invalid invitation ${themeName}`,
  );
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
  await expectNoHorizontalOverflow(page);
});

test("login keyboard order follows email, password and submit", async ({
  page,
}) => {
  await page.goto("/login");

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Correo")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Contraseña")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeFocused();
});

test("reduced-motion project exposes the requested media preference", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "reduced-motion");
  await page.goto("/login");

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    )
    .toBe(true);
});
