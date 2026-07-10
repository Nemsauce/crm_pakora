import { ExternalLink } from "lucide-react";

import { MomentumBadge } from "@/components/command-center/MomentumBadge";

export type SweetSpotCountry = "CO" | "MX";

export type SweetSpotCandidate = {
  external_id: string | number | null;
  dropkiller_uuid: string | null;
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
  ritmo_reciente: number | string | null;
  percentil_ritmo: number | string | null;
  dias_con_venta_7d: number | string | null;
  tercio1_promedio: number | string | null;
  tercio2_promedio: number | string | null;
  tercio3_promedio: number | string | null;
  tendencia_ratio: number | string | null;
  cumple_banda_sweet_spot: boolean | null;
  cumple_consistencia: boolean | null;
  cumple_tendencia_ascendente: boolean | null;
  es_sweet_spot: boolean | null;
};

type SweetSpotCardProps = {
  candidate: SweetSpotCandidate;
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
  const productName = candidate.nombre_producto || "Producto sin nombre";
  const productUrl = getDropkillerProductUrl(candidate.dropkiller_uuid);
  const demandSignal = getDemandSignal(candidate.percentil_ritmo);
  const tendenciaRatio = toNumberOrNull(candidate.tendencia_ratio);
  const hasMomentumBadge = tendenciaRatio !== null && tendenciaRatio >= 1.2;
  const summary = getCandidateSummary({
    pais,
    percentil: candidate.percentil_ritmo,
    tendenciaRatio: candidate.tendencia_ratio,
  });

  return (
    <article
      className={[
        "relative rounded-2xl border border-border bg-bg-surface p-5 text-text-primary shadow-lg",
        productUrl
          ? "cursor-pointer transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl focus-within:ring-2 focus-within:ring-[var(--color-accent)] focus-within:ring-offset-2 focus-within:ring-offset-bg-page motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          : "",
      ].join(" ")}
    >
      {productUrl ? (
        <a
          href={productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-0 rounded-2xl outline-none"
        >
          <span className="sr-only">Abrir {productName} en Dropkiller</span>
        </a>
      ) : null}

      <div
        className={`relative z-10 ${productUrl ? "pointer-events-none" : ""}`}
      >
        <div className="flex min-w-0 items-start justify-between gap-4">
          <h4 className="min-w-0 break-words font-display text-lg font-semibold text-text-primary">
            {productName}
          </h4>

          <div className="flex shrink-0 items-center gap-2">
            <p className="font-mono text-lg font-semibold tabular-nums text-text-primary">
              {formatCurrency(pais, candidate.sale_price)}
            </p>
            {productUrl ? (
              <ExternalLink
                aria-hidden="true"
                className="h-4 w-4 text-text-secondary"
              />
            ) : null}
          </div>
        </div>

        <p className="mt-3 font-body text-sm leading-relaxed text-text-secondary">
          {summary}
        </p>

        {hasMomentumBadge ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="font-body text-xs font-semibold uppercase text-text-secondary">
              Tendencia reciente
            </span>
            <div className={productUrl ? "pointer-events-auto" : ""}>
              <MomentumBadge
                tendenciaRatio={candidate.tendencia_ratio}
                tercio1Promedio={candidate.tercio1_promedio}
                tercio3Promedio={candidate.tercio3_promedio}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-5 border-t border-border pt-4">
          <p className="font-body text-xs font-semibold uppercase text-text-secondary">
            Datos duros
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Stat
              label="Vendidas"
              value={formatCount(pais, candidate.total_sold_units)}
            />
            <Stat
              label="Últimos 7 días"
              value={formatCount(pais, candidate.sold_units_last_7_days)}
            />
            <Stat
              label="Últimos 30 días"
              value={formatCount(pais, candidate.sold_units_last_30_days)}
            />
            <div>
              <dt className="font-body text-xs text-text-secondary">Demanda</dt>
              <dd className="mt-1 font-body text-sm font-semibold text-text-primary">
                {demandSignal.label}
                {demandSignal.percentile !== null ? (
                  <span className="ml-1 font-mono text-xs font-normal tabular-nums text-text-secondary">
                    P{demandSignal.percentile}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-body text-xs text-text-secondary">{label}</dt>
      <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-text-primary">
        {value}
      </dd>
    </div>
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

function formatCount(
  pais: SweetSpotCountry,
  value: number | string | null,
) {
  const numberValue = toNumberOrNull(value);

  if (numberValue === null) {
    return "—";
  }

  return countFormatter[pais].format(numberValue);
}

function getDemandSignal(value: number | string | null) {
  const percentileValue = toNumberOrNull(value);

  if (percentileValue === null) {
    return { label: "Sin clasificar", percentile: null };
  }

  const normalized = Math.min(Math.max(percentileValue, 0), 1);
  const percentile = Math.round(normalized * 100);

  if (normalized >= 0.75) {
    return { label: "Alta", percentile };
  }

  if (normalized >= 0.6) {
    return { label: "Media-alta", percentile };
  }

  if (normalized >= 0.5) {
    return { label: "Media", percentile };
  }

  return { label: "Baja", percentile };
}

function getCandidateSummary({
  pais,
  percentil,
  tendenciaRatio,
}: {
  pais: SweetSpotCountry;
  percentil: number | string | null;
  tendenciaRatio: number | string | null;
}) {
  const country = pais === "CO" ? "Colombia" : "México";
  const percentileValue = toNumberOrNull(percentil);
  const ratio = toNumberOrNull(tendenciaRatio);
  const trend = getTrendSummary(ratio);

  if (percentileValue === null) {
    return `Su demanda aún no tiene percentil en ${country}, pero ${trend}.`;
  }

  if (percentileValue >= 0.75) {
    return `Está entre los productos de demanda alta en ${country} y ${trend}.`;
  }

  if (percentileValue >= 0.6) {
    return `Tiene una demanda media-alta en ${country} y ${trend}.`;
  }

  if (percentileValue >= 0.5) {
    return `Se mueve en la franja media de demanda en ${country} y ${trend}.`;
  }

  return `Aún está en una franja de demanda baja en ${country}, aunque ${trend}.`;
}

function getTrendSummary(ratio: number | null) {
  if (ratio === null) {
    return "su tendencia reciente está pendiente de clasificación";
  }

  if (ratio >= 3) {
    return "su ritmo de venta se disparó en el tramo más reciente";
  }

  if (ratio >= 1.5) {
    return "sus ventas están ganando velocidad";
  }

  if (ratio >= 1.2) {
    return "mantiene una subida clara en el tramo reciente";
  }

  if (ratio > 1) {
    return "muestra una subida gradual";
  }

  return "mantiene un ritmo reciente estable";
}

function getDropkillerProductUrl(value: string | null) {
  const uuid = value?.trim();

  return uuid
    ? `https://www.dropkiller.com/dashboard/products/${encodeURIComponent(uuid)}`
    : null;
}
