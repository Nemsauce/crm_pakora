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
import Link from "next/link";

import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import type { CampaignRealResults } from "@/lib/meta/getCampaignRealResults";

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
  realResults: CampaignRealResults | null;
  realResultsError: string | null;
  sharedCampaignCount: number | null;
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

const exchangeRateDateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

const exchangeRateFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 6,
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

function RealResultsSection({
  campaign,
  results,
  errorMessage,
  sharedCampaignCount,
  compras,
  gasto,
  metricsComplete,
  metricRange,
}: {
  campaign: CampaignDetailCampaign;
  results: CampaignRealResults | null;
  errorMessage: string | null;
  sharedCampaignCount: number | null;
  compras: number | null;
  gasto: number | null;
  metricsComplete: boolean;
  metricRange: string;
}) {
  const spend = toFiniteNumber(gasto);
  const profitCop = toFiniteNumber(results?.gananciaEntregadosCop);
  const exchangeRateDate = results?.exchangeRate
    ? new Date(results.exchangeRate.timestamp)
    : null;
  const missingProfit = results?.countries.some(
    (country) => country.entregadosSinGanancia > 0,
  );
  const roasUnavailable = !metricsComplete || spend === null
    ? "Gasto de Meta incompleto o no disponible."
    : spend <= 0
      ? "Sin gasto de Meta en el período."
      : missingProfit
        ? "Falta la ganancia de algunos pedidos entregados."
        : results?.exchangeRateError ?? (profitCop === null
          ? "Ganancia total en COP no disponible."
          : null);
  const realRoas = !roasUnavailable && profitCop !== null && spend !== null && spend > 0
    ? profitCop / spend
    : null;

  return (
    <section
      aria-labelledby="campaign-real-results"
      className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-subtle)] p-4 shadow-sm sm:p-5"
    >
      <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
        Píxel vs. pedidos del producto
      </p>
      <h2 id="campaign-real-results" className="mt-1 font-display text-lg font-semibold text-text-primary">
        Resultados reales (CRM)
      </h2>
      <p className="mt-1 font-body text-xs text-text-secondary">{metricRange}</p>

      {!campaign.producto_base?.trim() ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border)] p-5">
          <p className="font-body text-sm text-text-primary">
            Asigná un producto a esta campaña para ver resultados reales
          </p>
          <Link href="/command-center/campanias" className="mt-3 inline-flex rounded-lg font-body text-sm font-semibold text-[var(--color-accent)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            Ir a asignar producto
          </Link>
        </div>
      ) : errorMessage || !results ? (
        <p role="status" className="mt-4 rounded-xl border border-risk-medium bg-risk-medium-bg px-4 py-3 font-body text-sm text-risk-medium">
          {errorMessage ?? "Los resultados reales no están disponibles."}
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
            <article className="rounded-2xl bg-[var(--color-badge-nuevo-bg)] p-5 text-[var(--color-badge-nuevo)]">
              <h3 className="font-body text-sm font-semibold">Meta reporta</h3>
              <p className="mt-3 font-mono text-3xl font-semibold tabular-nums">
                <MetricValue value={compras} format="count" currency={null} />
              </p>
              <p className="mt-1 font-body text-sm">compras atribuidas por el píxel</p>
            </article>
            <article className="rounded-2xl bg-[var(--color-bg-surface-elevated)] p-5 shadow-sm">
              <h3 className="font-body text-sm font-semibold text-text-primary">Realidad (CRM)</h3>
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
                {[
                  { label: "Pedidos reales", value: results.total, color: "text-text-primary" },
                  { label: "Confirmados", value: results.confirmados, color: "text-[var(--color-accent-blue)]" },
                  { label: "Entregados", value: results.entregados, color: "text-positive" },
                  { label: "Devoluciones", value: results.devoluciones, color: "text-negative" },
                  { label: "En proceso / otros", value: results.enProceso, color: "text-text-secondary" },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="font-body text-xs text-text-secondary">{item.label}</dt>
                    <dd className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${item.color}`}>
                      <AnimatedNumber value={item.value} locale="es-CO" maximumFractionDigits={0} />
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl bg-[var(--color-bg-surface-elevated)] p-5 shadow-sm">
              <h3 className="font-body text-sm font-semibold text-text-primary">Ganancia real de entregados</h3>
              <p className="mt-3 font-body text-xs text-text-secondary">Total combinado · COP</p>
              <p className={`crm-financial-glow mt-1 font-mono text-2xl font-semibold tabular-nums ${profitCop !== null && profitCop < 0 ? "text-negative" : "text-positive"}`}>
                <MetricValue value={profitCop} format="currency" currency="COP" />
              </p>
              {results.exchangeRateError ? (
                <p role="status" className="mt-2 font-body text-xs text-risk-medium">
                  {results.exchangeRateError}
                </p>
              ) : null}
              {results.countries.map((country) => (
                <div key={country.pais} className="mt-3">
                  <p className="font-body text-xs text-text-secondary">{country.pais} · {country.moneda}</p>
                  <p className={`mt-1 break-words font-mono text-2xl font-semibold tabular-nums ${country.gananciaEntregados < 0 ? "text-negative" : "text-positive"}`}>
                    <MetricValue value={country.gananciaEntregados} format="currency" currency={country.moneda} />
                  </p>
                  {country.pais === "MX" && results.gananciaMxCop !== null ? (
                    <p className="mt-1 font-body text-xs text-text-secondary">
                      Equivalente en COP:{" "}
                      <span className="font-mono tabular-nums">
                        <MetricValue value={results.gananciaMxCop} format="currency" currency="COP" />
                      </span>
                    </p>
                  ) : null}
                  {country.entregadosSinGanancia > 0 ? (
                    <p className="mt-1 font-body text-xs text-risk-medium">
                      Suma parcial: {country.entregadosSinGanancia} entregados sin ganancia informada.
                    </p>
                  ) : null}
                </div>
              ))}
              <p className="mt-3 font-body text-xs leading-relaxed text-text-secondary">
                Ganancia informada por Dropi en los pedidos entregados. No descuenta el gasto de Meta ni las devoluciones.
              </p>
            </article>
            <article className="rounded-2xl border border-[var(--color-border-selected)] bg-[var(--color-bg-selected)] p-5 shadow-sm">
              <h3 className="font-body text-sm font-semibold text-text-primary">ROAS real · CRM</h3>
              <p className="crm-financial-glow mt-3 font-mono text-3xl font-semibold tabular-nums text-[var(--color-accent)]">
                {realRoas === null ? <span aria-label="ROAS real no disponible">—</span> : (
                  <AnimatedNumber value={realRoas} locale="es-CO" maximumFractionDigits={2} suffix="×" />
                )}
              </p>
              <p className="mt-3 font-body text-xs leading-relaxed text-text-secondary">
                Ganancia real de entregados en COP ÷ gasto de esta campaña en Meta, ya expresado en COP. Es una comparación del producto; no es el ROAS atribuido por Meta.
              </p>
              {roasUnavailable ? <p className="mt-2 font-body text-xs text-risk-medium">{roasUnavailable}</p> : null}
            </article>
          </div>

          {results.exchangeRate ? (
            <p className="mt-4 border-t border-[var(--color-border-subtle)] pt-3 font-body text-xs leading-relaxed text-text-secondary">
              Conversión aplicada: 1 MXN ={" "}
              <span className="font-mono tabular-nums">
                {exchangeRateFormatter.format(results.exchangeRate.rate)} COP
              </span>
              {exchangeRateDate && !Number.isNaN(exchangeRateDate.getTime())
                ? ` · tasa actualizada ${exchangeRateDateFormatter.format(exchangeRateDate)}`
                : null}.
              {" "}La ganancia MXN se convirtió a COP con la tasa actual, no una tasa histórica del período. El gasto de Meta permanece en COP, sin conversión.
            </p>
          ) : null}

          <div className="mt-4 space-y-2 font-body text-xs leading-relaxed text-text-secondary">
            <p>
              {sharedCampaignCount !== null && sharedCampaignCount > 1
                ? `${sharedCampaignCount} campañas comparten este producto. `
                : ""}
              Estos son los pedidos del producto en el período, no ventas atribuibles exclusivamente a esta campaña.
              {sharedCampaignCount === null ? " No se pudo verificar cuántas campañas comparten el producto." : ""}
            </p>
            <p>
              Sin filtro de país. {results.countries.length > 0
                ? `Se incluyen ${results.countries.map((country) => `${country.pais}: ${country.total} pedidos`).join(" · ")}.`
                : "No hay pedidos coincidentes en este período."}
              {results.countries.length > 1 ? " El total en COP suma la ganancia de CO y la ganancia de MX convertida a COP." : ""}
            </p>
            <p>
              Se usa la fecha de creación del pedido y su estado actual. Confirmados cuenta los pedidos con confirmación registrada en el historial; puede faltar en pedidos antiguos.
              {" "}En proceso / otros agrupa todo lo que no está entregado o devuelto
              {results.cancelados > 0 ? `, incluidos ${results.cancelados} cancelados` : ""}.
            </p>
          </div>
        </>
      )}
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
  realResults,
  realResultsError,
  sharedCampaignCount,
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
            confirmadas por el CRM. El cruce con los pedidos del producto se
            muestra en Resultados reales (CRM).
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

      <RealResultsSection
        campaign={campaign}
        results={realResults}
        errorMessage={realResultsError}
        sharedCampaignCount={sharedCampaignCount}
        compras={compras}
        gasto={gasto}
        metricsComplete={canUseZero}
        metricRange={metricRange}
      />

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
