"use client";

import { Activity, CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { saveMetaCampaignProduct } from "@/app/(app)/command-center/campanias/actions";

export type MetaCampaignRow = {
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

export type MetaCampaignMetric = {
  campaignId: string;
  gasto: number | null;
  impresiones: number | null;
  clics: number | null;
  alcance: number | null;
  compras: number | null;
  cpa: number | null;
  cpc: number | null;
  ctr: number | null;
};

export type MetaCampaignsTableProps = {
  campaigns: MetaCampaignRow[];
  metrics: MetaCampaignMetric[];
  productOptions: string[];
  dateFrom: string;
  dateTo: string;
  initialStatusFilter: string;
  metricsComplete: boolean;
  metricsPartialMessage?: string | null;
};

type AssignmentFeedback = {
  kind: "pending" | "success" | "error";
  message: string;
};

const countFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});
const resultCountFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const decimalFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const rangeDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const updatedAtFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

const statusPriority = ["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"];

const statusLabels: Record<string, string> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  ARCHIVED: "Archivada",
  DELETED: "Eliminada",
};

const statusClasses: Record<string, string> = {
  ACTIVE: "border-transparent bg-positive-bg text-positive",
  PAUSED:
    "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-base)] text-text-secondary",
  ARCHIVED:
    "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-subtle)] text-text-secondary",
  DELETED: "border-transparent bg-negative-bg text-negative",
};

function toFiniteNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatCurrency(value: number | null, currency: string | null) {
  const amount = toFiniteNumber(value);

  if (amount === null) {
    return "—";
  }

  const normalizedCurrency = currency?.trim().toUpperCase();

  if (!normalizedCurrency || !/^[A-Z]{3}$/.test(normalizedCurrency)) {
    return decimalFormatter.format(amount);
  }

  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${decimalFormatter.format(amount)} ${normalizedCurrency}`;
  }
}

function formatCount(value: number | null) {
  const count = toFiniteNumber(value);
  return count === null ? "—" : countFormatter.format(count);
}

function formatResultCount(value: number | null) {
  const count = toFiniteNumber(value);
  return count === null ? "—" : resultCountFormatter.format(count);
}

function formatPercentage(value: number | null) {
  const percentage = toFiniteNumber(value);
  return percentage === null ? "—" : `${decimalFormatter.format(percentage)} %`;
}

function getMetricTone(value: number | null, isPrimary = false) {
  return toFiniteNumber(value) === null
    ? "text-text-secondary"
    : isPrimary
      ? "text-text-primary"
      : "text-text-secondary";
}

function formatStatus(status: string) {
  const normalized = status.trim().toUpperCase();

  if (statusLabels[normalized]) {
    return statusLabels[normalized];
  }

  const readable = normalized.replaceAll("_", " ").toLocaleLowerCase("es");
  return readable
    ? `${readable.charAt(0).toLocaleUpperCase("es")}${readable.slice(1)}`
    : "Sin estado";
}

function getStatusClass(status: string) {
  return (
    statusClasses[status.trim().toUpperCase()] ??
    "border-transparent bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)]"
  );
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "No disponible"
    : updatedAtFormatter.format(date);
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMetricPeriod(dateFrom: string, dateTo: string) {
  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);

  if (!from || !to) {
    return "Rango seleccionado";
  }

  if (dateFrom === dateTo) {
    return `Métricas del ${rangeDateFormatter.format(from)}`;
  }

  return `Métricas del ${rangeDateFormatter.format(from)} al ${rangeDateFormatter.format(to)}`;
}

function ProductAssignmentSelect({
  campaignId,
  campaignName,
  currentProduct,
  productOptions,
}: {
  campaignId: string;
  campaignName: string;
  currentProduct: string | null;
  productOptions: string[];
}) {
  const [selectedProduct, setSelectedProduct] = useState(currentProduct);
  const [feedback, setFeedback] = useState<AssignmentFeedback | null>(null);
  const [isPending, startTransition] = useTransition();
  const feedbackId = `campaign-product-feedback-${campaignId}`;
  const options = useMemo(() => {
    const values = new Set(
      productOptions.map((product) => product.trim()).filter(Boolean),
    );

    if (selectedProduct) {
      values.add(selectedProduct);
    }

    return [...values].sort((left, right) =>
      left.localeCompare(right, "es", { sensitivity: "base" }),
    );
  }, [productOptions, selectedProduct]);

  function handleChange(nextValue: string) {
    const nextProduct = nextValue || null;
    const previousProduct = selectedProduct;

    if (nextProduct === previousProduct) {
      return;
    }

    setSelectedProduct(nextProduct);
    setFeedback({ kind: "pending", message: "Guardando…" });

    startTransition(async () => {
      try {
        const result = await saveMetaCampaignProduct(campaignId, nextProduct);

        if (!result.ok) {
          setSelectedProduct(previousProduct);
          setFeedback({ kind: "error", message: result.message });
          return;
        }

        setSelectedProduct(result.productoBase);
        setFeedback({ kind: "success", message: result.message });
      } catch {
        setSelectedProduct(previousProduct);
        setFeedback({
          kind: "error",
          message: "No se pudo guardar la asignación.",
        });
      }
    });
  }

  return (
    <div className="min-w-56">
      <label className="sr-only" htmlFor={`campaign-product-${campaignId}`}>
        Producto asociado a {campaignName}
      </label>
      <div className="relative rounded-xl border border-border bg-[var(--color-bg-surface-elevated)] p-1 shadow-sm transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus-within:border-[var(--color-border-selected)] focus-within:ring-2 focus-within:ring-ring">
        <select
          id={`campaign-product-${campaignId}`}
          value={selectedProduct ?? ""}
          onChange={(event) => handleChange(event.target.value)}
          disabled={isPending}
          aria-busy={isPending}
          aria-describedby={feedback ? feedbackId : undefined}
          title={selectedProduct ?? "Asignar producto base"}
          className="h-8 w-full rounded-lg bg-transparent py-1 pr-8 pl-2 font-body text-xs font-medium text-text-primary outline-none disabled:cursor-wait disabled:opacity-60"
        >
          <option value="">Asignar producto…</option>
          {options.map((product) => (
            <option key={product} value={product}>
              {product}
            </option>
          ))}
        </select>
        {isPending ? (
          <Loader2
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-text-secondary"
          />
        ) : null}
      </div>
      <div className="mt-1.5 min-h-5" aria-live="polite">
        {feedback ? (
          <p
            id={feedbackId}
            role={feedback.kind === "error" ? "alert" : "status"}
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-body text-[0.68rem] font-medium ${
              feedback.kind === "error"
                ? "bg-negative-bg text-negative"
                : feedback.kind === "success"
                  ? "bg-positive-bg text-positive"
                  : "bg-[var(--color-bg-surface-subtle)] text-text-secondary"
            }`}
          >
            {feedback.kind === "success" ? (
              <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
            ) : feedback.kind === "error" ? (
              <CircleAlert aria-hidden="true" className="h-3 w-3" />
            ) : null}
            {feedback.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function MetaCampaignsTable({
  campaigns,
  metrics,
  productOptions,
  dateFrom,
  dateTo,
  initialStatusFilter,
  metricsComplete,
  metricsPartialMessage,
}: MetaCampaignsTableProps) {
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const statusOptions = useMemo(
    () =>
      [...new Set(campaigns.map((campaign) => campaign.estado.trim().toUpperCase()))]
        .filter(Boolean)
        .sort((left, right) => {
          const leftIndex = statusPriority.indexOf(left);
          const rightIndex = statusPriority.indexOf(right);
          const leftPriority = leftIndex === -1 ? statusPriority.length : leftIndex;
          const rightPriority = rightIndex === -1 ? statusPriority.length : rightIndex;

          return leftPriority - rightPriority || left.localeCompare(right);
        }),
    [campaigns],
  );
  const effectiveStatusFilter = statusFilter || "ACTIVE";
  const selectableStatusOptions =
    effectiveStatusFilter === "todos" ||
    statusOptions.includes(effectiveStatusFilter)
      ? statusOptions
      : [effectiveStatusFilter, ...statusOptions];
  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter(
        (campaign) =>
          effectiveStatusFilter === "todos" ||
          campaign.estado.trim().toUpperCase() === effectiveStatusFilter,
      ),
    [campaigns, effectiveStatusFilter],
  );
  const metricsByCampaign = useMemo(
    () => new Map(metrics.map((metric) => [metric.campaignId, metric])),
    [metrics],
  );
  const hasPartialMetrics = !metricsComplete || Boolean(metricsPartialMessage);
  const canTreatMissingMetricsAsZero = metricsComplete && !hasPartialMetrics;

  return (
    <section className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-subtle)] p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Cuenta publicitaria configurada
          </p>
          <h2 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Rendimiento por campaña
          </h2>
          <p className="mt-1 font-body text-sm font-medium text-text-primary">
            {formatMetricPeriod(dateFrom, dateTo)}
          </p>
          <p className="mt-1 max-w-3xl font-body text-xs text-text-secondary">
            Compras y CPA son resultados atribuidos por el píxel de Meta. Son
            estimaciones de Meta, no ventas reales confirmadas por el CRM.
          </p>
        </div>

        <label className="grid gap-1.5">
          <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Estado
          </span>
          <span className="relative block">
            <Activity
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary"
            />
            <select
              value={effectiveStatusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filtrar campañas por estado"
              className="min-h-[var(--density-row-height-compact)] w-full min-w-44 rounded-xl border border-border bg-[var(--color-bg-surface-elevated)] py-2 pr-8 pl-9 font-body text-sm text-text-primary outline-none transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="todos">Todas las campañas</option>
              {selectableStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>

      {hasPartialMetrics ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-risk-medium bg-risk-medium-bg px-3 py-2 font-body text-xs text-risk-medium"
        >
          {metricsPartialMessage ??
            "Meta entregó métricas parciales para este rango. Los guiones indican datos que no estuvieron disponibles; no equivalen a cero."}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2" aria-live="polite">
        <span className="font-body text-xs text-text-secondary">
          {filteredCampaigns.length} de {campaigns.length}{" "}
          {campaigns.length === 1 ? "campaña" : "campañas"}
        </span>
        <span className="rounded-full bg-[var(--color-bg-surface-elevated)] px-2 py-1 font-body text-[0.68rem] font-semibold text-text-secondary shadow-sm">
          {effectiveStatusFilter === "todos"
            ? "Todos los estados"
            : formatStatus(effectiveStatusFilter)}
        </span>
      </div>

      {filteredCampaigns.length > 0 ? (
        <>
          <p className="mt-3 font-body text-xs text-text-secondary lg:hidden">
            Desliza horizontalmente para ver todas las métricas.
          </p>
          <div
            role="region"
            aria-label="Tabla de campañas de Meta Ads"
            tabIndex={0}
            className="mt-3 overflow-x-auto overscroll-x-contain rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-elevated)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <table className="w-full min-w-[116rem] border-collapse text-left">
              <caption className="sr-only">
                Campañas con asignación de producto y métricas del píxel de Meta
                para {formatMetricPeriod(dateFrom, dateTo).toLocaleLowerCase("es")}
              </caption>
              <thead className="bg-[var(--color-bg-surface-base)]">
                <tr className="border-b border-[var(--color-border-subtle)] font-body text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                  <th scope="colgroup" colSpan={3} className="px-4 py-2.5">
                    Campaña
                  </th>
                  <th
                    scope="colgroup"
                    colSpan={3}
                    className="border-l border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-subtle)] px-3 py-2.5 text-right text-text-primary"
                  >
                    Métricas clave
                  </th>
                  <th scope="colgroup" colSpan={5} className="px-3 py-2.5 text-right">
                    Tráfico y entrega
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Catálogo
                  </th>
                </tr>
                <tr className="font-body text-[0.68rem] font-semibold uppercase tracking-wide text-text-secondary">
                  <th
                    scope="col"
                    className="sticky left-0 z-[var(--z-index-sticky-header)] min-w-68 bg-[var(--color-bg-surface-base)] px-4 py-3"
                  >
                    Nombre
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Estado
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Producto base
                  </th>
                  <th
                    scope="col"
                    className="border-l border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-subtle)] px-3 py-3 text-right font-mono tabular-nums text-text-primary"
                  >
                    Gasto
                  </th>
                  <th
                    scope="col"
                    className="bg-[var(--color-bg-surface-subtle)] px-3 py-3 text-right font-mono tabular-nums text-text-primary"
                  >
                    <span title="Compras atribuidas por el píxel de Meta">
                      Compras
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="bg-[var(--color-bg-surface-subtle)] px-3 py-3 text-right font-mono tabular-nums text-text-primary"
                  >
                    <abbr
                      className="no-underline"
                      title="Costo por compra atribuido por Meta"
                    >
                      CPA
                    </abbr>
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-mono tabular-nums">
                    <abbr className="no-underline" title="Costo por clic reportado por Meta">
                      CPC
                    </abbr>
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-mono tabular-nums">
                    <abbr
                      className="no-underline"
                      title="Porcentaje de clics sobre impresiones"
                    >
                      CTR
                    </abbr>
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-mono tabular-nums">
                    Impresiones
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-mono tabular-nums">
                    Clics
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-mono tabular-nums">
                    Alcance
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Actualizado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {filteredCampaigns.map((campaign) => {
                  const metric = metricsByCampaign.get(campaign.id);
                  const emptyMetricValue = canTreatMissingMetricsAsZero ? 0 : null;
                  const gasto = metric ? metric.gasto : emptyMetricValue;
                  const compras = metric ? metric.compras : emptyMetricValue;
                  const cpa = metric?.cpa ?? null;
                  const cpc = metric?.cpc ?? null;
                  const ctr = metric?.ctr ?? null;
                  const impresiones = metric
                    ? metric.impresiones
                    : emptyMetricValue;
                  const clics = metric ? metric.clics : emptyMetricValue;
                  const alcance = metric ? metric.alcance : emptyMetricValue;

                  return (
                    <tr
                      key={campaign.id}
                      className="group min-h-[var(--density-row-height-comfortable)] align-middle transition-colors duration-[var(--motion-duration-hover-focus)] hover:bg-[var(--color-bg-hover)]"
                    >
                      <td className="sticky left-0 z-[var(--z-index-shell)] min-w-68 bg-[var(--color-bg-surface-elevated)] px-4 py-3 group-hover:bg-[var(--color-bg-hover)]">
                        <p
                          title={campaign.nombre}
                          className="max-w-76 truncate font-display text-sm font-semibold text-text-primary"
                        >
                          {campaign.nombre}
                        </p>
                        <p className="mt-1 font-mono text-[0.68rem] tabular-nums text-text-secondary">
                          {campaign.id}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 font-body text-xs font-semibold ${getStatusClass(campaign.estado)}`}
                        >
                          {formatStatus(campaign.estado)}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <ProductAssignmentSelect
                          key={`${campaign.id}-${campaign.producto_base ?? "none"}`}
                          campaignId={campaign.id}
                          campaignName={campaign.nombre}
                          currentProduct={campaign.producto_base}
                          productOptions={productOptions}
                        />
                      </td>
                      <td
                        className={`border-l border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-subtle)] px-3 py-3 text-right font-mono text-base font-semibold tabular-nums whitespace-nowrap group-hover:bg-[var(--color-bg-selected)] ${getMetricTone(gasto, true)}`}
                      >
                        {formatCurrency(gasto, campaign.moneda)}
                      </td>
                      <td
                        className={`bg-[var(--color-bg-surface-subtle)] px-3 py-3 text-right font-mono text-base font-semibold tabular-nums whitespace-nowrap group-hover:bg-[var(--color-bg-selected)] ${getMetricTone(compras, true)}`}
                      >
                        {formatResultCount(compras)}
                      </td>
                      <td
                        className={`bg-[var(--color-bg-surface-subtle)] px-3 py-3 text-right font-mono text-base font-semibold tabular-nums whitespace-nowrap group-hover:bg-[var(--color-bg-selected)] ${getMetricTone(cpa, true)}`}
                      >
                        {formatCurrency(cpa, campaign.moneda)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm tabular-nums whitespace-nowrap text-text-secondary">
                        {formatCurrency(cpc, campaign.moneda)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm tabular-nums whitespace-nowrap text-text-secondary">
                        {formatPercentage(ctr)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm tabular-nums whitespace-nowrap text-text-secondary">
                        {formatCount(impresiones)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm tabular-nums whitespace-nowrap text-text-secondary">
                        {formatCount(clics)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm tabular-nums whitespace-nowrap text-text-secondary">
                        {formatCount(alcance)}
                      </td>
                      <td className="px-4 py-3 font-body text-xs text-text-secondary">
                        <time dateTime={campaign.actualizado_en}>
                          {formatUpdatedAt(campaign.actualizado_en)}
                        </time>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-elevated)] p-6 font-body text-sm text-text-secondary shadow-sm">
          {campaigns.length > 0
            ? "No hay campañas que coincidan con el filtro."
            : "Aún no hay campañas sincronizadas. Usa Actualizar para consultar Meta Ads."}
        </div>
      )}
    </section>
  );
}
