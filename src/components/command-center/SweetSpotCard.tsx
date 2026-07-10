import { MomentumBadge } from "@/components/command-center/MomentumBadge";

export type SweetSpotCountry = "CO" | "MX";

export type SweetSpotCandidate = {
  external_id: string | number | null;
  platform: string | null;
  country_code: SweetSpotCountry;
  nombre_producto: string | null;
  sale_price: number | string | null;
  suggested_price: number | string | null;
  stock: number | string | null;
  total_sold_units: number | string | null;
  sold_units_last_7_days: number | string | null;
  sold_units_last_30_days: number | string | null;
  captured_at: string | null;
  ritmo_7d: number | string | null;
  ritmo_23d_previo: number | string | null;
  momentum_ratio: number | string | null;
  precio_hace_30d: number | string | null;
  variacion_precio_pct: number | string | null;
  cumple_no_muerto: boolean | null;
  cumple_no_saturado: boolean | null;
  cumple_momentum: boolean | null;
  cumple_precio_sano: boolean | null;
  es_sweet_spot: boolean | null;
};

type SweetSpotCardProps = {
  candidate: SweetSpotCandidate;
};

type Metric = {
  label: string;
  value: number;
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
} satisfies Record<SweetSpotCountry, Intl.NumberFormat>;

const countFormatter = {
  CO: new Intl.NumberFormat("es-CO"),
  MX: new Intl.NumberFormat("es-MX"),
} satisfies Record<SweetSpotCountry, Intl.NumberFormat>;

export function SweetSpotCard({ candidate }: SweetSpotCardProps) {
  const pais = candidate.country_code;
  const metrics: Metric[] = [
    {
      label: "Vendidas",
      value: toNumber(candidate.total_sold_units),
    },
    {
      label: "Últimos 7 días",
      value: toNumber(candidate.sold_units_last_7_days),
    },
    {
      label: "Últimos 30 días",
      value: toNumber(candidate.sold_units_last_30_days),
    },
  ];

  return (
    <article className="rounded-2xl border border-border bg-bg-surface p-4 text-text-primary shadow-lg">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="break-words font-display text-base font-semibold text-text-primary">
            {candidate.nombre_producto || "Producto sin nombre"}
          </h4>
          <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-text-primary">
            {formatCurrency(pais, candidate.sale_price)}
          </p>
        </div>

        <div className="shrink-0">
          <MomentumBadge
            momentumRatio={candidate.momentum_ratio}
            ritmo7d={candidate.ritmo_7d}
            ritmo23dPrevio={candidate.ritmo_23d_previo}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {metrics.map((metric) => (
          <span
            key={metric.label}
            className="inline-flex items-center gap-1.5 rounded-full bg-bg-page px-3 py-1 font-body text-xs font-semibold text-text-secondary"
          >
            <span>{metric.label}:</span>
            <span className="font-mono tabular-nums text-text-primary">
              {formatCount(pais, metric.value)}
            </span>
          </span>
        ))}
      </div>
    </article>
  );
}

function formatCurrency(
  pais: SweetSpotCountry,
  value: number | string | null,
) {
  const numberValue = toNumberOrNull(value);

  if (numberValue === null) {
    return "—";
  }

  return currencyFormatter[pais].format(numberValue);
}

function toNumberOrNull(value: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatCount(pais: SweetSpotCountry, value: number) {
  return countFormatter[pais].format(value);
}

function toNumber(value: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}
