import "server-only";

const META_GRAPH_VERSION = "v21.0";
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const DEFAULT_AD_ACCOUNT_ID = "act_1930695100907866";
const DEFAULT_INSIGHT_TIME_ZONE = "America/Bogota";
const PAGE_LIMIT = 200;
const REQUEST_DELAY_MS = 250;
const REQUEST_TIMEOUT_MS = 30_000;
const RATE_LIMIT_USAGE_THRESHOLD = 90;
const RATE_LIMIT_ERROR_CODES = new Set([
  4, 17, 32, 613, 80_000, 80_001, 80_002, 80_003, 80_004, 80_005, 80_006,
  80_008, 80_009, 80_014,
]);

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

type MetaInsightApiRow = {
  campaign_id: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
};

export type MetaCampaignCountry = "CO" | "MX";

export type MetaCampaignInsight = {
  gasto: number;
  impresiones: number;
  clics: number;
  alcance: number;
};

export type MetaCampaignSnapshot = {
  id: string;
  adAccountId: string;
  nombre: string;
  estado: string;
  objetivo: string | null;
  pais: MetaCampaignCountry | null;
  insight: MetaCampaignInsight | null;
};

export type FetchMetaCampaignsResult = {
  adAccountId: string;
  currency: string | null;
  campaigns: MetaCampaignSnapshot[];
  insightsFetched: number;
  insightDesde: string;
  insightHasta: string;
  campaignsComplete: boolean;
  insightsComplete: boolean;
  apiCalls: number;
  maxObservedUsagePercent: number | null;
  partial: boolean;
  rateLimitDetected: boolean;
  warnings: string[];
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

export async function fetchMetaCampaigns(
  now = new Date(),
): Promise<FetchMetaCampaignsResult> {
  const context: MetaRequestContext = {
    accessToken: getAccessToken(),
    apiCalls: 0,
    maxObservedUsagePercent: null,
    rateLimitDetected: false,
    stopRequested: false,
    warnings: [],
  };
  const adAccountId = getAdAccountId();
  let { desde, hasta } = getLastThirtyDays(
    now,
    DEFAULT_INSIGHT_TIME_ZONE,
  );
  const campaignResult = await fetchCampaignPages(context, adAccountId);

  let currency: string | null = null;
  let currencyComplete = false;

  if (!context.stopRequested) {
    const account = await metaGet<JsonRecord>(context, adAccountId, {
      fields: "currency,timezone_name",
    });

    if (account) {
      currency = toNonEmptyString(account.currency);

      if (!currency) {
        throw new MetaCampaignsApiError(
          "Meta did not return the ad account currency",
        );
      }

      currencyComplete = true;

      const accountTimeZone = toNonEmptyString(account.timezone_name);

      if (accountTimeZone) {
        ({ desde, hasta } = getLastThirtyDays(now, accountTimeZone));
      }
    }
  }

  let insights = new Map<string, MetaCampaignInsight>();
  let insightsComplete = campaignResult.campaigns.length === 0;

  if (campaignResult.campaigns.length > 0 && !context.stopRequested) {
    const insightResult = await fetchInsightPages(
      context,
      adAccountId,
      desde,
      hasta,
    );
    insights = insightResult.insights;
    insightsComplete = insightResult.complete;
  }

  const campaigns = campaignResult.campaigns.map((campaign) => ({
    id: campaign.id,
    adAccountId,
    nombre: campaign.name,
    estado: campaign.status,
    objetivo: campaign.objective ?? null,
    pais: inferMetaCampaignCountry(campaign.name),
    insight:
      insights.get(campaign.id) ??
      (insightsComplete
        ? { gasto: 0, impresiones: 0, clics: 0, alcance: 0 }
        : null),
  }));
  const partial =
    !campaignResult.complete || !currencyComplete || !insightsComplete;

  if (partial && context.rateLimitDetected) {
    addWarning(
      context,
      "Meta rate limiting interrupted the sync; available data was kept and missing insights should retain their previous values.",
    );
  }

  return {
    adAccountId,
    currency,
    campaigns,
    insightsFetched: insights.size,
    insightDesde: desde,
    insightHasta: hasta,
    campaignsComplete: campaignResult.complete,
    insightsComplete,
    apiCalls: context.apiCalls,
    maxObservedUsagePercent: context.maxObservedUsagePercent,
    partial,
    rateLimitDetected: context.rateLimitDetected,
    warnings: context.warnings,
  };
}

export function inferMetaCampaignCountry(
  campaignName: string,
): MetaCampaignCountry | null {
  const match = campaignName.trim().match(/^(MEX|COL)(?=$|[\s_-])/i);

  if (!match) {
    return null;
  }

  return match[1].toUpperCase() === "MEX" ? "MX" : "CO";
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
  desde: string,
  hasta: string,
) {
  const insights = new Map<string, MetaCampaignInsight>();
  let after: string | null = null;
  let complete = false;

  while (!context.stopRequested) {
    const page = await metaGet<MetaPage<unknown>>(
      context,
      `${adAccountId}/insights`,
      {
        level: "campaign",
        fields: "campaign_id,spend,impressions,clicks,reach",
        time_range: JSON.stringify({ since: desde, until: hasta }),
        limit: String(PAGE_LIMIT),
        ...(after ? { after } : {}),
      },
    );

    if (!page) {
      break;
    }

    for (const rawInsight of normalizePageData(page)) {
      const insight = normalizeInsight(rawInsight);

      if (insight) {
        insights.set(insight.campaignId, insight.metrics);
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

  return { insights, complete };
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
    (metaErrorCode !== null && RATE_LIMIT_ERROR_CODES.has(metaErrorCode)) ||
    (context.rateLimitDetected && !response.ok)
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
      "Meta API usage is near its limit; the sync stopped before making another request.",
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

function normalizeInsight(value: unknown) {
  if (!isJsonRecord(value)) {
    throw new MetaCampaignsApiError("Meta returned an invalid insight row");
  }

  const campaignId = toNonEmptyString(value.campaign_id);

  if (!campaignId) {
    return null;
  }

  const insight = value as MetaInsightApiRow;

  return {
    campaignId,
    metrics: {
      gasto: toMetricNumber(insight.spend),
      impresiones: toMetricNumber(insight.impressions),
      clics: toMetricNumber(insight.clicks),
      alcance: toMetricNumber(insight.reach),
    },
  };
}

function readPagination(page: MetaPage<unknown>) {
  const hasNext =
    typeof page.paging?.next === "string" && page.paging.next.length > 0;
  let after = toNonEmptyString(page.paging?.cursors?.after);

  if (!after && hasNext) {
    try {
      after = new URL(page.paging!.next!).searchParams.get("after");
    } catch {
      after = null;
    }
  }

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

function getLastThirtyDays(now: Date, timeZone: string) {
  if (Number.isNaN(now.getTime())) {
    throw new MetaCampaignsConfigError("The insight reference date is invalid");
  }

  let calendarParts: Intl.DateTimeFormatPart[];

  try {
    calendarParts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  } catch {
    throw new MetaCampaignsApiError(
      "Meta returned an invalid ad account timezone",
    );
  }

  const year = getCalendarPart(calendarParts, "year");
  const month = getCalendarPart(calendarParts, "month");
  const day = getCalendarPart(calendarParts, "day");
  const until = new Date(Date.UTC(year, month - 1, day));
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - 29);

  return {
    desde: since.toISOString().slice(0, 10),
    hasta: until.toISOString().slice(0, 10),
  };
}

function getCalendarPart(
  parts: Intl.DateTimeFormatPart[],
  type: "year" | "month" | "day",
) {
  const value = Number(parts.find((part) => part.type === type)?.value);

  if (!Number.isInteger(value)) {
    throw new MetaCampaignsApiError(
      "Meta returned an invalid ad account timezone",
    );
  }

  return value;
}

function toMetricNumber(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function toNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addWarning(context: MetaRequestContext, warning: string) {
  if (!context.warnings.includes(warning)) {
    context.warnings.push(warning);
  }
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
