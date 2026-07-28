import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { expect, test as setup } from "@playwright/test";

const authStatePath = "playwright/.auth/admin.json";

function assertStagingIdentity() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const expectedRef = process.env.E2E_EXPECTED_PROJECT_REF;
  const productionRef = process.env.E2E_PRODUCTION_PROJECT_REF;

  if (!supabaseUrl || !expectedRef || !productionRef) {
    throw new Error(
      "Authenticated E2E requires explicit staging and production project refs.",
    );
  }

  const hostname = new URL(supabaseUrl).hostname.toLowerCase();
  if (
    expectedRef === productionRef ||
    hostname !== `${expectedRef.toLowerCase()}.supabase.co` ||
    hostname === `${productionRef.toLowerCase()}.supabase.co`
  ) {
    throw new Error("Authenticated E2E refused a non-isolated Supabase target.");
  }
}

setup("persist staging authentication when credentials exist", async ({ page }) => {
  await mkdir(dirname(authStatePath), { recursive: true });

  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  if (!email || !password) {
    await page.context().storageState({ path: authStatePath });
    return;
  }

  assertStagingIdentity();
  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await page.context().storageState({ path: authStatePath });
});
