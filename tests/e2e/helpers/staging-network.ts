import { expect, type Page, type WebSocketRoute } from "@playwright/test";

import type { StagingGuardConfig } from "../../../scripts/e2e/staging-guard.mjs";

export async function enforceWebSocketHostIsolation(
  socket: WebSocketRoute,
  allowedHosts: ReadonlySet<string>,
  reason: string,
) {
  const socketUrl = socket.url();

  if (!allowedHosts.has(new URL(socketUrl).host)) {
    await socket.close({ code: 1008, reason });
    return { allowed: false as const, url: socketUrl };
  }

  socket.connectToServer();
  return { allowed: true as const, url: socketUrl };
}

export async function installStagingBrowserOriginGuard(
  page: Page,
  config: Pick<StagingGuardConfig, "appOrigin" | "supabaseUrl">,
) {
  const allowedOrigins = new Set([config.appOrigin, config.supabaseUrl]);
  const allowedHosts = new Set(
    [...allowedOrigins].map((origin) => new URL(origin).host),
  );
  const unexpectedRequests: string[] = [];
  const blockedWebSockets: string[] = [];

  await page.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    const requestOrigin = new URL(requestUrl).origin;

    if (!allowedOrigins.has(requestOrigin)) {
      unexpectedRequests.push(requestUrl);
      await route.abort("blockedbyclient");
      return;
    }

    await route.continue();
  });

  await page.routeWebSocket("**/*", async (socket) => {
    const result = await enforceWebSocketHostIsolation(
      socket,
      allowedHosts,
      "Staging E2E origin isolation",
    );

    if (!result.allowed) {
      blockedWebSockets.push(result.url);
    }
  });

  return () => {
    expect(
      unexpectedRequests,
      "Authenticated E2E attempted to leave the attested staging origins.",
    ).toEqual([]);
    expect(
      blockedWebSockets,
      "Authenticated E2E attempted a WebSocket outside staging; the connection was blocked before reaching a server.",
    ).toEqual([]);
  };
}
