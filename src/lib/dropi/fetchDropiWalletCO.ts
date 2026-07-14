import "server-only";

import { DROPI_BROWSER_HEADERS } from "@/lib/dropi/dropiAuth";

const DROPI_WALLET_URL = "https://api.dropi.co/api/historywallet";
const RESULT_NUMBER = 200;
const WINDOW_DAYS = 180;

type DropiWalletMovement = {
  id: number;
  wallet_id?: number | null;
  order_id?: number | null | "";
  identification_code?: number | string | null;
  type?: string | null;
  amount?: number | string | null;
  previous_amount?: number | string | null;
  description?: string | null;
  shipping_guide?: string | null;
  guide?: string | null;
  created_at: string;
};

export type DropiWalletMovementCO = {
  id_movimiento_dropi: number;
  wallet_id: number | null;
  id_orden_dropi: number | null;
  identification_code: string | null;
  tipo: string | null;
  amount: number;
  previous_amount: number | null;
  description: string | null;
  guia_envio: string | null;
  registrado_en: string;
  pais: "CO";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractDropiErrorMessage(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim().slice(0, 1_000);
  }

  if (!isRecord(payload)) {
    return null;
  }

  for (const key of ["message", "errorMessage", "msg", "detail", "reason"]) {
    const value = payload[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 1_000);
    }
  }

  return null;
}

function getObjects(payload: unknown): DropiWalletMovement[] {
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.objects)) {
    return payload.objects as DropiWalletMovement[];
  }

  if (isRecord(payload.data) && Array.isArray(payload.data.objects)) {
    return payload.data.objects as DropiWalletMovement[];
  }

  if (isRecord(payload.body) && Array.isArray(payload.body.objects)) {
    return payload.body.objects as DropiWalletMovement[];
  }

  return [];
}

function toAmount(value: unknown, fallback: number): number;
function toAmount(value: unknown, fallback: null): number | null;
function toAmount(value: unknown, fallback: number | null) {
  const parsed = Number.parseFloat(String(value || fallback));

  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDateOnly(value: Date) {
  return value.toISOString().split("T")[0];
}

function encodeQueryValue(value: string) {
  return encodeURIComponent(value);
}

function buildWalletUrl() {
  const now = new Date();
  const from = new Date(
    now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1_000,
  );
  const queryParameters: Array<[string, string]> = [
    ["orderBy", "id"],
    ["orderDirection", "desc"],
    ["result_number", String(RESULT_NUMBER)],
    ["start", "0"],
    ["textToSearch", ""],
    ["type", "null"],
    ["id", "null"],
    ["identification_code", "null"],
    ["user_id", "824352"],
    ["from", toDateOnly(from)],
    ["until", toDateOnly(now)],
    ["wallet_id", "0"],
  ];
  const query = queryParameters
    .map(([name, value]) => `${name}=${encodeQueryValue(value)}`)
    .join("&");

  return `${DROPI_WALLET_URL}?${query}`;
}

function buildWalletHeaders(token: string) {
  const headers: Record<string, string> = {
    ...DROPI_BROWSER_HEADERS,
    "x-authorization": `Bearer ${token}`,
    "x-captcha-token": "",
  };

  delete headers["content-type"];

  return headers;
}

function mapWalletMovements(payload: unknown): DropiWalletMovementCO[] {
  const rows: DropiWalletMovementCO[] = [];

  for (const movement of getObjects(payload)) {
    rows.push({
      id_movimiento_dropi: movement.id,
      wallet_id: movement.wallet_id ?? null,
      id_orden_dropi:
        movement.order_id === "" ? null : (movement.order_id ?? null),
      identification_code:
        movement.identification_code != null
          ? String(movement.identification_code)
          : null,
      tipo: movement.type ?? null,
      amount: toAmount(movement.amount, 0),
      previous_amount:
        movement.previous_amount != null
          ? toAmount(movement.previous_amount, null)
          : null,
      description: movement.description ?? null,
      guia_envio: movement.shipping_guide ?? movement.guide ?? null,
      registrado_en: movement.created_at,
      pais: "CO",
    });
  }

  return rows;
}

export async function fetchDropiWalletCO(token: string) {
  const response = await fetch(buildWalletUrl(), {
    method: "GET",
    headers: buildWalletHeaders(token),
    cache: "no-store",
  });
  const responseText = await response.text();
  let payload: unknown = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) {
    throw new Error(
      extractDropiErrorMessage(payload) ??
        `Dropi wallet request failed with HTTP ${response.status}`,
    );
  }

  return mapWalletMovements(payload);
}
