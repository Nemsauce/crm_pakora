"use client";

import {
  Activity,
  CircleDollarSign,
  Eye,
  Gauge,
  MousePointerClick,
  PackageCheck,
  Percent,
  ShoppingBag,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { AnimatedNumber } from "@/components/motion/AnimatedNumber";

export type CampaignDetailCampaign = {
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

export type CampaignDetailMetric = {
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

export type CampaignDetailProps = {
  campaign: CampaignDetailCampaign;
  metric: CampaignDetailMetric | null;
  dateFrom: string;
  dateTo: string;
  metricsComplete: boolean;
  metricsPartialMessage?: string | null;
};

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  description: string;
  value: number | null;
  format: "count" | "currency" | "decimal" | "percentage";
  currency: string | null;
  prominent?: boolean;
};

const rangeDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

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
    "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-elevated)] text-text-secondary",
  DELETED: "border-transparent bg-negative-bg text-negative",
};

function toFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeCurrency(value: string | null) {
  const normalized = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function parseDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatRange(dateFrom: string, dateTo: string) {
  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);

  if (!from || !to) {
    return `${dateFrom} – ${dateTo}`;
  }

  if (dateFrom === dateTo) {
    return rangeDateFormatter.format(from);
  }

  return `${rangeDateFormatter.format(from)} – ${rangeDateFormatter.format(to)}`;
}

function formatObjective(value: string | null) {
  if (!value?.trim()) {
    return "Objetivo no reportado";
  }

  return value.trim().replaceAll("_", " ").toLocaleLowerCase("es");
}

function formatStatus(value: string) {
  const normalized = value.trim().toUpperCase();
  const readable = normalized.replaceAll("_", " ").toLocaleLowerCase("es");

  return (
    statusLabels[normalized] ??
    (readable
      ? `${readable.charAt(0).toLocaleUpperCase("es")}${readable.slice(1)}`
      : "Sin estado")
  );
}

function getStatusClass(value: string) {
  return (
    statusClasses[value.trim().toUpperCase()] ??
    "border-transparent bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)]"
  );
}

function MetricValue({
  value,
  format,
  currency,
}: Pick<MetricCardProps, "value" | "format" | "currency">) {
  const numericValue = toFiniteNumber(value);

  if (numericValue === null) {
    return <span aria-label="Dato no disponible">—</span>;
  }

  if (format === "currency") {
    const normalizedCurrency = normalizeCurrency(currency);

    return (
      <AnimatedNumber
        value={numericValue}
        locale="es-CO"
        currency={normalizedCurrency ?? undefined}
        maximumFractionDigits={2}
        suffix={
          !normalizedCurrency && currency?.trim()
            ? ` ${currency.trim().toUpperCase()}`
            : ""
        }
      />
    );
  }

  if (format === "percentage") {
    return (
      <AnimatedNumber
        value={numericValue}
        locale="es-CO"
        maximumFractionDigits={2}
        suffix=" %"
      />
    );
  }

  return (
    <AnimatedNumber
      value={numericValue}
      locale="es-CO"
      maximumFractionDigits={2}
    />
  );
}

function MetricCard({
  icon: Icon,
  label,
  description,
  value,
  format,
  currency,
  prominent = false,
}: MetricCardProps) {
  return (
    <article
      className={`crm-tactile-card min-w-0 rounded-2xl border border-transparent bg-[var(--color-bg-surface-elevated)] shadow-sm ${
        prominent ? "p-5 sm:p-6" : "p-4"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.1em] text-text-secondary">
            {label}
          </p>
          <p className="mt-1 font-body text-xs leading-relaxed text-text-secondary">
            {description}
          </p>
        </div>
        <span
          className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)] ring-1 ring-[var(--color-badge-nuevo-bg)] ${
            prominent ? "size-11" : "size-9"
          }`}
          aria-hidden="true"
        >
          <Icon className={prominent ? "size-5" : "size-4"} />
        </span>
      </div>
      <p
        className={`mt-4 min-w-0 font-mono font-semibold tabular-nums text-text-primary ${
          prominent
            ? "crm-financial-glow text-2xl sm:text-3xl"
            : "text-xl"
        }`}
      >
        <MetricValue value={value} format={format} currency={currency} />
      </p>
    </article>
  );
}

function MetricGroup({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-transparent bg-[var(--color-bg-surface-subtle)] p-4 shadow-sm sm:p-5">
      <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
        {eyebrow}
      </p>
      <h2 className="mt-1 font-display text-lg font-semibold text-text-primary">
        {title}
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function CampaignDetail({
  campaign,
  metric,
  dateFrom,
  dateTo,
  metricsComplete,
  metricsPartialMessage,
}: CampaignDetailProps) {
  const canUseZero = metricsComplete && !metricsPartialMessage;
  const volumeFallback = canUseZero ? 0 : null;
  const gasto = metric?.gasto ?? volumeFallback;
  const compras = metric?.compras ?? volumeFallback;
  const impresiones = metric?.impresiones ?? volumeFallback;
  const clics = metric?.clics ?? volumeFallback;
  const alcance = metric?.alcance ?? volumeFallback;
  const cpa = metric?.cpa ?? null;
  const cpc = metric?.cpc ?? null;
  const ctr = metric?.ctr ?? null;
  const numericSpend = toFiniteNumber(gasto);
  const numericImpressions = toFiniteNumber(impresiones);
  const numericReach = toFiniteNumber(alcance);
  const cpm =
    numericSpend !== null &&
    numericImpressions !== null &&
    numericImpressions > 0
      ? (numericSpend * 1_000) / numericImpressions
      : null;
  const frequency =
    numericImpressions !== null && numericReach !== null && numericReach > 0
      ? numericImpressions / numericReach
      : null;
  const metricRange = formatRange(dateFrom, dateTo);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-subtle)] p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                Producto asociado
              </p>
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 font-body text-xs font-semibold ${getStatusClass(campaign.estado)}`}
              >
                {formatStatus(campaign.estado)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)]">
                <PackageCheck className="size-4" aria-hidden="true" />
              </span>
              <p className="min-w-0 break-words font-display text-lg font-semibold text-text-primary">
                {campaign.producto_base ?? "Sin producto asignado"}
              </p>
            </div>
          </div>

          <div className="lg:text-right">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Período exacto
            </p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-text-primary">
              {metricRange}
            </p>
            <p className="mt-1 font-body text-xs capitalize text-text-secondary">
              {formatObjective(campaign.objetivo)}
            </p>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-elevated)] px-4 py-3 shadow-sm">
        <div className="flex items-start gap-3">
          <Activity
            className="mt-0.5 size-4 shrink-0 text-[var(--color-accent)]"
            aria-hidden="true"
          />
          <p className="font-body text-xs leading-relaxed text-text-secondary">
            Datos consultados en vivo a Meta para este período. Compras y CPA
            son conversiones que el píxel de Meta atribuye; no son ventas reales
            confirmadas por el CRM. La comparación con ventas reales llegará en
            la siguiente capa.
          </p>
        </div>
      </div>

      {metricsPartialMessage ? (
        <div
          role="status"
          className="rounded-xl border border-risk-medium bg-risk-medium-bg px-4 py-3 font-body text-sm text-risk-medium"
        >
          {metricsPartialMessage}
        </div>
      ) : null}

      <section aria-labelledby="campaign-headline-metrics">
        <div className="mb-3">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            Resultados principales
          </p>
          <h2
            id="campaign-headline-metrics"
            className="mt-1 font-display text-lg font-semibold text-text-primary"
          >
            Inversión y conversiones
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            icon={CircleDollarSign}
            label="Gasto"
            description="Inversión reportada por Meta"
            value={gasto}
            format="currency"
            currency={campaign.moneda}
            prominent
          />
          <MetricCard
            icon={ShoppingBag}
            label="Compras"
            description="Compras atribuidas por el píxel"
            value={compras}
            format="count"
            currency={campaign.moneda}
            prominent
          />
          <MetricCard
            icon={Target}
            label="CPA"
            description="Costo por compra atribuido"
            value={cpa}
            format="currency"
            currency={campaign.moneda}
            prominent
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <MetricGroup eyebrow="Eficiencia" title="Costos">
          <MetricCard
            icon={MousePointerClick}
            label="CPC"
            description="Costo promedio por clic"
            value={cpc}
            format="currency"
            currency={campaign.moneda}
          />
          <MetricCard
            icon={Gauge}
            label="CPM"
            description="Costo por mil impresiones"
            value={cpm}
            format="currency"
            currency={campaign.moneda}
          />
        </MetricGroup>

        <MetricGroup eyebrow="Interacción" title="Respuesta">
          <MetricCard
            icon={MousePointerClick}
            label="Clics"
            description="Todos los clics reportados"
            value={clics}
            format="count"
            currency={campaign.moneda}
          />
          <MetricCard
            icon={Percent}
            label="CTR"
            description="Clics sobre impresiones"
            value={ctr}
            format="percentage"
            currency={campaign.moneda}
          />
        </MetricGroup>

        <MetricGroup eyebrow="Distribución" title="Entrega">
          <MetricCard
            icon={Eye}
            label="Impresiones"
            description="Veces que se mostraron los anuncios"
            value={impresiones}
            format="count"
            currency={campaign.moneda}
          />
          <MetricCard
            icon={Users}
            label="Alcance"
            description="Personas alcanzadas"
            value={alcance}
            format="count"
            currency={campaign.moneda}
          />
          <div className="sm:col-span-2">
            <MetricCard
              icon={Activity}
              label="Frecuencia"
              description="Impresiones promedio por persona alcanzada"
              value={frequency}
              format="decimal"
              currency={campaign.moneda}
            />
          </div>
        </MetricGroup>
      </div>

      <p className="font-body text-xs leading-relaxed text-text-secondary">
        CPM y frecuencia se calculan con el gasto, las impresiones y el alcance
        que Meta reportó para este mismo período.
      </p>
    </div>
  );
}
