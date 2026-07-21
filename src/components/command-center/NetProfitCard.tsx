"use client";

import { CircleDollarSign, Loader2, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  type TooltipContentProps,
} from "recharts";

type Pais = "CO" | "MX";

export type NetProfitTrendPoint = {
  dia: string;
  neto: number;
};

type NetProfitCardProps = {
  pais: Pais;
  entradasOperativas: number;
  salidasOperativas: number;
  hasMovements: boolean;
  trendData: NetProfitTrendPoint[];
  comparisonPercentage: number | null;
};

type CombinedNetProfitCardProps = {
  coNet: number;
  mxNet: number;
  hasCoMovements: boolean;
  hasMxMovements: boolean;
  refreshKey: string;
};

type ExchangeRate = {
  rate: number;
  timestamp: string;
};

const countryLabel: Record<Pais, string> = {
  CO: "Colombia",
  MX: "México",
};

const currencyFormatter = {
  CO: new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }),
  MX: new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }),
} satisfies Record<Pais, Intl.NumberFormat>;

function formatCurrency(pais: Pais, value: number) {
  return currencyFormatter[pais].format(value);
}

const chartDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const exchangeRateDateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

const exchangeRateFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
});

function formatChartDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);

  return Number.isNaN(date.getTime()) ? value : chartDateFormatter.format(date);
}

function ComparisonBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="rounded-full bg-bg-page px-3 py-1 font-body text-xs font-semibold text-text-secondary">
        Sin base anterior
      </span>
    );
  }

  const tone =
    value > 0
      ? "bg-risk-low-bg text-risk-low"
      : value < 0
        ? "bg-risk-high-bg text-risk-high"
        : "bg-bg-page text-text-secondary";
  const prefix = value > 0 ? "+" : "";

  return (
    <span
      className={`rounded-full px-3 py-1 font-mono text-xs font-semibold tabular-nums ${tone}`}
    >
      {prefix}
      {value.toFixed(1)}% vs. período anterior
    </span>
  );
}

function DailyTrendTooltip({
  active,
  payload,
  label,
  pais,
}: TooltipContentProps & { pais: Pais }) {
  if (!active || payload.length === 0) {
    return null;
  }

  const net = Number(payload[0]?.value ?? 0);

  return (
    <div className="rounded-2xl border border-border bg-bg-surface px-3 py-2 shadow-lg">
      <p className="font-body text-xs text-text-secondary">
        {formatChartDate(String(label ?? ""))}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-text-primary">
        {formatCurrency(pais, net)}
      </p>
    </div>
  );
}

export function CombinedNetProfitCard({
  coNet,
  mxNet,
  hasCoMovements,
  hasMxMovements,
  refreshKey,
}: CombinedNetProfitCardProps) {
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [exchangeRateError, setExchangeRateError] = useState<string | null>(
    null,
  );
  const hasMovements = hasCoMovements || hasMxMovements;

  useEffect(() => {
    if (!hasMxMovements) {
      return;
    }

    const abortController = new AbortController();

    async function loadExchangeRate() {
      setExchangeRateError(null);

      try {
        const response = await fetch("/api/fx/mxn-cop", {
          signal: abortController.signal,
        });
        const payload = (await response.json()) as Partial<ExchangeRate> & {
          error?: string;
        };

        if (
          !response.ok ||
          !Number.isFinite(payload.rate) ||
          payload.rate === undefined ||
          payload.rate <= 0
        ) {
          throw new Error(
            payload.error ?? "No se pudo obtener la tasa de cambio.",
          );
        }

        setExchangeRate({
          rate: payload.rate,
          timestamp:
            typeof payload.timestamp === "string"
              ? payload.timestamp
              : new Date().toISOString(),
        });
        setExchangeRateError(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setExchangeRateError(
          error instanceof Error
            ? error.message
            : "No se pudo obtener la tasa de cambio.",
        );
      }
    }

    void loadExchangeRate();
    return () => abortController.abort();
  }, [hasMxMovements, refreshKey]);

  const canCalculate = !hasMxMovements || exchangeRate !== null;
  const combinedNet =
    coNet + (hasMxMovements && exchangeRate ? mxNet * exchangeRate.rate : 0);
  const combinedTone = combinedNet < 0 ? "text-negative" : "text-positive";
  const exchangeRateDate = exchangeRate
    ? new Date(exchangeRate.timestamp)
    : null;

  return (
    <article className="rounded-2xl border border-border bg-bg-surface p-5 text-text-primary shadow-xl">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Total combinado · expresado en COP
          </p>
          <h3 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Utilidad operativa neta
          </h3>
          {!hasMovements ? (
            <p className="mt-4 font-mono text-3xl font-semibold tabular-nums text-text-secondary">
              {formatCurrency("CO", 0)}
            </p>
          ) : canCalculate ? (
            <p
              className={`mt-4 font-mono text-3xl font-semibold tabular-nums ${combinedTone}`}
            >
              {formatCurrency("CO", combinedNet)}
            </p>
          ) : exchangeRateError ? (
            <p role="alert" className="mt-4 font-body text-sm text-negative">
              No se pudo calcular el total combinado: {exchangeRateError}
            </p>
          ) : (
            <p
              role="status"
              className="mt-4 inline-flex items-center gap-2 font-body text-sm text-text-secondary"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Calculando total combinado...
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[28rem]">
          <div className="rounded-2xl bg-bg-page p-3">
            <p className="font-body text-xs text-text-secondary">Colombia</p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-text-primary">
              {formatCurrency("CO", coNet)}
            </p>
          </div>
          <div className="rounded-2xl bg-bg-page p-3">
            <p className="font-body text-xs text-text-secondary">México</p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-text-primary">
              {formatCurrency("MX", mxNet)}
            </p>
          </div>
        </div>

        <div
          className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)] ring-1 ring-[var(--color-badge-nuevo-bg)] xl:flex"
          aria-hidden="true"
        >
          <CircleDollarSign className="h-5 w-5" />
        </div>
      </div>

      {hasMxMovements && exchangeRate ? (
        <p className="mt-4 border-t border-border pt-3 font-body text-xs text-text-secondary">
          Conversión aplicada: 1 MXN = {" "}
          <span className="font-mono tabular-nums">
            {exchangeRateFormatter.format(exchangeRate.rate)} COP
          </span>
          {exchangeRateDate && !Number.isNaN(exchangeRateDate.getTime())
            ? ` · tasa actualizada ${exchangeRateDateFormatter.format(exchangeRateDate)}`
            : null}
        </p>
      ) : null}
    </article>
  );
}

export function NetProfitCard({
  pais,
  entradasOperativas,
  salidasOperativas,
  hasMovements,
  trendData,
  comparisonPercentage,
}: NetProfitCardProps) {
  const net = entradasOperativas - salidasOperativas;
  const netTone = net < 0 ? "text-negative" : "text-positive";
  const gradientId = `daily-operating-profit-${pais}`;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-bg-surface p-5 text-text-primary shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            {countryLabel[pais]}
          </p>
          <h2 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Utilidad operativa neta
          </h2>
        </div>
        <div
          className="flex size-11 items-center justify-center rounded-full bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)] ring-1 ring-[var(--color-badge-nuevo-bg)]"
          aria-hidden="true"
        >
          <TrendingUp className="h-5 w-5" />
        </div>
      </div>

      {hasMovements ? (
        <div>
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <p
              className={`font-mono text-3xl font-semibold tabular-nums ${netTone}`}
            >
              {formatCurrency(pais, net)}
            </p>
            <ComparisonBadge value={comparisonPercentage} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-risk-low-bg p-3">
              <p className="font-body text-xs font-medium text-risk-low">
                Entradas operativas
              </p>
              <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-risk-low">
                {formatCurrency(pais, entradasOperativas)}
              </p>
            </div>
            <div className="rounded-2xl bg-risk-high-bg p-3">
              <p className="font-body text-xs font-medium text-risk-high">
                Salidas operativas
              </p>
              <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-risk-high">
                {formatCurrency(pais, salidasOperativas)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-bg-page p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="font-body text-sm font-medium text-text-primary">
                Sin movimientos en este rango
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-text-secondary">
                {formatCurrency(pais, 0)}
              </p>
            </div>
            <ComparisonBadge value={comparisonPercentage} />
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-body text-sm font-semibold text-text-primary">
            Tendencia diaria
          </p>
          <p className="font-body text-xs text-text-secondary">Neto por día</p>
        </div>
        <div className="mt-3 h-44 w-full" aria-label={`Tendencia diaria ${countryLabel[pais]}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trendData}
              margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
              accessibilityLayer
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-accent)"
                    stopOpacity={0.42}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-accent)"
                    stopOpacity={0.04}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--color-border)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="dia"
                axisLine={false}
                tickLine={false}
                minTickGap={28}
                tickFormatter={formatChartDate}
                tick={{
                  fill: "var(--color-text-secondary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
              />
              <ReferenceLine y={0} stroke="var(--color-border)" />
              <Tooltip
                cursor={{ stroke: "var(--color-accent)", strokeOpacity: 0.35 }}
                content={(props) => <DailyTrendTooltip {...props} pais={pais} />}
              />
              <Area
                type="linear"
                dataKey="neto"
                name="Neto diario"
                stroke="var(--color-accent)"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </article>
  );
}
