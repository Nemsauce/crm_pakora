import { expect, type Page, type WebSocketRoute } from "@playwright/test";

import type { StagingGuardConfig } from "../../../scripts/e2e/staging-guard.mjs";

export const VERCEL_PROTECTION_BYPASS_HEADER =
  "x-vercel-protection-bypass";
const VERCEL_SET_BYPASS_COOKIE_HEADER = "x-vercel-set-bypass-cookie";
const FORBIDDEN_VERCEL_BYPASS_PARAMETERS = new Set<string>([
  VERCEL_PROTECTION_BYPASS_HEADER,
  VERCEL_SET_BYPASS_COOKIE_HEADER,
]);
const DEFAULT_ALLOWED_WEBSOCKET_PROTOCOLS = new Set(["ws:", "wss:"]);
const STAGING_ALLOWED_WEBSOCKET_PROTOCOLS = new Set(["wss:"]);

type StagingRequestKind = "app" | "supabase" | "blocked";

export function classifyStagingRequest(
  requestUrl: string,
  config: Pick<StagingGuardConfig, "appOrigin" | "supabaseUrl">,
): StagingRequestKind {
  const parsedRequestUrl = new URL(requestUrl);
  if (
    [...FORBIDDEN_VERCEL_BYPASS_PARAMETERS].some((parameter) =>
      parsedRequestUrl.searchParams.has(parameter),
    )
  ) {
    return "blocked";
  }

  const requestOrigin = parsedRequestUrl.origin;

  if (requestOrigin === config.appOrigin) {
    return "app";
  }

  if (requestOrigin === config.supabaseUrl) {
    return "supabase";
  }

  return "blocked";
}

export function getStagingAppRequestHeaders(
  requestUrl: string,
  requestHeaders: Readonly<Record<string, string>>,
  config: Pick<StagingGuardConfig, "appOrigin">,
  runnerVercelAutomationBypassSecret: string,
) {
  if (new URL(requestUrl).origin !== config.appOrigin) {
    return null;
  }

  return Object.fromEntries([
    ...Object.entries(stripVercelProtectionHeaders(requestHeaders)),
    [VERCEL_PROTECTION_BYPASS_HEADER, runnerVercelAutomationBypassSecret],
  ]);
}

export function stripVercelProtectionHeaders(
  requestHeaders: Readonly<Record<string, string>>,
) {
  return Object.fromEntries(
    Object.entries(requestHeaders).filter(
      ([name]) =>
        !FORBIDDEN_VERCEL_BYPASS_PARAMETERS.has(name.toLowerCase()),
    ),
  );
}

export function getAllowedStagingWebSocketHosts(
  config: Pick<StagingGuardConfig, "supabaseUrl">,
) {
  // The CRM's only browser WebSocket is Supabase Realtime. App-origin
  // WebSockets would require a separately reviewed Vercel bypass-cookie flow;
  // they stay closed instead of receiving a global header that could leak.
  return new Set([new URL(config.supabaseUrl).host]);
}

export async function enforceWebSocketHostIsolation(
  socket: WebSocketRoute,
  allowedHosts: ReadonlySet<string>,
  reason: string,
  allowedProtocols: ReadonlySet<string> = DEFAULT_ALLOWED_WEBSOCKET_PROTOCOLS,
) {
  const socketUrl = socket.url();
  const parsedSocketUrl = new URL(socketUrl);

  if (
    !allowedProtocols.has(parsedSocketUrl.protocol) ||
    !allowedHosts.has(parsedSocketUrl.host)
  ) {
    await socket.close({ code: 1008, reason });
    return { allowed: false as const, url: socketUrl };
  }

  socket.connectToServer();
  return { allowed: true as const, url: socketUrl };
}

export async function installStagingBrowserOriginGuard(
  page: Page,
  config: Pick<StagingGuardConfig, "appOrigin" | "supabaseUrl">,
  runnerVercelAutomationBypassSecret: string,
) {
  const allowedHosts = getAllowedStagingWebSocketHosts(config);
  const unexpectedRequests: string[] = [];
  const blockedWebSockets: string[] = [];

  await page.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    const requestKind = classifyStagingRequest(requestUrl, config);

    if (requestKind === "blocked") {
      const redactedUrl = new URL(requestUrl);
      redactedUrl.username = "";
      redactedUrl.password = "";
      redactedUrl.search = redactedUrl.search ? "?redacted" : "";
      redactedUrl.hash = "";
      unexpectedRequests.push(redactedUrl.href);
      await route.abort("blockedbyclient");
      return;
    }

    if (requestKind === "app") {
      const headers = getStagingAppRequestHeaders(
        requestUrl,
        route.request().headers(),
        config,
        runnerVercelAutomationBypassSecret,
      );
      await route.continue({ headers: headers ?? undefined });
      return;
    }

    await route.continue({
      // Playwright carries header overrides across redirects. Strip both
      // Vercel capability headers explicitly so an app -> Supabase redirect
      // cannot inherit the runner-only bypass.
      headers: stripVercelProtectionHeaders(route.request().headers()),
    });
  });

  await page.routeWebSocket("**/*", async (socket) => {
    const result = await enforceWebSocketHostIsolation(
      socket,
      allowedHosts,
      "Staging E2E origin isolation",
      STAGING_ALLOWED_WEBSOCKET_PROTOCOLS,
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
