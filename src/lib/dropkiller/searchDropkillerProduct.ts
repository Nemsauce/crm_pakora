import "server-only";

import {
  createDropkillerSessionToken,
  fetchProductSaturation,
} from "@/lib/dropkiller/fetchDropkillerProducts";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

const PRODUCTS_URL = "https://www.dropkiller.com/api/products";
const PLATFORM = "DROPI";
const SEARCH_LIMIT = 50;

export type DropkillerSearchCountry = "CO" | "MX";

export type DropkillerProductAnalysis = {
  external_id: string;
  dropkiller_uuid: string | null;
  primary_image_url: string | null;
  platform: string;
  country_code: DropkillerSearchCountry;
  nombre_producto: string;
  sale_price: number | null;
  suggested_price: number | null;
  stock: number | null;
  providers_count: number | null;
  total_sold_units: number | null;
  sold_units_last_7_days: number | null;
  sold_units_last_30_days: number | null;
  history_30d: Json | null;
  captured_at: string;
  ritmo_reciente: number | null;
  percentil_ritmo: number | null;
  dias_con_venta_7d: number;
  tercio1_promedio: number | null;
  tercio2_promedio: number | null;
  tercio3_promedio: number | null;
  tendencia_ratio: number | null;
  cumple_banda_sweet_spot: null;
  cumple_consistencia: null;
  cumple_tendencia_ascendente: null;
  es_sweet_spot: null;
};

export type DropkillerProductSearchResult = {
  product: DropkillerProductAnalysis;
  comparisonSize: number;
  comparisonDate: string;
};

type JsonRecord = Record<string, unknown>;

type ReferenceRow = {
  external_id: string;
  sold_units_last_7_days: number | null;
};

type HistoryPoint = {
  date: number;
  units: number;
};

export class DropkillerProductSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DropkillerProductSearchError";
  }
}

export async function searchDropkillerProduct(
  rawProductId: string,
  country: DropkillerSearchCountry,
): Promise<DropkillerProductSearchResult | null> {
  const productId = normalizeProductId(rawProductId);
  const capturedAt = getTodayDate();
  const jwt = await createDropkillerSessionToken();
  const productRecord = await fetchExactProduct(productId, country, jwt);

  if (!productRecord) {
    return null;
  }

  const dropkillerUuid = toStringValue(productRecord.id);
  const [providersCount, referenceRows] = await Promise.all([
    dropkillerUuid
      ? fetchProductSaturation(jwt, dropkillerUuid, country)
      : Promise.resolve(null),
    loadTodayReferenceRows(country, capturedAt),
  ]);
  const soldUnitsLast7Days = toNumberValue(productRecord.soldUnitsLast7Days);
  const ritmoReciente =
    soldUnitsLast7Days === null
      ? null
      : roundTo(soldUnitsLast7Days / 7, 2);
  const history30d = Array.isArray(productRecord.history30d)
    ? (productRecord.history30d as Json)
    : null;
  const signals = calculateHistorySignals(history30d, capturedAt);

  return {
    product: {
      external_id: productId,
      dropkiller_uuid: dropkillerUuid,
      primary_image_url: toStringValue(productRecord.primaryImageUrl),
      platform: PLATFORM,
      country_code: country,
      nombre_producto: toStringValue(productRecord.name) ?? "",
      sale_price: toNumberValue(productRecord.salePrice),
      suggested_price: toNumberValue(productRecord.suggestedPrice),
      stock: toNumberValue(productRecord.stock),
      providers_count: providersCount,
      total_sold_units: toNumberValue(productRecord.totalSoldUnits),
      sold_units_last_7_days: soldUnitsLast7Days,
      sold_units_last_30_days: toNumberValue(
        productRecord.soldUnitsLast30Days,
      ),
      history_30d: history30d,
      captured_at: capturedAt,
      ritmo_reciente: ritmoReciente,
      percentil_ritmo: calculatePercentRank(
        productId,
        ritmoReciente,
        referenceRows,
      ),
      dias_con_venta_7d: signals.diasConVenta7d,
      tercio1_promedio: signals.tercio1Promedio,
      tercio2_promedio: signals.tercio2Promedio,
      tercio3_promedio: signals.tercio3Promedio,
      tendencia_ratio: signals.tendenciaRatio,
      cumple_banda_sweet_spot: null,
      cumple_consistencia: null,
      cumple_tendencia_ascendente: null,
      es_sweet_spot: null,
    },
    comparisonSize: referenceRows.length,
    comparisonDate: capturedAt,
  };
}

async function fetchExactProduct(
  productId: string,
  country: DropkillerSearchCountry,
  jwt: string,
) {
  const url = new URL(PRODUCTS_URL);
  url.searchParams.set("sort", "daily");
  url.searchParams.set("order", "desc");
  url.searchParams.set("platform", PLATFORM);
  url.searchParams.set("country", country);
  url.searchParams.set("limit", String(SEARCH_LIMIT));
  url.searchParams.set("q", productId);

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${jwt}`,
    },
    cache: "no-store",
  });
  const body = await readJson(response);

  if (!response.ok) {
    throw new DropkillerProductSearchError(
      `Dropkiller product search failed for ${country}`,
    );
  }

  const products = getArrayAtPath(body, ["data"]);

  if (!products) {
    throw new DropkillerProductSearchError(
      `Dropkiller product search returned an invalid response for ${country}`,
    );
  }

  return (
    products
      .map(asRecord)
      .find(
        (product): product is JsonRecord =>
          product !== null &&
          toStringValue(product.externalId)?.trim() === productId,
      ) ?? null
  );
}

async function loadTodayReferenceRows(
  country: DropkillerSearchCountry,
  capturedAt: string,
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("dropkiller_products_daily")
    .select("external_id,sold_units_last_7_days")
    .eq("platform", PLATFORM)
    .eq("country_code", country)
    .eq("captured_at", capturedAt)
    .range(0, 999);

  if (error) {
    throw new DropkillerProductSearchError(
      `Could not load today's Dropkiller comparison set for ${country}`,
    );
  }

  return (data ?? []) as ReferenceRow[];
}

function calculateHistorySignals(history: Json | null, capturedAt: string) {
  const capturedAtTimestamp = parseDate(capturedAt);
  const points = getHistoryPoints(history);

  if (capturedAtTimestamp === null) {
    throw new DropkillerProductSearchError("Invalid comparison date");
  }

  const sevenDayBoundary = subtractUtcDays(capturedAtTimestamp, 7);
  const firstThirdBoundary = subtractUtcDays(capturedAtTimestamp, 20);
  const secondThirdBoundary = subtractUtcDays(capturedAtTimestamp, 10);
  const firstThird: number[] = [];
  const secondThird: number[] = [];
  const thirdThird: number[] = [];
  let diasConVenta7d = 0;

  for (const point of points) {
    if (
      point.date > sevenDayBoundary &&
      point.date <= capturedAtTimestamp &&
      point.units > 0
    ) {
      diasConVenta7d += 1;
    }

    if (point.date <= firstThirdBoundary) {
      firstThird.push(point.units);
    } else if (point.date <= secondThirdBoundary) {
      secondThird.push(point.units);
    } else {
      thirdThird.push(point.units);
    }
  }

  const tercio1Promedio = average(firstThird);
  const tercio2Promedio = average(secondThird);
  const tercio3Promedio = average(thirdThird);
  const tendenciaRatio =
    tercio1Promedio === null ||
    tercio1Promedio === 0 ||
    tercio3Promedio === null
      ? null
      : roundTo(tercio3Promedio / tercio1Promedio, 2);

  return {
    diasConVenta7d,
    tercio1Promedio,
    tercio2Promedio,
    tercio3Promedio,
    tendenciaRatio,
  };
}

function calculatePercentRank(
  productId: string,
  ritmoReciente: number | null,
  referenceRows: ReferenceRow[],
) {
  if (ritmoReciente === null) {
    return null;
  }

  const hasProductInReference = referenceRows.some(
    (row) => row.external_id === productId,
  );
  const comparablePaces = referenceRows.flatMap((row) => {
    if (hasProductInReference && row.external_id === productId) {
      return [];
    }

    return row.sold_units_last_7_days === null
      ? []
      : [row.sold_units_last_7_days / 7];
  });
  const denominator = comparablePaces.length;

  if (denominator === 0) {
    return 0;
  }

  const lowerValues = comparablePaces.filter(
    (pace) => pace < ritmoReciente,
  ).length;

  return roundTo(lowerValues / denominator, 3);
}

function getHistoryPoints(history: Json | null): HistoryPoint[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history.flatMap((value) => {
    const record = asRecord(value);
    const date = parseDate(toStringValue(record?.d));
    const units = toNumberValue(record?.u);

    return date === null || units === null ? [] : [{ date, units }];
  });
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return roundTo(
    values.reduce((total, value) => total + value, 0) / values.length,
    2,
  );
}

function normalizeProductId(value: string) {
  const productId = value.trim();

  if (!productId || productId.length > 100) {
    throw new DropkillerProductSearchError("Invalid Dropkiller product id");
  }

  return productId;
}

function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function subtractUtcDays(timestamp: number, days: number) {
  return timestamp - days * 24 * 60 * 60 * 1000;
}

function roundTo(value: number, decimals: number) {
  return Number(value.toFixed(decimals));
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getArrayAtPath(value: unknown, path: string[]) {
  const result = getValueAtPath(value, path);
  return Array.isArray(result) ? result : null;
}

function getValueAtPath(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
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
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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
