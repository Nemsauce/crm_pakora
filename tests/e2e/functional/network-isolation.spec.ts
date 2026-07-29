import { expect, test, type WebSocketRoute } from "@playwright/test";

import {
  VERCEL_PROTECTION_BYPASS_HEADER,
  classifyStagingRequest,
  enforceWebSocketHostIsolation,
  getAllowedStagingWebSocketHosts,
  getStagingAppRequestHeaders,
  stripVercelProtectionHeaders,
} from "../helpers/staging-network";

const stagingConfig = {
  appOrigin: "https://crm-v4-preview.vercel.app",
  supabaseUrl: "https://stagingref123.supabase.co",
} as const;
const runnerBypassSecret = "0123456789abcdefghijklmnopqrstuv";
const stagingWebSocketProtocols = new Set(["wss:"]);

function fakeSocket(url: string) {
  const calls = {
    connected: 0,
    closeOptions: [] as Array<{ code?: number; reason?: string }>,
  };
  const socket = {
    url: () => url,
    connectToServer: () => {
      calls.connected += 1;
      return socket;
    },
    close: async (options?: { code?: number; reason?: string }) => {
      calls.closeOptions.push(options ?? {});
    },
  } as unknown as WebSocketRoute;

  return { calls, socket };
}

test("HTTP isolation adds the Vercel bypass only to the Preview origin", () => {
  const originalHeaders = {
    accept: "text/html",
    "x-vercel-protection-bypass": "inherited-secret-must-be-overwritten",
    "x-vercel-set-bypass-cookie": "true",
  };
  const appHeaders = getStagingAppRequestHeaders(
    `${stagingConfig.appOrigin}/pedidos`,
    originalHeaders,
    stagingConfig,
    runnerBypassSecret,
  );
  const supabaseHeaders = getStagingAppRequestHeaders(
    `${stagingConfig.supabaseUrl}/rest/v1/orders`,
    originalHeaders,
    stagingConfig,
    runnerBypassSecret,
  );

  expect(appHeaders).toEqual({
    accept: "text/html",
    [VERCEL_PROTECTION_BYPASS_HEADER]: runnerBypassSecret,
  });
  expect(appHeaders).not.toHaveProperty("x-vercel-set-bypass-cookie");
  expect(supabaseHeaders).toBeNull();
  expect(stripVercelProtectionHeaders(originalHeaders)).toEqual({
    accept: "text/html",
  });
});

test("HTTP isolation classifies redirects outside staging as blocked", () => {
  expect(
    classifyStagingRequest(
      `${stagingConfig.appOrigin}/login`,
      stagingConfig,
    ),
  ).toBe("app");
  expect(
    classifyStagingRequest(
      `${stagingConfig.supabaseUrl}/auth/v1/token`,
      stagingConfig,
    ),
  ).toBe("supabase");
  expect(
    classifyStagingRequest(
      "https://vercel.com/sso-api?url=protected-preview",
      stagingConfig,
    ),
  ).toBe("blocked");
  expect(
    classifyStagingRequest(
      "https://crm.pakora.online/pedidos",
      stagingConfig,
    ),
  ).toBe("blocked");
  expect(
    classifyStagingRequest(
      `${stagingConfig.appOrigin}/login?x-vercel-protection-bypass=must-not-be-in-a-url`,
      stagingConfig,
    ),
  ).toBe("blocked");
});

test("WebSocket isolation connects only to Supabase Realtime", async () => {
  const allowedHosts = getAllowedStagingWebSocketHosts(stagingConfig);
  const { calls, socket } = fakeSocket(
    "wss://stagingref123.supabase.co/realtime/v1/websocket",
  );
  const result = await enforceWebSocketHostIsolation(
    socket,
    allowedHosts,
    "E2E isolation",
    stagingWebSocketProtocols,
  );

  expect(result).toEqual({
    allowed: true,
    url: "wss://stagingref123.supabase.co/realtime/v1/websocket",
  });
  expect([...allowedHosts]).toEqual(["stagingref123.supabase.co"]);
  expect(calls.connected).toBe(1);
  expect(calls.closeOptions).toEqual([]);
});

test("WebSocket isolation closes Preview and production sockets before connecting", async () => {
  const allowedHosts = getAllowedStagingWebSocketHosts(stagingConfig);

  for (const socketUrl of [
    "wss://crm-v4-preview.vercel.app/realtime",
    "wss://crm.pakora.online/realtime",
    "ws://stagingref123.supabase.co/realtime/v1/websocket",
  ]) {
    const { calls, socket } = fakeSocket(socketUrl);
    const result = await enforceWebSocketHostIsolation(
      socket,
      allowedHosts,
      "E2E isolation",
      stagingWebSocketProtocols,
    );

    expect(result).toEqual({ allowed: false, url: socketUrl });
    expect(calls.connected).toBe(0);
    expect(calls.closeOptions).toEqual([
      { code: 1008, reason: "E2E isolation" },
    ]);
  }
});
