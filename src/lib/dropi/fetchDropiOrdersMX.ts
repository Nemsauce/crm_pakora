import "server-only";

import { DROPI_BROWSER_HEADERS } from "@/lib/dropi/dropiAuthMX";

const DROPI_ORDERS_URL = "https://api.dropi.mx/api/orders/myorders";
const PAGE_SIZE = 50;
const MAX_PAGES = 20;
const REQUEST_INTERVAL_MS = 500;

export type DropiHistoryEntry = {
  status?: string | null;
  estado?: string | null;
  created_at?: string | null;
  registrado_en?: string | null;
  updated_at?: string | null;
  novedad?: string | null;
  observacion?: string | null;
  observation?: string | null;
  description?: string | null;
  notes?: string | null;
  transportadora?: string | null;
  distribution_company?: { name?: string | null } | null;
  [key: string]: unknown;
};

export type DropiOrderMX = {
  id?: number | string | null;
  shop_order_id?: number | string | null;
  status?: string | null;
  history?: DropiHistoryEntry[] | null;
  updated_at?: string | null;
  novedad_servientrega?: string | null;
  distribution_company?: { name?: string | null } | null;
  client_total_orders?: number | string | null;
  client_total_orders_returneds?: number | string | null;
  orderdetails?: Array<{ supplier_price?: number | string | null }> | null;
  shipping_amount?: number | string | null;
  shipping_guide?: string | null;
  [key: string]: unknown;
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

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function toDateOnly(value: Date) {
  return value.toISOString().split("T")[0];
}

function encodeQueryValue(value: string) {
  return encodeURIComponent(value);
}

function buildOrdersUrl(page: number) {
  const queryParameters: Array<[string, string]> = [
    ["exportAs", "orderByRow"],
    ["orderBy", "id"],
    ["orderDirection", "asc"],
    ["result_number", String(PAGE_SIZE)],
    ["start", String(page * PAGE_SIZE)],
    ["status", "null"],
    ["supplier_id", "false"],
    ["user_id", "139984"],
    ["filter_product", "undefined"],
    ["haveIncidenceProcesamiento", "false"],
    ["tag_id", ""],
    ["warranty", "false"],
    ["seller", "null"],
    ["filter_date_by", "FECHA DE CREADO"],
    ["invoiced", "null"],
    ["from", toDateOnly(new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000))],
    ["until", toDateOnly(new Date())],
  ];
  const query = queryParameters
    .map(([name, value]) => `${name}=${encodeQueryValue(value)}`)
    .join("&");

  return `${DROPI_ORDERS_URL}?${query}`;
}

function buildOrdersHeaders(token: string) {
  const headers: Record<string, string> = {
    ...DROPI_BROWSER_HEADERS,
    "x-authorization": `Bearer ${token}`,
    "x-captcha-token": "",
  };

  delete headers["content-type"];

  return headers;
}

async function fetchOrdersPage(token: string, page: number) {
  const response = await fetch(buildOrdersUrl(page), {
    method: "GET",
    headers: buildOrdersHeaders(token),
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
        `Dropi orders request failed with HTTP ${response.status}`,
    );
  }

  if (!isRecord(payload) || !Array.isArray(payload.objects)) {
    throw new Error("Dropi orders response did not include an objects array");
  }

  return payload.objects as DropiOrderMX[];
}

export async function fetchDropiOrdersMX(token: string) {
  const orders: DropiOrderMX[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (page > 0) {
      await delay(REQUEST_INTERVAL_MS);
    }

    const pageOrders = await fetchOrdersPage(token, page);
    orders.push(...pageOrders);

    if (pageOrders.length < PAGE_SIZE) {
      break;
    }
  }

  return orders;
}
