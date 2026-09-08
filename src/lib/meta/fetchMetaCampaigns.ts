import "server-only";

const META_GRAPH_VERSION = "v21.0";
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const DEFAULT_AD_ACCOUNT_ID = "act_1930695100907866";
const PAGE_LIMIT = 200;
const REQUEST_DELAY_MS = 250;
const REQUEST_TIMEOUT_MS = 30_000;
const RATE_LIMIT_USAGE_THRESHOLD = 90;
const RATE_LIMIT_ERROR_CODES = new Set([
  4, 17, 32, 613, 80_000, 80_001, 80_002, 80_003, 80_004, 80_005, 80_006,
  80_008, 80_009, 80_014,
]);
const PURCHASE_ACTION_TYPES = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
] as const;

type JsonRecord = Record<string, unknown>;

type MetaRequestContext = {
  accessToken: string;
  apiCalls: number;
  maxObservedUsagePercent: number | null;
  rateLimitDetected: boolean;
  stopRequested: boolean;
  warnings: string[];
};

type MetaPage<T> = {
  data: T[];
  paging?: {
    cursors?: {
      after?: string;
    };
    next?: string;
  };
};

type MetaCampaignApiRow = {
  id: string;
  name: string;
  status: string;
  objective?: string;
};

type MetaActionApiRow = {
  action_type?: unknown;
  value?: unknown;
};

type MetaInsightApiRow = {
  campaign_id?: unknown;
  spend?: unknown;
  impressions?: unknown;
  clicks?: unknown;
  reach?: unknown;
  cpc?: unknown;
  ctr?: unknown;
  actions?: unknown;
  cost_per_action_type?: unknown;
  date_start?: unknown;
  date_stop?: unknown;
};

export type MetaPurchaseActionType = (typeof PURCHASE_ACTION_TYPES)[number];

export type MetaCampaignSnapshot = {
  id: string;
  adAccountId: string;
  nombre: string;
  estado: string;
  objetivo: string | null;
};

export type MetaCampaignMetrics = {
  campaignId: string;
  gasto: number;
  impresiones: number;
  clics: number;
  alcance: number;
  compras: number;
  cpa: number | null;
  cpc: number | null;
  ctr: number | null;
  purchaseActionType: MetaPurchaseActionType | null;
  dateStart: string;
  dateStop: string;
};

type MetaRequestResult = {
  adAccountId: string;
  apiCalls: number;
  maxObservedUsagePercent: number | null;
  partial: boolean;
  rateLimitDetected: boolean;
  warnings: string[];
};

export type FetchMetaCampaignsResult = MetaRequestResult & {
  currency: string | null;
  campaigns: MetaCampaignSnapshot[];
  campaignsComplete: boolean;
};

export type FetchMetaCampaignMetricsResult = MetaRequestResult & {
  dateFrom: string;
  dateTo: string;
  metrics: MetaCampaignMetrics[];
  metricsComplete: boolean;
};

export class MetaCampaignsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaCampaignsConfigError";
  }
}

export class MetaCampaignsApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaCampaignsApiError";
  }
}

/**
 * Fetches durable campaign identity data for persistence. Metrics deliberately
 * live in fetchMetaCampaignMetrics so the stored catalog never goes stale.
 */
export async function fetchMetaCampaigns(): Promise<FetchMetaCampaignsResult> {
  const context = createRequestContext();
  const adAccountId = getAdAccountId();
  const campaignResult = await fetchCampaignPages(context, adAccountId);
  let currency: string | null = null;
  let currencyComplete = false;

  if (!context.stopRequested) {
    const account = await metaGet<JsonRecord>(context, adAccountId, {
      fields: "currency",
    });

    if (account) {
      currency = toNonEmptyString(account.currency);

      if (!currency) {
        throw new MetaCampaignsApiError(
          "Meta did not return the ad account currency",
        );
      }

      currencyComplete = true;
    }
  }

  const campaigns = campaignResult.campaigns.map((campaign) => ({
    id: campaign.id,
    adAccountId,
    nombre: campaign.name,
    estado: campaign.status,
    objetivo: campaign.objective ?? null,
  }));
  const partial = !campaignResult.complete || !currencyComplete;

  addRateLimitPartialWarning(context, partial, "campaign catalog");

  return {
    adAccountId,
    currency,
    campaigns,
    campaignsComplete: campaignResult.complete,
    apiCalls: context.apiCalls,
    maxObservedUsagePercent: context.maxObservedUsagePercent,
    partial,
    rateLimitDetected: context.rateLimitDetected,
    warnings: context.warnings,
  };
}

/**
 * Fetches a live, aggregate insight row per campaign for an exact inclusive
 * date range. The result is not intended to be persisted.
 */
export async function fetchMetaCampaignMetrics(
  dateFrom: string,
  dateTo: string,
): Promise<FetchMetaCampaignMetricsResult> {
  validateDateRange(dateFrom, dateTo);

  const context = createRequestContext();
  const adAccountId = getAdAccountId();
  const insightResult = await fetchInsightPages(
    context,
    adAccountId,
    dateFrom,
    dateTo,
  );
  const partial = !insightResult.complete;

  addRateLimitPartialWarning(context, partial, "campaign insights");

  return {
    adAccountId,
    dateFrom,
    dateTo,
    metrics: Array.from(insightResult.metrics.values()),
    metricsComplete: insightResult.complete,
    apiCalls: context.apiCalls,
    maxObservedUsagePercent: context.maxObservedUsagePercent,
    partial,
    rateLimitDetected: context.rateLimitDetected,
    warnings: context.warnings,
  };
}

async function fetchCampaignPages(
  context: MetaRequestContext,
  adAccountId: string,
) {
  const campaigns = new Map<string, MetaCampaignApiRow>();
  let after: string | null = null;
  let complete = false;

  while (!context.stopRequested) {
    const page = await metaGet<MetaPage<unknown>>(
      context,
      `${adAccountId}/campaigns`,
      {
        fields: "id,name,status,objective",
        effective_status: JSON.stringify(["ACTIVE", "PAUSED", "ARCHIVED"]),
        limit: String(PAGE_LIMIT),
        ...(after ? { after } : {}),
      },
    );

    if (!page) {
      break;
    }

    for (const rawCampaign of normalizePageData(page)) {
      const campaign = normalizeCampaign(rawCampaign);
      campaigns.set(campaign.id, campaign);
    }

    const pagination = readPagination(page);

    if (!pagination.hasNext) {
      complete = true;
      break;
    }

    if (!pagination.after) {
      addWarning(
        context,
        "Meta returned another campaign page without a usable cursor; campaign results are partial.",
      );
      break;
    }

    after = pagination.after;
  }

  return { campaigns: Array.from(campaigns.values()), complete };
}

async function fetchInsightPages(
  context: MetaRequestContext,
  adAccountId: string,
  dateFrom: string,
  dateTo: string,
) {
  const metrics = new Map<string, MetaCampaignMetrics>();
  let after: string | null = null;
  let complete = false;

  while (!context.stopRequested) {
    const page = await metaGet<MetaPage<unknown>>(
      context,
      `${adAccountId}/insights`,
      {
        level: "campaign",
        fields:
          "campaign_id,spend,impressions,clicks,reach,cpc,ctr,actions,cost_per_action_type,date_start,date_stop",
        action_breakdowns: "action_type",
        time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
        time_increment: "all_days",
        limit: String(PAGE_LIMIT),
        ...(after ? { after } : {}),
      },
    );

    if (!page) {
      break;
    }

    for (const rawInsight of normalizePageData(page)) {
      const insight = normalizeInsight(rawInsight, dateFrom, dateTo);

      if (insight) {
        metrics.set(insight.campaignId, insight);
      }
    }

    const pagination = readPagination(page);

    if (!pagination.hasNext) {
      complete = true;
      break;
    }

    if (!pagination.after) {
      addWarning(
        context,
        "Meta returned another insights page without a usable cursor; insight results are partial.",
      );
      break;
    }

    after = pagination.after;
  }

  return { metrics, complete };
}

async function metaGet<T>(
  context: MetaRequestContext,
  path: string,
  parameters: Record<string, string>,
): Promise<T | null> {
  if (context.stopRequested) {
    return null;
  }

  if (context.apiCalls > 0) {
    await delay(REQUEST_DELAY_MS);
  }

  const url = new URL(`${META_GRAPH_BASE_URL}/${path}`);

  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, value);
  }

  context.apiCalls += 1;

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${context.accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new MetaCampaignsApiError(
      "Meta API request could not be completed",
    );
  }

  inspectUsageHeaders(context, response.headers);
  const body = await readJson(response);
  const metaErrorCode = readMetaErrorCode(body);

  if (
    response.status === 429 ||
    (metaErrorCode !== null && RATE_LIMIT_ERROR_CODES.has(metaErrorCode))
  ) {
    context.rateLimitDetected = true;
    context.stopRequested = true;
    addWarning(
      context,
      "Meta rejected a request because of rate limiting; no further API requests were made.",
    );
    return null;
  }

  if (!response.ok) {
    throw new MetaCampaignsApiError(
      `Meta API request failed (HTTP ${response.status}, code ${metaErrorCode ?? "unknown"})`,
    );
  }

  if (!isJsonRecord(body)) {
    throw new MetaCampaignsApiError("Meta API returned an invalid response");
  }

  return body as T;
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

function createRequestContext(): MetaRequestContext {
  return {
    accessToken: getAccessToken(),
    apiCalls: 0,
    maxObservedUsagePercent: null,
    rateLimitDetected: false,
    stopRequested: false,
    warnings: [],
  };
}

function inspectUsageHeaders(context: MetaRequestContext, headers: Headers) {
  const usagePercentages = [
    readUsagePercentage(headers.get("x-app-usage")),
    readUsagePercentage(headers.get("x-ad-account-usage")),
    readUsagePercentage(headers.get("x-business-use-case-usage")),
  ].filter((value): value is number => value !== null);

  if (usagePercentages.length === 0) {
    return;
  }

  const highestUsage = Math.max(...usagePercentages);
  context.maxObservedUsagePercent = Math.max(
    context.maxObservedUsagePercent ?? 0,
    highestUsage,
  );

  if (highestUsage >= RATE_LIMIT_USAGE_THRESHOLD) {
    context.rateLimitDetected = true;
    context.stopRequested = true;
    addWarning(
      context,
      "Meta API usage is near its limit; no further API requests were made.",
    );
  }
}

function readUsagePercentage(rawHeader: string | null): number | null {
  if (!rawHeader) {
    return null;
  }

  let value: unknown;

  try {
    value = JSON.parse(rawHeader);
  } catch {
    return null;
  }

  const percentages: number[] = [];
  collectUsagePercentages(value, percentages);

  return percentages.length > 0 ? Math.max(...percentages) : null;
}

function collectUsagePercentages(value: unknown, percentages: number[]) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectUsagePercentages(item, percentages);
    }

    return;
  }

  if (!isJsonRecord(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (
      (key === "call_count" ||
        key === "total_cputime" ||
        key === "total_time" ||
        key === "acc_id_util_pct") &&
      typeof nestedValue === "number" &&
      Number.isFinite(nestedValue)
    ) {
      percentages.push(nestedValue);
    } else if (isJsonRecord(nestedValue) || Array.isArray(nestedValue)) {
      collectUsagePercentages(nestedValue, percentages);
    }
  }
}

function normalizePageData(page: MetaPage<unknown>) {
  if (!Array.isArray(page.data)) {
    throw new MetaCampaignsApiError("Meta API returned an invalid list response");
  }

  return page.data;
}

function normalizeCampaign(value: unknown): MetaCampaignApiRow {
  if (!isJsonRecord(value)) {
    throw new MetaCampaignsApiError("Meta returned an invalid campaign");
  }

  const id = toNonEmptyString(value.id);
  const name = toNonEmptyString(value.name);
  const status = toNonEmptyString(value.status);

  if (!id || !name || !status) {
    throw new MetaCampaignsApiError("Meta returned an incomplete campaign");
  }

  return {
    id,
    name,
    status,
    objective: toNonEmptyString(value.objective) ?? undefined,
  };
}

function normalizeInsight(
  value: unknown,
  requestedDateFrom: string,
  requestedDateTo: string,
): MetaCampaignMetrics | null {
  if (!isJsonRecord(value)) {
    throw new MetaCampaignsApiError("Meta returned an invalid insight row");
  }

  const insight = value as MetaInsightApiRow;
  const campaignId = toNonEmptyString(insight.campaign_id);

  if (!campaignId) {
    return null;
  }

  const actions = normalizeActionValues(insight.actions);
  const costsPerAction = normalizeActionValues(insight.cost_per_action_type);
  const purchaseActionType = PURCHASE_ACTION_TYPES.find(
    (actionType) => actions.has(actionType),
  );

  return {
    campaignId,
    gasto: toMetricNumber(insight.spend),
    impresiones: toMetricNumber(insight.impressions),
    clics: toMetricNumber(insight.clicks),
    alcance: toMetricNumber(insight.reach),
    compras: purchaseActionType ? (actions.get(purchaseActionType) ?? 0) : 0,
    cpa: purchaseActionType
      ? (costsPerAction.get(purchaseActionType) ?? null)
      : null,
    cpc: toOptionalMetricNumber(insight.cpc),
    ctr: toOptionalMetricNumber(insight.ctr),
    purchaseActionType: purchaseActionType ?? null,
    dateStart: toValidDateString(insight.date_start) ?? requestedDateFrom,
    dateStop: toValidDateString(insight.date_stop) ?? requestedDateTo,
  };
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

    const action = rawAction as MetaActionApiRow;
    const actionType = toNonEmptyString(action.action_type);
    const metricValue = toOptionalMetricNumber(action.value);

    if (actionType && metricValue !== null) {
      values.set(actionType, metricValue);
    }
  }

  return values;
}

function readPagination(page: MetaPage<unknown>) {
  const hasNext =
    typeof page.paging?.next === "string" && page.paging.next.length > 0;
  const after = toNonEmptyString(page.paging?.cursors?.after);

  return { hasNext, after };
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

function getAdAccountId() {
  const configured =
    process.env.META_AD_ACCOUNT_ID?.trim() || DEFAULT_AD_ACCOUNT_ID;
  const normalized = /^\d+$/.test(configured) ? `act_${configured}` : configured;

  if (!/^act_\d+$/.test(normalized)) {
    throw new MetaCampaignsConfigError(
      "META_AD_ACCOUNT_ID must use the act_XXXXXXXX format",
    );
  }

  return normalized;
}

function validateDateRange(dateFrom: string, dateTo: string) {
  if (!toValidDateString(dateFrom) || !toValidDateString(dateTo)) {
    throw new MetaCampaignsConfigError(
      "Meta insight dates must use the YYYY-MM-DD format",
    );
  }

  if (dateFrom > dateTo) {
    throw new MetaCampaignsConfigError(
      "Meta insight start date cannot be after the end date",
    );
  }
}

function toValidDateString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return value;
}

function toMetricNumber(value: unknown) {
  return toOptionalMetricNumber(value) ?? 0;
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

function addRateLimitPartialWarning(
  context: MetaRequestContext,
  partial: boolean,
  dataKind: string,
) {
  if (partial && context.rateLimitDetected) {
    addWarning(
      context,
      `Meta rate limiting interrupted the ${dataKind}; the returned data is partial.`,
    );
  }
}

function addWarning(context: MetaRequestContext, warning: string) {
  if (!context.warnings.includes(warning)) {
    context.warnings.push(warning);
  }
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
