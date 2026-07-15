import "server-only";

import type { Json } from "@/lib/supabase/database.types";

const CLERK_QUERY =
  "__clerk_api_version=2026-05-12&_clerk_js_version=6.25.0";
const CLERK_BASE_URL = "https://clerk.dropkiller.com/v1/client";
const PRODUCTS_URL = "https://www.dropkiller.com/api/products";
const SATURATION_TIMEOUT_MS = 10_000;
const PRODUCTS_PER_PAGE = 50;
const MAX_PRODUCTS_PER_CONFIG = 500;
const MAX_PRODUCT_PAGES = MAX_PRODUCTS_PER_CONFIG / PRODUCTS_PER_PAGE;
const PRODUCT_PAGE_DELAY_MS = 450;

type JsonRecord = Record<string, unknown>;

type DropkillerCredentials = {
  user: string;
  password: string;
};

export type DropkillerConfig = {
  platform: string;
  country_code: string;
  activo?: boolean | null;
  enabled?: boolean | null;
};

export type DropkillerProductDailyRow = {
  external_id: string;
  dropkiller_uuid: string | null;
  primary_image_url: string | null;
  platform: string;
  country_code: string;
  nombre_producto: string;
  sale_price: number | null;
  suggested_price: number | null;
  stock: number | null;
  total_sold_units: number | null;
  sold_units_last_7_days: number | null;
  sold_units_last_30_days: number | null;
  history_30d: Json | null;
  captured_at: string;
};

export type DropkillerProductsResult = {
  platform: string;
  country: string;
  products: DropkillerProductDailyRow[];
};

export class DropkillerAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DropkillerAuthError";
  }
}

export class DropkillerProductsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DropkillerProductsError";
  }
}

class CookieJar {
  private readonly cookies = new Map<string, string>();

  addFromHeaders(headers: Headers) {
    for (const setCookie of getSetCookieHeaders(headers)) {
      const [cookiePair] = setCookie.split(";");
      const separatorIndex = cookiePair.indexOf("=");

      if (separatorIndex <= 0) {
        continue;
      }

      const name = cookiePair.slice(0, separatorIndex).trim();
      const value = cookiePair.slice(separatorIndex + 1).trim();

      if (name) {
        this.cookies.set(name, value);
      }
    }
  }

  toHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

export function isEnabledDropkillerConfig(config: DropkillerConfig) {
  return Boolean(
    config.platform &&
      config.country_code &&
      config.activo !== false &&
      config.enabled !== false,
  );
}

export async function fetchDropkillerProducts(
  configs: DropkillerConfig[],
  capturedAt = getTodayDate(),
  jwt?: string,
): Promise<DropkillerProductsResult[]> {
  const enabledConfigs = configs.filter(isEnabledDropkillerConfig);

  if (enabledConfigs.length === 0) {
    return [];
  }

  const sessionToken = jwt ?? (await loginFresh());

  return Promise.all(
    enabledConfigs.map((config) =>
      fetchProductsForConfig(config, sessionToken, capturedAt),
    ),
  );
}

export async function createDropkillerSessionToken() {
  return loginFresh();
}

export async function fetchProductSaturation(
  jwt: string,
  dropkillerUuid: string,
  countryCode: string,
) {
  const uuid = dropkillerUuid.trim();
  const country = countryCode.trim();

  if (!jwt || !uuid || !country) {
    return null;
  }

  const url = new URL(
    `${PRODUCTS_URL}/${encodeURIComponent(uuid)}/saturation`,
  );
  url.searchParams.set("country", country);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${jwt}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(SATURATION_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const body = await readJson(response);
    const providersCount = toNumberValue(
      getValueAtPath(body, ["result", "signals", "providers", "count"]),
    );

    return providersCount !== null &&
      Number.isInteger(providersCount) &&
      providersCount >= 0
      ? providersCount
      : null;
  } catch {
    return null;
  }
}

function getCredentials(): DropkillerCredentials {
  const user = process.env.DROPKILLER_USER;
  const password = process.env.DROPKILLER_PASSWORD;

  if (!user || !password) {
    throw new DropkillerAuthError("Dropkiller credentials are not configured");
  }

  return { user, password };
}

async function loginFresh() {
  const credentials = getCredentials();
  const cookieJar = new CookieJar();
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const signInId = await createSignInAttempt(credentials, cookieJar);

      return await attemptPasswordFactor(signInId, credentials, cookieJar);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new DropkillerAuthError("Dropkiller authentication failed");
}

async function createSignInAttempt(
  credentials: DropkillerCredentials,
  cookieJar: CookieJar,
) {
  const cookieHeader = cookieJar.toHeader();
  const response = await fetch(`${CLERK_BASE_URL}/sign_ins?${CLERK_QUERY}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: new URLSearchParams({
      identifier: credentials.user,
      locale: "es-419",
    }),
    cache: "no-store",
  });

  cookieJar.addFromHeaders(response.headers);
  const body = await readJson(response);

  if (!response.ok) {
    throw new DropkillerAuthError(
      "Dropkiller sign-in initialization failed",
    );
  }

  const signInId = getStringAtPath(body, ["response", "id"]);

  if (!signInId) {
    throw new DropkillerAuthError(
      "Dropkiller sign-in initialization did not return an attempt id",
    );
  }

  return signInId;
}

async function attemptPasswordFactor(
  signInId: string,
  credentials: DropkillerCredentials,
  cookieJar: CookieJar,
) {
  const cookieHeader = cookieJar.toHeader();
  const response = await fetch(
    `${CLERK_BASE_URL}/sign_ins/${signInId}/attempt_first_factor?${CLERK_QUERY}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
      body: new URLSearchParams({
        strategy: "password",
        password: credentials.password,
      }),
      cache: "no-store",
    },
  );

  cookieJar.addFromHeaders(response.headers);
  const body = await readJson(response);

  if (!response.ok) {
    throw new DropkillerAuthError("Dropkiller password authentication failed");
  }

  const jwt = getStringAtPath(body, [
    "client",
    "sessions",
    "0",
    "last_active_token",
    "jwt",
  ]);

  if (!jwt) {
    throw new DropkillerAuthError(
      "Dropkiller authentication completed without a session token",
    );
  }

  return jwt;
}

async function fetchProductsForConfig(
  config: DropkillerConfig,
  jwt: string,
  capturedAt: string,
): Promise<DropkillerProductsResult> {
  const products: DropkillerProductDailyRow[] = [];
  const seenExternalIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PRODUCT_PAGES; page += 1) {
    const url = new URL(PRODUCTS_URL);
    url.searchParams.set("sort", "daily");
    url.searchParams.set("order", "desc");
    url.searchParams.set("limit", String(PRODUCTS_PER_PAGE));
    url.searchParams.set("platform", config.platform);
    url.searchParams.set("country", config.country_code);

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${jwt}`,
      },
      cache: "no-store",
    });
    const body = await readJson(response);

    if (!response.ok) {
      throw new DropkillerProductsError(
        `Dropkiller products fetch failed for ${config.platform}/${config.country_code}`,
      );
    }

    const pageProducts = getArrayAtPath(body, ["data"]);

    if (!pageProducts) {
      throw new DropkillerProductsError(
        `Dropkiller products response was not an array for ${config.platform}/${config.country_code}`,
      );
    }

    for (const product of pageProducts) {
      const mappedProduct = mapProduct(product, config, capturedAt);

      if (seenExternalIds.has(mappedProduct.external_id)) {
        continue;
      }

      seenExternalIds.add(mappedProduct.external_id);
      products.push(mappedProduct);

      if (products.length >= MAX_PRODUCTS_PER_CONFIG) {
        break;
      }
    }

    const hasNext =
      getValueAtPath(body, ["pagination", "hasNext"]) === true;

    if (!hasNext || products.length >= MAX_PRODUCTS_PER_CONFIG) {
      break;
    }

    if (page === MAX_PRODUCT_PAGES - 1) {
      break;
    }

    const nextCursor = toStringValue(
      getValueAtPath(body, ["pagination", "nextCursor"]),
    );

    if (!nextCursor) {
      throw new DropkillerProductsError(
        `Dropkiller products response was missing the next cursor for ${config.platform}/${config.country_code}`,
      );
    }

    if (seenCursors.has(nextCursor)) {
      throw new DropkillerProductsError(
        `Dropkiller products pagination repeated a cursor for ${config.platform}/${config.country_code}`,
      );
    }

    seenCursors.add(nextCursor);
    cursor = nextCursor;
    await delay(PRODUCT_PAGE_DELAY_MS);
  }

  return {
    platform: config.platform,
    country: config.country_code,
    products,
  };
}

function mapProduct(
  product: unknown,
  config: DropkillerConfig,
  capturedAt: string,
): DropkillerProductDailyRow {
  const productRecord = asRecord(product);
  const externalId = toStringValue(productRecord?.externalId);

  if (!externalId) {
    throw new DropkillerProductsError(
      `Dropkiller product missing external id for ${config.platform}/${config.country_code}`,
    );
  }

  return {
    external_id: externalId,
    dropkiller_uuid: toStringValue(productRecord?.id),
    primary_image_url: toStringValue(productRecord?.primaryImageUrl),
    platform: config.platform,
    country_code: config.country_code,
    nombre_producto: toStringValue(productRecord?.name) ?? "",
    sale_price: toNumberValue(productRecord?.salePrice),
    suggested_price: toNumberValue(productRecord?.suggestedPrice),
    stock: toNumberValue(productRecord?.stock),
    total_sold_units: toNumberValue(productRecord?.totalSoldUnits),
    sold_units_last_7_days: toNumberValue(productRecord?.soldUnitsLast7Days),
    sold_units_last_30_days: toNumberValue(productRecord?.soldUnitsLast30Days),
    history_30d: Array.isArray(productRecord?.history30d)
      ? (productRecord.history30d as Json)
      : null,
    captured_at: capturedAt,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getSetCookieHeaders(headers: Headers) {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithSetCookie.getSetCookie === "function") {
    return headersWithSetCookie.getSetCookie();
  }

  const setCookie = headers.get("set-cookie");

  if (!setCookie) {
    return [];
  }

  return setCookie.split(/,(?=\s*[^;,]+=)/);
}

function getStringAtPath(value: unknown, path: string[]) {
  const result = getValueAtPath(value, path);

  return typeof result === "string" ? result : null;
}

function getArrayAtPath(value: unknown, path: string[]) {
  const result = getValueAtPath(value, path);

  return Array.isArray(result) ? result : null;
}

function getValueAtPath(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
    if (Array.isArray(current)) {
      current = current[Number(key)];
      continue;
    }

    const record = asRecord(current);

    if (!record) {
      return null;
    }

    current = record[key];
  }

  return current;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function toNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : null;
  }

  return null;
}

function toStringValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
