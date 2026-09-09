import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CampaignDetail } from "@/components/command-center/CampaignDetail";
import { DateRangeSelector } from "@/components/command-center/DateRangeSelector";
import {
  fetchMetaCampaignMetrics,
  type FetchMetaCampaignMetricsResult,
} from "@/lib/meta/fetchMetaCampaigns";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  range?: string | string[];
  from?: string | string[];
  to?: string | string[];
  estado?: string | string[];
};

type CampaignDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

type MetaCampaignDetailRow = {
  id: string;
  ad_account_id: string;
  nombre: string;
  estado: string;
  objetivo: string | null;
  pais: string | null;
  moneda: string | null;
  producto_base: string | null;
  actualizado_en: string;
};

type MetaCampaignsTableDefinition = {
  Row: MetaCampaignDetailRow;
  Insert: Partial<MetaCampaignDetailRow> & { id: string };
  Update: Partial<MetaCampaignDetailRow>;
  Relationships: [];
};

type MetaCampaignsDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      meta_campaigns: MetaCampaignsTableDefinition;
    };
  };
};

const VALID_RANGES = new Set(["7", "30", "90"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_RANGE = "7";
const BUSINESS_TIME_ZONE = "America/Bogota";

function getMetaCampaignsClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  return supabase as unknown as SupabaseClient<MetaCampaignsDatabase>;
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getTodayInput() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const getPart = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function parseDateInput(value: string | undefined) {
  if (!value || !DATE_PATTERN.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && formatDateInput(date) === value
    ? date
    : null;
}

function getPresetDateRange(days: number) {
  const dateTo = getTodayInput();
  const dateFrom = new Date(`${dateTo}T00:00:00Z`);
  dateFrom.setUTCDate(dateFrom.getUTCDate() - Math.max(days - 1, 0));

  return {
    dateFrom: formatDateInput(dateFrom),
    dateTo,
  };
}

function getSelectedDateRange(params: SearchParams) {
  const requestedRange = getSingleParam(params.range);
  const customFrom = parseDateInput(getSingleParam(params.from));
  const customTo = parseDateInput(getSingleParam(params.to));

  if (
    requestedRange === "custom" &&
    customFrom &&
    customTo &&
    customFrom.getTime() <= customTo.getTime()
  ) {
    return {
      currentRange: "custom",
      dateFrom: formatDateInput(customFrom),
      dateTo: formatDateInput(customTo),
    };
  }

  const currentRange =
    requestedRange && VALID_RANGES.has(requestedRange)
      ? requestedRange
      : DEFAULT_RANGE;

  return {
    currentRange,
    ...getPresetDateRange(Number(currentRange)),
  };
}

async function loadLiveMetrics(dateFrom: string, dateTo: string) {
  try {
    return {
      result: await fetchMetaCampaignMetrics(dateFrom, dateTo),
      errorMessage: null,
    };
  } catch (error) {
    console.error(
      "Failed to load live Meta campaign detail metrics",
      error instanceof Error ? error.name : "UnknownError",
    );

    return {
      result: null,
      errorMessage:
        "No se pudieron consultar las métricas en vivo de Meta para este rango.",
    };
  }
}

function getMetricsPartialMessage(
  metrics: FetchMetaCampaignMetricsResult | null,
  loadError: string | null,
) {
  if (loadError) {
    return loadError;
  }

  if (!metrics?.partial) {
    return null;
  }

  return metrics.rateLimitDetected
    ? "Meta alcanzó un límite de uso; las métricas visibles pueden estar incompletas."
    : "Meta no entregó todas las páginas de insights; las métricas visibles pueden estar incompletas.";
}

function getBackHref(status: string | undefined) {
  if (!status) {
    return "/command-center/campanias";
  }

  const params = new URLSearchParams({ estado: status });
  return `/command-center/campanias?${params.toString()}`;
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: CampaignDetailPageProps) {
  const [{ id: requestedId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const campaignId = requestedId.trim();

  if (!/^\d+$/.test(campaignId)) {
    notFound();
  }

  const rawSupabase = await createClient();
  const supabase = getMetaCampaignsClient(rawSupabase);
  const { data: campaign, error: campaignError } = await supabase
    .from("meta_campaigns")
    .select(
      "id,ad_account_id,nombre,estado,objetivo,pais,moneda,producto_base,actualizado_en",
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError) {
    throw new Error(
      `No se pudo cargar la campaña: ${campaignError.message}`,
    );
  }

  if (!campaign) {
    notFound();
  }

  const { currentRange, dateFrom, dateTo } =
    getSelectedDateRange(resolvedSearchParams);
  const liveMetrics = await loadLiveMetrics(dateFrom, dateTo);
  const metric =
    liveMetrics.result?.metrics.find(
      (candidate) => candidate.campaignId === campaignId,
    ) ?? null;
  const metricsPartialMessage = getMetricsPartialMessage(
    liveMetrics.result,
    liveMetrics.errorMessage,
  );
  const status = getSingleParam(resolvedSearchParams.estado);

  return (
    <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <header className="border-b border-[var(--color-border-subtle)] pb-5">
        <Link
          href={getBackHref(status)}
          className="inline-flex items-center gap-2 rounded-lg font-body text-sm font-semibold text-[var(--color-accent)] outline-none transition-colors duration-[var(--motion-duration-hover-focus)] hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a campañas
        </Link>

        <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Detalle de campaña · Meta Ads
            </p>
            <h1 className="mt-2 truncate font-display text-2xl font-semibold text-text-primary sm:text-3xl">
              {campaign.nombre}
            </h1>
            <p className="mt-1 font-mono text-xs tabular-nums text-text-secondary">
              ID {campaign.id}
            </p>
          </div>

          <DateRangeSelector
            currentRange={currentRange}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </div>
      </header>

      <div className="mt-6">
        <CampaignDetail
          campaign={campaign}
          metric={metric}
          dateFrom={dateFrom}
          dateTo={dateTo}
          metricsComplete={liveMetrics.result?.metricsComplete ?? false}
          metricsPartialMessage={metricsPartialMessage}
        />
      </div>
    </section>
  );
}
