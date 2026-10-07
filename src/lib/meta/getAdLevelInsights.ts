import "server-only";

import {
  MetaCampaignsApiError,
  MetaCampaignsConfigError,
} from "@/lib/meta/fetchMetaCampaigns";

const META_GRAPH_BASE_URL = "https://graph.facebook.com/v21.0";
const RATE_LIMIT_ERROR_CODES = new Set([
  4, 17, 32, 613, 80_000, 80_001, 80_002, 80_003, 80_004, 80_005, 80_006,
  80_008, 80_009, 80_014,
]);
// Graph v21.0 AdsInsights.DatePreset enum.
const DATE_PRESETS = new Set([
  "data_maximum", "last_14d", "last_28d", "last_30d", "last_3d", "last_7d",
  "last_90d", "last_month", "last_quarter", "last_week_mon_sun",
  "last_week_sun_sat", "last_year", "maximum", "this_month", "this_quarter",
  "this_week_mon_today", "this_week_sun_today", "this_year", "today", "yesterday",
]);
const PURCHASE_ACTION_TYPES = [
  "omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase",
] as const;

type JsonRecord = Record<string, unknown>;

export type AdLevelInsight = {
  adId: string;
  adName: string;
  spend: number;
  purchases: number;
  costPerPurchase: number | null;
};

export class MetaSpendRateLimitError extends MetaCampaignsApiError {
  constructor() {
    super("Meta reached its rate limit; no further campaigns were checked");
    this.name = "MetaSpendRateLimitError";
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validate(campaignId: string, datePreset: string) {
  if (!/^\d+$/.test(campaignId)) {
    throw new MetaCampaignsConfigError("Meta campaign ID must be numeric");
  }
  if (!DATE_PRESETS.has(datePreset)) {
    throw new MetaCampaignsConfigError("Invalid Graph v21.0 date_preset");
  }
}

function metric(value: unknown): number {
  const parsed = typeof value === "number" ||
    (typeof value === "string" && value.trim()) ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new MetaCampaignsApiError("Meta returned an invalid insight metric");
  }
  return parsed;
}

function actionValues(value: unknown) {
  const values = new Map<string, number>();
  if (value === undefined) return values;
  if (!Array.isArray(value)) {
    throw new MetaCampaignsApiError("Meta returned invalid insight actions");
  }
  for (const action of value) {
    if (!isRecord(action) || typeof action.action_type !== "string") {
      throw new MetaCampaignsApiError("Meta returned an invalid insight action");
    }
    values.set(action.action_type, metric(action.value));
  }
  return values;
}

function dataRows(page: unknown): JsonRecord[] {
  if (!isRecord(page) || !Array.isArray(page.data) || !page.data.every(isRecord)) {
    throw new MetaCampaignsApiError("Meta returned an invalid insight list");
  }
  return page.data;
}

function nextCursor(page: JsonRecord): string | null {
  if (!isRecord(page.paging) || !page.paging.next) return null;
  const cursors = page.paging.cursors;
  if (!isRecord(cursors) || typeof cursors.after !== "string" || !cursors.after) {
    throw new MetaCampaignsApiError("Meta pagination is incomplete");
  }
  return cursors.after;
}

function usageIsHigh(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(usageIsHigh);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, nested]) =>
    ["call_count", "total_cputime", "total_time", "acc_id_util_pct"].includes(key) &&
      typeof nested === "number" && nested >= 90 || usageIsHigh(nested),
  );
}

async function metaGet(
  path: string,
  parameters: Record<string, string>,
  signal?: AbortSignal,
): Promise<JsonRecord> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) throw new MetaCampaignsConfigError("META_ACCESS_TOKEN is not configured");
  const url = new URL(`${META_GRAPH_BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);

  let response: Response;
  let body: unknown;
  try {
    const timeout = AbortSignal.timeout(30_000);
    response = await fetch(url, {
      headers: { accept: "application/json", authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    // Some throttled responses have no JSON body.
    body = await response.json().catch(() => null);
  } catch {
    throw new MetaCampaignsApiError("Meta API request could not be completed");
  }
  const apiError = isRecord(body) && isRecord(body.error) ? body.error : null;
  const code = typeof apiError?.code === "number" ? apiError.code : null;
  if (response.status === 429 || (code !== null && RATE_LIMIT_ERROR_CODES.has(code))) {
    throw new MetaSpendRateLimitError();
  }
  for (const name of ["x-app-usage", "x-ad-account-usage", "x-business-use-case-usage"]) {
    let usage: unknown;
    try { usage = JSON.parse(response.headers.get(name) ?? "null"); } catch { continue; }
    if (usageIsHigh(usage)) throw new MetaSpendRateLimitError();
  }
  if (!response.ok || apiError) {
    throw new MetaCampaignsApiError(
      `Meta API request failed (HTTP ${response.status}, code ${code ?? "unknown"})`,
    );
  }
  if (!isRecord(body)) throw new MetaCampaignsApiError("Meta API returned an invalid response");
  return body;
}

async function fetchPages(
  path: string,
  parameters: Record<string, string>,
  signal?: AbortSignal,
): Promise<JsonRecord[]> {
  const rows: JsonRecord[] = [];
  const seen = new Set<string>();
  let after: string | null = null;
  do {
    signal?.throwIfAborted();
    if (after) {
      // Match the catalog's pacing between pages. The run signal is checked
      // again before the request and applied to the fetch itself.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const page = await metaGet(path, {
      ...parameters, limit: "200", ...(after ? { after } : {}),
    }, signal);
    rows.push(...dataRows(page));
    after = nextCursor(page);
    if (after && seen.has(after)) {
      throw new MetaCampaignsApiError("Meta returned a repeated pagination cursor");
    }
    if (after) seen.add(after);
  } while (after);
  return rows;
}

export async function getAdLevelInsights(
  campaignId: string,
  datePreset = "maximum",
  signal?: AbortSignal,
): Promise<AdLevelInsight[]> {
  validate(campaignId, datePreset);
  const rows = await fetchPages(`${campaignId}/ads`, {
    // date_preset on the ads edge itself is ignored by Graph.
    fields: `id,name,insights.date_preset(${datePreset}).fields(spend,actions,cost_per_action_type)`,
  }, signal);
  const ads = new Map<string, AdLevelInsight>();
  for (const row of rows) {
    if (typeof row.id !== "string" || !/^\d+$/.test(row.id) || typeof row.name !== "string") {
      throw new MetaCampaignsApiError("Meta returned an invalid ad");
    }
    const insights = row.insights != null && isRecord(row.insights) && Array.isArray((row.insights as JsonRecord).data)
      ? dataRows(row.insights)
      : [];
    if (insights.length > 1 || (row.insights != null && nextCursor(row.insights as JsonRecord))) {
      throw new MetaCampaignsApiError("Meta returned incomplete or unaggregated ad insights");
    }
    const insight = insights[0];
    const actions = actionValues(insight?.actions);
    const costs = actionValues(insight?.cost_per_action_type);
    const purchaseType = PURCHASE_ACTION_TYPES.find((type) => actions.has(type));
    ads.set(row.id, {
      adId: row.id,
      adName: row.name,
      spend: insight ? metric(insight.spend) : 0,
      purchases: purchaseType ? actions.get(purchaseType)! : 0,
      costPerPurchase: purchaseType ? costs.get(purchaseType) ?? null : null,
    });
  }
  return [...ads.values()];
}

export async function getCampaignTotalSpend(
  campaignId: string,
  datePreset = "maximum",
  signal?: AbortSignal,
): Promise<number> {
  validate(campaignId, datePreset);
  // Fetch the campaign aggregate directly: summing the current /ads catalog
  // can miss spend belonging to deleted ads.
  const rows = await fetchPages(`${campaignId}/insights`, {
    fields: "spend", date_preset: datePreset, time_increment: "all_days",
  }, signal);
  if (rows.length > 1) throw new MetaCampaignsApiError("Meta returned unaggregated campaign spend");
  return rows.length ? metric(rows[0].spend) : 0;
}
