import "server-only";

import {
  MetaCampaignsApiError,
  MetaCampaignsConfigError,
} from "@/lib/meta/fetchMetaCampaigns";

const META_GRAPH_VERSION = "v21.0";
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const PAGE_LIMIT = 200;
const MAX_PAGES = 25;
const REQUEST_DELAY_MS = 250;
const REQUEST_TIMEOUT_MS = 30_000;
const RATE_LIMIT_ERROR_CODES = new Set([
  4, 17, 32, 613, 80_000, 80_001, 80_002, 80_003, 80_004, 80_005, 80_006,
  80_008, 80_009, 80_014,
]);
// Same precedence list and ordering as fetchMetaCampaigns.normalizeInsight, so a
// campaign total and its per-ad breakdown count the same conversion (Invariant 4).
// The first present type wins; summing them would double-count omni_purchase.
const PURCHASE_ACTION_TYPES = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
] as const;
// Meta Graph v21.0 date_preset enum. There is no "lifetime" value in this
// version; "maximum" is the whole-history preset. Validating against the enum
// also keeps a caller-supplied string out of the query untouched.
const DATE_PRESETS = new Set([
  "today",
  "yesterday",
  "this_month",
  "last_month",
  "this_quarter",
  "last_quarter",
  "this_year",
  "last_year",
  "last_3d",
  "last_7d",
  "last_14d",
  "last_28d",
  "last_30d",
  "last_90d",
  "last_week_mon_sun",
  "last_week_sun_sat",
  "this_week_mon_today",
  "this_week_sun_today",
  "maximum",
  "data_maximum",
]);
const DEFAULT_DATE_PRESET = "maximum";

type JsonRecord = Record<string, unknown>;

export type AdLevelInsight = {
  adId: string;
  adName: string;
  spend: number;
  purchases: number;
  /** null when the ad recorded no purchases; never 0, which would read as free. */
  costPerPurchase: number | null;
};

/**
 * Raised when Meta refuses a request for rate limiting. Separate from
 * MetaCampaignsApiError so a caller can stop its whole run instead of
 * hammering the API campaign after campaign.
 */
export class MetaAdInsightsRateLimitError extends Error {
  constructor() {
    super("Meta rejected the request because of rate limiting");
    this.name = "MetaAdInsightsRateLimitError";
  }
}

/**
 * Per-ad spend and purchases for one campaign, newest Meta data, never cached.
 * Values are in the ad account's currency; the caller owns verifying that it is
 * the currency it intends to report.
 */
export async function getAdLevelInsights(
  campaignId: string,
  datePreset?: string,
): Promise<AdLevelInsight[]> {
  const id = assertCampaignId(campaignId);
  const preset = assertDatePreset(datePreset);
  const insights: AdLevelInsight[] = [];
  const seen = new Set<string>();
  let after: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const body = await metaGet(`${id}/ads`, {
      // date_preset must sit inside the nested insights expansion. The /ads edge
      // itself does not take it, so a top-level date_preset would be ignored and
      // Meta would silently answer with its own default window.
      fields: `id,name,insights.date_preset(${preset}).fields(spend,actions,cost_per_action_type)`,
      limit: String(PAGE_LIMIT),
      ...(after ? { after } : {}),
    });
    const data = body.data;

    if (!Array.isArray(data)) {
      throw new MetaCampaignsApiError("Meta API returned an invalid list response");
    }

    for (const rawAd of data) {
      const insight = normalizeAd(rawAd);

      // Meta can repeat a row across cursors; keep the first reading per ad
      // rather than adding its spend to the breakdown twice.
      if (insight && !seen.has(insight.adId)) {
        seen.add(insight.adId);
        insights.push(insight);
      }
    }

    const pagination = readPagination(body);

    if (!pagination.hasNext) {
      return insights;
    }

    if (!pagination.after) {
      throw new MetaCampaignsApiError(
        "Meta returned another ads page without a usable cursor",
      );
    }

    after = pagination.after;
    await delay(REQUEST_DELAY_MS);
  }

  // Never report a truncated breakdown as if it were the whole campaign.
  throw new MetaCampaignsApiError(
    "Meta returned more ad pages than this request reads",
  );
}

/**
 * Campaign-level spend for the same window as getAdLevelInsights. Kept here so
 * the threshold comparison and the breakdown it explains always read the same
 * date_preset; the ad rows are not summed because ads deleted mid-campaign keep
 * their spend on the campaign total but drop out of the /ads edge.
 */
export async function getCampaignTotalSpend(
  campaignId: string,
  datePreset?: string,
): Promise<number> {
  const id = assertCampaignId(campaignId);
  const preset = assertDatePreset(datePreset);
  const body = await metaGet(`${id}/insights`, {
    fields: "spend",
    date_preset: preset,
  });
  const data = body.data;

  if (!Array.isArray(data)) {
    throw new MetaCampaignsApiError("Meta API returned an invalid list response");
  }

  // An empty row set means the campaign never delivered in the window, which is
  // a real zero rather than missing data.
  if (data.length === 0) {
    return 0;
  }

  const row = data[0];

  if (!isJsonRecord(row)) {
    throw new MetaCampaignsApiError("Meta returned an invalid insight row");
  }

  const spend = toOptionalMetricNumber(row.spend);

  if (spend === null) {
    throw new MetaCampaignsApiError("Meta returned an invalid campaign spend");
  }

  return spend;
}

function normalizeAd(value: unknown): AdLevelInsight | null {
  if (!isJsonRecord(value)) {
    throw new MetaCampaignsApiError("Meta returned an invalid ad");
  }

  const adId = toNonEmptyString(value.id);

  if (!adId) {
    return null;
  }

  const row = readInsightRow(value.insights);

  if (!row) {
    // An ad that never delivered carries no insights edge at all. Report it with
    // a real zero instead of dropping it from the breakdown.
    return {
      adId,
      adName: toNonEmptyString(value.name) ?? adId,
      spend: 0,
      purchases: 0,
      costPerPurchase: null,
    };
  }

  const actions = normalizeActionValues(row.actions);
  const costsPerAction = normalizeActionValues(row.cost_per_action_type);
  const purchaseActionType = PURCHASE_ACTION_TYPES.find((actionType) =>
    actions.has(actionType),
  );
  const purchases = purchaseActionType
    ? (actions.get(purchaseActionType) ?? 0)
    : 0;

  return {
    adId,
    adName: toNonEmptyString(value.name) ?? adId,
    spend: toOptionalMetricNumber(row.spend) ?? 0,
    purchases,
    costPerPurchase:
      purchaseActionType && purchases > 0
        ? (costsPerAction.get(purchaseActionType) ?? null)
        : null,
  };
}

function readInsightRow(value: unknown): JsonRecord | null {
  if (!isJsonRecord(value) || !Array.isArray(value.data) || !value.data.length) {
    return null;
  }

  const row = value.data[0];

  return isJsonRecord(row) ? row : null;
}

function normalizeActionValues(value: unknown) {
  const values = new Map<string, number>();

  if (!Array.isArray(value)) {
    return values;
  }

  for (const rawAction of value) {
    if (!isJsonRecord(rawAction)) {
      continue;
    }

    const actionType = toNonEmptyString(rawAction.action_type);
    const metricValue = toOptionalMetricNumber(rawAction.value);

    if (actionType && metricValue !== null) {
      values.set(actionType, metricValue);
    }
  }

  return values;
}

async function metaGet(
  path: string,
  parameters: Record<string, string>,
): Promise<JsonRecord> {
  const url = new URL(`${META_GRAPH_BASE_URL}/${path}`);

  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, value);
  }

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${getAccessToken()}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Never surface the raw error: the request URL and headers carry the token.
    throw new MetaCampaignsApiError("Meta API request could not be completed");
  }

  const body = await readJson(response);
  const metaErrorCode = readMetaErrorCode(body);

  if (
    response.status === 429 ||
    (metaErrorCode !== null && RATE_LIMIT_ERROR_CODES.has(metaErrorCode))
  ) {
    throw new MetaAdInsightsRateLimitError();
  }

  if (!response.ok) {
    throw new MetaCampaignsApiError(
      `Meta API request failed (HTTP ${response.status}, code ${metaErrorCode ?? "unknown"})`,
    );
  }

  if (!isJsonRecord(body)) {
    throw new MetaCampaignsApiError("Meta API returned an invalid response");
  }

  return body;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    if (response.ok) {
      throw new MetaCampaignsApiError("Meta API returned an invalid response");
    }

    return null;
  }
}

function readPagination(body: JsonRecord) {
  const paging = isJsonRecord(body.paging) ? body.paging : null;
  const cursors = paging && isJsonRecord(paging.cursors) ? paging.cursors : null;
  const next = paging ? paging.next : undefined;

  return {
    hasNext: typeof next === "string" && next.length > 0,
    after: cursors ? toNonEmptyString(cursors.after) : null,
  };
}

function readMetaErrorCode(value: unknown) {
  if (!isJsonRecord(value) || !isJsonRecord(value.error)) {
    return null;
  }

  return typeof value.error.code === "number" ? value.error.code : null;
}

function getAccessToken() {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    throw new MetaCampaignsConfigError("META_ACCESS_TOKEN is not configured");
  }

  return accessToken;
}

function assertCampaignId(campaignId: string) {
  const id = campaignId?.trim();

  // Meta campaign ids are numeric. Rejecting anything else keeps a stored value
  // from reshaping the request path.
  if (!id || !/^\d+$/.test(id)) {
    throw new MetaCampaignsConfigError("Meta campaign id must be numeric");
  }

  return id;
}

function assertDatePreset(datePreset?: string) {
  const preset = datePreset?.trim() || DEFAULT_DATE_PRESET;

  if (!DATE_PRESETS.has(preset)) {
    throw new MetaCampaignsConfigError(
      `Meta date_preset "${preset}" is not supported by Graph ${META_GRAPH_VERSION}`,
    );
  }

  return preset;
}

function toOptionalMetricNumber(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
