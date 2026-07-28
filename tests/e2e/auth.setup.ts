import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { expect, test as setup } from "@playwright/test";

import { assertSafeStagingEnvironment } from "../../scripts/e2e/staging-guard.mjs";
import { installStagingBrowserOriginGuard } from "./helpers/staging-network";

const authStatePath = "playwright/.auth/admin.json";

setup("authenticate the isolated staging administrator", async ({ page }) => {
  await mkdir(dirname(authStatePath), { recursive: true });

  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Authenticated E2E requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for staging.",
    );
  }

  const config = assertSafeStagingEnvironment(process.env);
  const assertOriginIsolation = await installStagingBrowserOriginGuard(
    page,
    config,
  );
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(
    (url) => url.origin === config.appOrigin && url.pathname === "/pedidos",
  );
  await expect(
    page.getByRole("navigation", { name: "Principal" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lista de pedidos" }),
  ).toBeVisible();
  assertOriginIsolation();
  await page.context().storageState({ path: authStatePath });
});
