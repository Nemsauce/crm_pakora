import type { SupabaseClient } from "@supabase/supabase-js";

import { DateRangeSelector } from "@/components/command-center/DateRangeSelector";
import {
  MetaCampaignsTable,
  type MetaCampaignRow,
} from "@/components/command-center/MetaCampaignsTable";
import { RefreshMetaCampaignsButton } from "@/components/command-center/RefreshMetaCampaignsButton";
import {
  fetchMetaCampaignMetrics,
  type FetchMetaCampaignMetricsResult,
} from "@/lib/meta/fetchMetaCampaigns";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  range?: string;
  from?: string;
  to?: string;
};

type CampaignsPageProps = {
  searchParams: Promise<SearchParams>;
};

type MetaCampaignsTableDefinition = {
  Row: MetaCampaignRow;
  Insert: {
    id: string;
    ad_account_id: string;
    nombre: string;
    estado: string;
    objetivo?: string | null;
    pais?: string | null;
    moneda?: string | null;
    producto_base?: string | null;
    actualizado_en?: string;
  };
  Update: Partial<MetaCampaignRow>;
  Relationships: [];
};

type MetaCampaignsDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      meta_campaigns: MetaCampaignsTableDefinition;
    };
  };
};

const validRanges = new Set(["7", "30", "90"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_RANGE = "7";
const BUSINESS_TIME_ZONE = "America/Bogota";

function getMetaCampaignsClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  return supabase as unknown as SupabaseClient<MetaCampaignsDatabase>;
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
  const customFrom = parseDateInput(params.from);
  const customTo = parseDateInput(params.to);

  if (
    params.range === "custom" &&
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
    params.range && validRanges.has(params.range)
      ? params.range
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
      "Failed to load live Meta campaign metrics",
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

export default async function CommandCenterCampaignsPage({
  searchParams,
}: CampaignsPageProps) {
  const params = await searchParams;
  const { currentRange, dateFrom, dateTo } = getSelectedDateRange(params);
  const rawSupabase = await createClient();
  const supabase = getMetaCampaignsClient(rawSupabase);
  const [campaignsResult, productsResult, liveMetrics] = await Promise.all([
    supabase
      .from("meta_campaigns")
      .select(
        "id,ad_account_id,nombre,estado,objetivo,pais,moneda,producto_base,actualizado_en",
      )
      .order("nombre", { ascending: true }),
    rawSupabase.rpc("product_order_summary"),
    loadLiveMetrics(dateFrom, dateTo),
  ]);

  if (campaignsResult.error) {
    throw new Error(
      `No se pudieron cargar las campañas: ${campaignsResult.error.message}`,
    );
  }

  if (productsResult.error) {
    throw new Error(
      `No se pudieron cargar los productos base: ${productsResult.error.message}`,
    );
  }

  const productOptions = [
    ...new Set(
      (productsResult.data ?? [])
        .map((row) => row.nombre_producto.trim())
        .filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right, "es"));
  const metricsPartialMessage = getMetricsPartialMessage(
    liveMetrics.result,
    liveMetrics.errorMessage,
  );

  return (
    <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-[var(--color-border-subtle)] pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            Torre de control
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            Campañas
          </h1>
          <p className="mt-2 max-w-3xl font-body text-sm text-text-secondary">
            Rendimiento consultado en vivo para el rango elegido. Compras y CPA
            son conversiones que el pixel de Meta atribuye, no ventas reales
            confirmadas por el CRM.
          </p>
          <p className="mt-2 font-mono text-xs tabular-nums text-text-secondary">
            {dateFrom} - {dateTo}
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end xl:flex-col xl:items-end">
          <RefreshMetaCampaignsButton />
          <DateRangeSelector
            currentRange={currentRange}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </div>
      </div>

      <div className="mt-6">
        <MetaCampaignsTable
          campaigns={campaignsResult.data ?? []}
          metrics={liveMetrics.result?.metrics ?? []}
          productOptions={productOptions}
          dateFrom={dateFrom}
          dateTo={dateTo}
          metricsComplete={liveMetrics.result?.metricsComplete ?? false}
          metricsPartialMessage={metricsPartialMessage}
        />
      </div>
    </section>
  );
}
