"use client";

import { TrendingUp } from "lucide-react";
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
