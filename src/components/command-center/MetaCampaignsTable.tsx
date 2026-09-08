"use client";

import { Activity, Globe2 } from "lucide-react";
import { useMemo, useState } from "react";

export type MetaCampaignRow = {
  id: string;
  ad_account_id: string;
  nombre: string;
  estado: string;
  objetivo: string | null;
  pais: string | null;
  gasto: number | null;
  impresiones: number | null;
  clics: number | null;
  alcance: number | null;
  moneda: string | null;
  insight_desde: string | null;
  insight_hasta: string | null;
  actualizado_en: string;
};

type MetaCampaignsTableProps = {
  campaigns: MetaCampaignRow[];
};

type CountryFilter = "todos" | "CO" | "MX" | "sin_pais";
type CampaignCountry = Exclude<CountryFilter, "todos">;

const countFormatter = new Intl.NumberFormat("es-CO");
const decimalFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const insightDateFormatter = new Intl.DateTimeFormat("es-CO", {
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
  PAUSED: "border-transparent bg-risk-medium-bg text-risk-medium",
  ARCHIVED:
    "border-[var(--color-border)] bg-[var(--color-bg-surface-base)] text-text-secondary",
  DELETED: "border-transparent bg-negative-bg text-negative",
};

const countryLabels: Record<CampaignCountry, string> = {
  CO: "Colombia",
  MX: "México",
  sin_pais: "Sin asignar",
};

function toFiniteNumber(value: number | string | null) {
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
      minimumFractionDigits: 2,
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

function getCountryFilter(country: string | null): CampaignCountry {
  const normalized = country?.trim().toUpperCase();

  if (normalized === "CO" || normalized === "MX") {
    return normalized;
  }

  return "sin_pais";
}

function formatCountry(country: string | null) {
  return countryLabels[getCountryFilter(country)];
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No disponible" : updatedAtFormatter.format(date);
}

function parseInsightDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMissingInsightRanges(count: number) {
  return `${count} ${count === 1 ? "campaña" : "campañas"} sin periodo confirmado`;
}

function getInsightPeriod(campaigns: MetaCampaignRow[]) {
  const ranges = new Map<string, { from: string; to: string }>();
  let campaignsWithRange = 0;

  for (const campaign of campaigns) {
    if (campaign.insight_desde && campaign.insight_hasta) {
      campaignsWithRange += 1;
      ranges.set(`${campaign.insight_desde}:${campaign.insight_hasta}`, {
        from: campaign.insight_desde,
        to: campaign.insight_hasta,
      });
    }
  }

  if (ranges.size === 0) {
    return "Periodo de insights no disponible";
  }

  if (ranges.size > 1) {
    const missingRanges = campaigns.length - campaignsWithRange;

    return missingRanges > 0
      ? `Los registros contienen varios periodos de insights y ${formatMissingInsightRanges(missingRanges)}`
      : "Los registros contienen varios periodos de insights";
  }

  const [{ from, to }] = [...ranges.values()];
  const fromDate = parseInsightDate(from);
  const toDate = parseInsightDate(to);

  if (!fromDate || !toDate) {
    return "Periodo de insights no disponible";
  }

  const period = `Insights del ${insightDateFormatter.format(fromDate)} al ${insightDateFormatter.format(toDate)}`;
  const missingRanges = campaigns.length - campaignsWithRange;

  return missingRanges > 0
    ? `${period}; ${formatMissingInsightRanges(missingRanges)}`
    : period;
}

export function MetaCampaignsTable({ campaigns }: MetaCampaignsTableProps) {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("todos");
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
  const effectiveStatusFilter =
    statusFilter === "todos" || statusOptions.includes(statusFilter)
      ? statusFilter
      : "todos";
  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => {
        const matchesStatus =
          effectiveStatusFilter === "todos" ||
          campaign.estado.trim().toUpperCase() === effectiveStatusFilter;
        const matchesCountry =
          countryFilter === "todos" ||
          getCountryFilter(campaign.pais) === countryFilter;

        return matchesStatus && matchesCountry;
      }),
    [campaigns, countryFilter, effectiveStatusFilter],
  );

  return (
    <section className="rounded-2xl border border-transparent bg-[var(--color-bg-surface-subtle)] p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Cuenta publicitaria configurada
          </p>
          <h2 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Rendimiento por campaña
          </h2>
          <p className="mt-1 font-body text-sm text-text-secondary">
            {getInsightPeriod(campaigns)}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
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
                className="min-h-[var(--density-row-height-compact)] w-full min-w-44 rounded-xl border border-border bg-[var(--color-bg-surface-elevated)] py-2 pr-8 pl-9 font-body text-sm text-text-primary outline-none transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="todos">Todos los estados</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="grid gap-1.5">
            <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-secondary">
              País
            </span>
            <span className="relative block">
              <Globe2
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary"
              />
              <select
                value={countryFilter}
                onChange={(event) =>
                  setCountryFilter(event.target.value as CountryFilter)
                }
                className="min-h-[var(--density-row-height-compact)] w-full min-w-44 rounded-xl border border-border bg-[var(--color-bg-surface-elevated)] py-2 pr-8 pl-9 font-body text-sm text-text-primary outline-none transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="todos">Todos los países</option>
                <option value="CO">Colombia</option>
                <option value="MX">México</option>
                <option value="sin_pais">Sin asignar</option>
              </select>
            </span>
          </label>
        </div>
      </div>

      <p className="mt-4 font-body text-xs text-text-secondary" aria-live="polite">
        {filteredCampaigns.length} de {campaigns.length} {campaigns.length === 1 ? "campaña" : "campañas"}
      </p>

      {filteredCampaigns.length > 0 ? (
        <div
          role="region"
          aria-label="Tabla de campañas de Meta Ads"
          tabIndex={0}
          className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-elevated)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <table className="w-full min-w-[72rem] border-collapse text-left">
            <caption className="sr-only">
              Campañas de Meta con rendimiento reportado durante el periodo de insights
            </caption>
            <thead className="bg-[var(--color-bg-surface-base)]">
              <tr className="font-body text-[0.68rem] font-semibold uppercase tracking-wide text-text-secondary">
                <th scope="col" className="px-4 py-3">Nombre</th>
                <th scope="col" className="px-3 py-3">Estado</th>
                <th scope="col" className="px-3 py-3">País</th>
                <th scope="col" className="px-3 py-3 text-right">Gasto</th>
                <th scope="col" className="px-3 py-3 text-right">Impresiones</th>
                <th scope="col" className="px-3 py-3 text-right">Clics</th>
                <th scope="col" className="px-3 py-3 text-right">Alcance</th>
                <th scope="col" className="px-4 py-3">Última actualización</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {filteredCampaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  className="min-h-[var(--density-row-height-compact)] transition-colors duration-[var(--motion-duration-hover-focus)] hover:bg-[var(--color-bg-hover)]"
                >
                  <td className="max-w-sm px-4 py-3">
                    <p className="break-words font-body text-sm font-semibold text-text-primary">
                      {campaign.nombre}
                    </p>
                    <p className="mt-1 font-mono text-[0.68rem] tabular-nums text-text-secondary">
                      {campaign.id}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 font-body text-xs font-semibold ${getStatusClass(campaign.estado)}`}
                    >
                      {formatStatus(campaign.estado)}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-body text-sm text-text-secondary">
                    {formatCountry(campaign.pais)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-sm font-semibold tabular-nums text-text-primary">
                    {formatCurrency(campaign.gasto, campaign.moneda)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-sm tabular-nums text-text-secondary">
                    {formatCount(campaign.impresiones)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-sm tabular-nums text-text-secondary">
                    {formatCount(campaign.clics)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-sm tabular-nums text-text-secondary">
                    {formatCount(campaign.alcance)}
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-text-secondary">
                    <time dateTime={campaign.actualizado_en}>
                      {formatUpdatedAt(campaign.actualizado_en)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-transparent bg-[var(--color-bg-surface-elevated)] p-6 font-body text-sm text-text-secondary shadow-sm">
          {campaigns.length > 0
            ? "No hay campañas que coincidan con los filtros."
            : "Aún no hay campañas sincronizadas. Usa Actualizar para consultar Meta Ads."}
        </div>
      )}
    </section>
  );
}
