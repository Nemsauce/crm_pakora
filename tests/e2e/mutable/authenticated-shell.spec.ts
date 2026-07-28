import { expect, test } from "../fixtures/staging";

test("staging authentication reaches a protected CRM route", async ({ page }) => {
  await page.goto("/pedidos");

  await expect(page).toHaveURL((url) => url.pathname === "/pedidos");
  await expect(
    page.getByRole("navigation", { name: "Principal" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lista de pedidos" }),
  ).toBeVisible();
});
