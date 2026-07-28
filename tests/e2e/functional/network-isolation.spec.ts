import { expect, test, type WebSocketRoute } from "@playwright/test";

import { enforceWebSocketHostIsolation } from "../helpers/staging-network";

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

test("WebSocket isolation connects only to an explicitly allowed host", async () => {
  const { calls, socket } = fakeSocket("wss://preview.example.test/realtime");
  const result = await enforceWebSocketHostIsolation(
    socket,
    new Set(["preview.example.test"]),
    "E2E isolation",
  );

  expect(result).toEqual({
    allowed: true,
    url: "wss://preview.example.test/realtime",
  });
  expect(calls.connected).toBe(1);
  expect(calls.closeOptions).toEqual([]);
});

test("WebSocket isolation closes a disallowed socket before connecting", async () => {
  const { calls, socket } = fakeSocket("wss://crm.pakora.online/realtime");
  const result = await enforceWebSocketHostIsolation(
    socket,
    new Set(["preview.example.test"]),
    "E2E isolation",
  );

  expect(result).toEqual({
    allowed: false,
    url: "wss://crm.pakora.online/realtime",
  });
  expect(calls.connected).toBe(0);
  expect(calls.closeOptions).toEqual([
    { code: 1008, reason: "E2E isolation" },
  ]);
});
