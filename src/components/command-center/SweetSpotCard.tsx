"use client";

import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  ImageIcon,
} from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import {
  saveDropkillerProduct,
  type SaveDropkillerProductInput,
} from "@/app/(app)/command-center/investigacion/actions";
import { MomentumBadge } from "@/components/command-center/MomentumBadge";
import { Button } from "@/components/ui/button";

export type SweetSpotCountry = "CO" | "MX";

export type SweetSpotCandidate = {
  external_id: string | number | null;
  dropkiller_uuid: string | null;
  primary_image_url: string | null;
  platform: string | null;
  country_code: SweetSpotCountry;
  nombre_producto: string | null;
  sale_price: number | string | null;
  suggested_price: number | string | null;
  stock: number | string | null;
  providers_count: number | string | null;
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
  isSaved?: boolean;
  comparisonLabel?: string;
  showRawSignals?: boolean;
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

export function SweetSpotCard({
  candidate,
  isSaved = false,
  comparisonLabel,
  showRawSignals = false,
}: SweetSpotCardProps) {
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
    comparisonIsSample: Boolean(comparisonLabel),
  });
  const saveAction = saveDropkillerProduct.bind(
    null,
    getSavePayload(candidate),
  );

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
        <div className="flex min-w-0 items-start gap-4">
          <ProductThumbnail
            src={candidate.primary_image_url}
            productName={productName}
          />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-4">
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

            {comparisonLabel ? (
              <div className="mt-3 rounded-2xl bg-[var(--color-accent)]/10 px-3 py-2">
                <p className="font-body text-xs font-semibold text-[var(--color-accent)]">
                  Percentil{" "}
                  <span className="font-mono tabular-nums">
                    P{formatPercentile(candidate.percentil_ritmo)}
                  </span>
                </p>
                <p className="mt-1 font-body text-xs leading-relaxed text-text-secondary">
                  {comparisonLabel}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          {hasMomentumBadge ? (
            <div>
              <span className="font-body text-xs font-semibold uppercase text-text-secondary">
                Tendencia reciente
              </span>
              <div
                className={`mt-2 ${productUrl ? "pointer-events-auto" : ""}`}
              >
                <MomentumBadge
                  tendenciaRatio={candidate.tendencia_ratio}
                  tercio1Promedio={candidate.tercio1_promedio}
                  tercio3Promedio={candidate.tercio3_promedio}
                />
              </div>
            </div>
          ) : (
            <span />
          )}

          <form
            action={saveAction}
            className="pointer-events-auto relative z-20"
          >
            <SaveButton isSaved={isSaved} disabled={!candidate.external_id} />
          </form>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="font-body text-xs font-semibold uppercase text-text-secondary">
            Datos duros
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
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
            <CompetitionStat pais={pais} value={candidate.providers_count} />
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

          {showRawSignals ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="font-body text-xs font-semibold uppercase text-text-secondary">
                Señales calculadas
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Stat
                  label="Ritmo reciente"
                  value={formatSignal(candidate.ritmo_reciente, "/día")}
                />
                <Stat
                  label="Días con venta 7d"
                  value={formatSignal(
                    candidate.dias_con_venta_7d,
                    " días",
                    0,
                  )}
                />
                <Stat
                  label="Tercio 1"
                  value={formatSignal(candidate.tercio1_promedio, "/día")}
                />
                <Stat
                  label="Tercio 2"
                  value={formatSignal(candidate.tercio2_promedio, "/día")}
                />
                <Stat
                  label="Tercio 3"
                  value={formatSignal(candidate.tercio3_promedio, "/día")}
                />
                <Stat
                  label="Tendencia"
                  value={formatSignal(candidate.tendencia_ratio, "x")}
                />
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ProductThumbnail({
  src,
  productName,
}: {
  src: string | null;
  productName: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-border bg-bg-page text-text-secondary">
        <ImageIcon aria-hidden="true" className="h-7 w-7" />
        <span className="sr-only">Imagen no disponible</span>
      </div>
    );
  }

  return (
    // Dropkiller serves product images from dynamic CDN hosts not configured in Next/Image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={productName}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-20 w-20 shrink-0 rounded-xl border border-border bg-bg-page object-cover"
    />
  );
}

function SaveButton({
  isSaved,
  disabled,
}: {
  isSaved: boolean;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="sm"
      variant={isSaved ? "secondary" : "default"}
      disabled={isSaved || disabled || pending}
      className={[
        "rounded-full",
        isSaved
          ? "bg-positive-bg text-positive hover:bg-positive-bg"
          : "bg-gradient-to-r from-accent-from to-accent-to text-bg-surface hover:opacity-90",
      ].join(" ")}
    >
      {isSaved ? (
        <BookmarkCheck aria-hidden="true" />
      ) : (
        <Bookmark aria-hidden="true" />
      )}
      {pending ? "Guardando..." : isSaved ? "Guardado" : "Guardar"}
    </Button>
  );
}

function getSavePayload(
  candidate: SweetSpotCandidate,
): SaveDropkillerProductInput {
  return {
    external_id: candidate.external_id,
    dropkiller_uuid: candidate.dropkiller_uuid,
    country_code: candidate.country_code,
    nombre_producto: candidate.nombre_producto,
    sale_price: candidate.sale_price,
    primary_image_url: candidate.primary_image_url,
    sold_units_last_7_days: candidate.sold_units_last_7_days,
    sold_units_last_30_days: candidate.sold_units_last_30_days,
    total_sold_units: candidate.total_sold_units,
    providers_count: candidate.providers_count,
  };
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

function CompetitionStat({
  pais,
  value,
}: {
  pais: SweetSpotCountry;
  value: number | string | null;
}) {
  const providersCount = toNumberOrNull(value);

  return (
    <div>
      <dt className="font-body text-xs text-text-secondary">Competencia</dt>
      <dd className="mt-1 font-body text-sm font-semibold text-text-primary">
        {providersCount === null ? (
          "Sin datos"
        ) : (
          <>
            <span className="font-mono text-base tabular-nums">
              {formatCount(pais, providersCount)}
            </span>{" "}
            {providersCount === 1 ? "vendedor" : "vendedores"}
          </>
        )}
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

function formatPercentile(value: number | string | null) {
  const percentileValue = toNumberOrNull(value);

  if (percentileValue === null) {
    return "—";
  }

  return String(
    Math.round(Math.min(Math.max(percentileValue, 0), 1) * 100),
  );
}

function formatSignal(
  value: number | string | null,
  suffix: string,
  fractionDigits = 2,
) {
  const numberValue = toNumberOrNull(value);

  if (numberValue === null) {
    return "—";
  }

  return `${numberValue.toFixed(fractionDigits)}${suffix}`;
}

function getCandidateSummary({
  pais,
  percentil,
  tendenciaRatio,
  comparisonIsSample = false,
}: {
  pais: SweetSpotCountry;
  percentil: number | string | null;
  tendenciaRatio: number | string | null;
  comparisonIsSample?: boolean;
}) {
  const country = pais === "CO" ? "Colombia" : "México";
  const percentileValue = toNumberOrNull(percentil);
  const ratio = toNumberOrNull(tendenciaRatio);
  const trend = getTrendSummary(ratio);

  if (percentileValue === null) {
    return `Su demanda aún no tiene percentil en ${country}, pero ${trend}.`;
  }

  if (comparisonIsSample) {
    if (percentileValue >= 0.75) {
      return `Dentro de la muestra diaria de ${country}, se ubica en demanda alta y ${trend}.`;
    }

    if (percentileValue >= 0.6) {
      return `Dentro de la muestra diaria de ${country}, se ubica en demanda media-alta y ${trend}.`;
    }

    if (percentileValue >= 0.5) {
      return `Dentro de la muestra diaria de ${country}, se mueve en la franja media y ${trend}.`;
    }

    return `Dentro de la muestra diaria de ${country}, aún está en una franja de demanda baja, aunque ${trend}.`;
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
