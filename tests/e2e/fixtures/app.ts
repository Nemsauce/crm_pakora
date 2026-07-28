import { expect, test as base } from "@playwright/test";

import {
  PRODUCTION_APP_ORIGINS,
  PRODUCTION_PROJECT_REFS,
} from "../../../scripts/e2e/staging-guard.mjs";
import { enforceWebSocketHostIsolation } from "../helpers/staging-network";

export type AppTheme = "light" | "dark";

export const test = base.extend<{ themeName: AppTheme }>({
  themeName: async ({}, provide, testInfo) => {
    const configuredTheme = testInfo.project.metadata.theme;
    await provide(configuredTheme === "dark" ? "dark" : "light");
  },
  page: async ({ baseURL, page, themeName }, provide) => {
    if (!baseURL) {
      throw new Error("Public E2E requires an explicit local baseURL.");
    }

    const localOrigin = new URL(baseURL).origin;
    const localHost = new URL(baseURL).host;
    const allowedWebSocketHosts = new Set([localHost]);
    const blockedOrigins = new Set([
      ...PRODUCTION_APP_ORIGINS,
      ...PRODUCTION_PROJECT_REFS.map(
        (projectRef) => `https://${projectRef}.supabase.co`,
      ),
    ]);
    const unexpectedRequests: string[] = [];
    const blockedWebSockets: string[] = [];

    await page.route("**/*", async (route) => {
      const requestUrl = route.request().url();
      const requestOrigin = new URL(requestUrl).origin;

      if (requestOrigin !== localOrigin) {
        unexpectedRequests.push(requestUrl);
        await route.abort("blockedbyclient");
        return;
      }

      await route.continue();
    });
    await page.routeWebSocket("**/*", async (socket) => {
      const result = await enforceWebSocketHostIsolation(
        socket,
        allowedWebSocketHosts,
        "Public E2E origin isolation",
      );

      if (!result.allowed) {
        blockedWebSockets.push(result.url);
      }
    });
    await page.addInitScript((theme: AppTheme) => {
      window.localStorage.setItem("theme", theme);
    }, themeName);
    await provide(page);
    expect(
      unexpectedRequests,
      blockedOrigins.has(new URL(unexpectedRequests[0] ?? localOrigin).origin)
        ? "Public E2E attempted to contact a versioned production origin."
        : "Public E2E attempted to leave its isolated local origin.",
    ).toEqual([]);
    expect(
      blockedWebSockets,
      "Public E2E attempted a WebSocket outside its isolated local host; the connection was blocked before reaching a server.",
    ).toEqual([]);
  },
});

export { expect };
