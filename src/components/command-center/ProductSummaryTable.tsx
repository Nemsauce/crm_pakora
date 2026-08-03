"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import type { Database } from "@/lib/supabase/database.types";

export type ProductSummaryRow =
  Database["public"]["Functions"]["product_order_summary"]["Returns"][number];

type Pais = ProductSummaryRow["pais"];
type StatusCountKey =
  | "pendientes"
  | "confirmados"
  | "en_transito"
  | "entregados"
  | "cancelados"
  | "devoluciones";
type PercentageKey =
  | "pct_confirmacion"
  | "pct_cancelacion"
  | "pct_entrega"
  | "pct_devolucion";

type ProductSummaryTableProps = {
  rows: ProductSummaryRow[];
};

const countryLabel: Record<Pais, string> = {
  CO: "Colombia",
  MX: "México",
};

const countries = ["CO", "MX"] as const satisfies readonly Pais[];

const statusChips = [
  {
    key: "pendientes",
    label: "Pendientes",
    className: "bg-risk-medium-bg text-risk-medium",
  },
  {
    key: "confirmados",
    label: "Confirmados",
    className: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  },
  {
    key: "en_transito",
    label: "En tránsito",
    className:
      "bg-[var(--color-bg-surface-subtle)] text-[var(--foreground)]",
  },
  {
    key: "entregados",
    label: "Entregados",
    className: "bg-risk-low-bg text-risk-low",
  },
  {
    key: "cancelados",
    label: "Cancelados",
    className: "bg-risk-high-bg text-risk-high",
  },
  {
    key: "devoluciones",
    label: "Devoluciones",
    className: "bg-risk-high-bg text-risk-high",
  },
] satisfies {
  key: StatusCountKey;
  label: string;
  className: string;
}[];

const percentageMetrics = [
  {
    key: "pct_confirmacion",
    label: "Confirmación",
    className: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  },
  {
    key: "pct_entrega",
    label: "Entrega",
    className: "bg-risk-low-bg text-risk-low",
  },
  {
    key: "pct_cancelacion",
    label: "Cancelación",
    className: "bg-risk-high-bg text-risk-high",
  },
  {
    key: "pct_devolucion",
    label: "Devolución",
    className: "bg-risk-high-bg text-risk-high",
  },
] satisfies {
  key: PercentageKey;
  label: string;
  className: string;
}[];

const countFormatter = {
  CO: new Intl.NumberFormat("es-CO"),
  MX: new Intl.NumberFormat("es-MX"),
} satisfies Record<Pais, Intl.NumberFormat>;

function formatCount(pais: Pais, value: number) {
  return countFormatter[pais].format(value);
}

function formatPercentage(total: number, value: number | null | undefined) {
  if (total === 0 || value === null || value === undefined) {
    return "—";
  }

  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(1)}%`;
}

function ProductCard({ pais, row }: { pais: Pais; row: ProductSummaryRow }) {
  const visibleChips = statusChips.filter((chip) => row[chip.key] > 0);

  return (
    <article className="min-h-[var(--density-row-height-compact)] rounded-xl border border-transparent bg-[var(--color-bg-surface-elevated)] p-3 text-text-primary shadow-sm">
      <div className="grid min-w-0 grid-cols-2 items-center gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(4.5rem,0.35fr)_minmax(15rem,1.4fr)_minmax(5rem,0.5fr)_minmax(5rem,0.5fr)_minmax(5rem,0.5fr)_minmax(5rem,0.5fr)] xl:gap-2">
        <div className="min-w-0">
          <p className="font-body text-[0.68rem] font-semibold uppercase text-text-secondary xl:hidden">
            Producto
          </p>
          <h4 className="break-words font-display text-base font-semibold text-text-primary">
            {row.nombre_producto}
          </h4>
        </div>

        <div className="shrink-0 text-right xl:text-left">
          <p className="font-body text-[0.68rem] font-semibold uppercase text-text-secondary xl:hidden">
            Total
          </p>
          <p className="font-mono text-lg font-semibold tabular-nums text-text-primary">
            {formatCount(pais, row.total)}
          </p>
        </div>

        <div className="col-span-2 flex min-w-0 flex-wrap gap-1.5 xl:col-span-1">
          {visibleChips.length > 0
            ? visibleChips.map((chip) => (
                <span
                  key={chip.key}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-body text-[0.7rem] font-semibold ${chip.className}`}
                >
                  <span>{chip.label}:</span>
                  <span className="font-mono tabular-nums">
                    {formatCount(pais, row[chip.key])}
                  </span>
                </span>
              ))
            : null}
        </div>

        {percentageMetrics.map((metric) => (
          <div
            key={metric.key}
            className={`rounded-lg px-2.5 py-2 xl:rounded-none xl:bg-transparent xl:px-0 xl:py-0 ${metric.className}`}
          >
            <p className="font-body text-[0.68rem] font-semibold xl:hidden">
              {metric.label}
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums">
              {formatPercentage(row.total, row[metric.key])}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function ProductTableHeader() {
  return (
    <div
      className="hidden grid-cols-[minmax(0,1.35fr)_minmax(4.5rem,0.35fr)_minmax(15rem,1.4fr)_minmax(5rem,0.5fr)_minmax(5rem,0.5fr)_minmax(5rem,0.5fr)_minmax(5rem,0.5fr)] gap-2 px-3 pb-2 font-body text-[0.68rem] font-semibold uppercase tracking-wide text-text-secondary xl:grid"
      aria-hidden="true"
    >
      <span>Producto</span>
      <span>Total</span>
      <span>Estados</span>
      {percentageMetrics.map((metric) => (
        <span key={metric.key}>{metric.label}</span>
      ))}
    </div>
  );
}

function ProductCountrySection({
  pais,
  rows,
}: {
  pais: Pais;
  rows: ProductSummaryRow[];
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  const sortedRows = rows
    .filter((row) =>
      row.nombre_producto
        .toLocaleLowerCase("es")
        .includes(normalizedSearch),
    )
    .sort((a, b) => b.total - a.total);
  const searchId = `product-search-${pais.toLowerCase()}`;

  return (
    <section className="min-w-0 rounded-2xl border border-transparent bg-[var(--color-bg-surface-subtle)] p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            {countryLabel[pais]}
          </p>
          <h3 className="mt-1.5 font-display text-lg font-semibold text-text-primary">
            Pedidos por producto
          </h3>
          <p className="mt-1 font-body text-sm text-text-secondary">
            Total y estados críticos
          </p>
        </div>

        <div className="w-full lg:max-w-sm">
          <label
            htmlFor={searchId}
            className="block font-body text-xs text-text-secondary"
          >
            Buscar producto
          </label>
          <div className="mt-1.5 flex min-h-[var(--density-row-height-compact)] items-center gap-2 rounded-xl border border-border bg-[var(--color-bg-surface-elevated)] px-3 shadow-sm transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus-within:ring-2 focus-within:ring-ring">
            <Search
              className="h-4 w-4 shrink-0 text-text-secondary"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre"
              className="h-8 border-0 bg-transparent p-0 font-body text-sm text-text-primary shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
      </div>

      {sortedRows.length > 0 ? (
        <div className="mt-5">
          <ProductTableHeader />
          <div className="grid gap-2">
            {sortedRows.map((row) => (
              <ProductCard
                key={`${row.pais}-${row.nombre_producto}`}
                pais={pais}
                row={row}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-transparent bg-[var(--color-bg-surface-elevated)] p-4 font-body text-sm text-text-secondary shadow-sm">
          {rows.length > 0 ? "Sin resultados" : "Sin datos"}
        </div>
      )}
    </section>
  );
}

export function ProductSummaryTable({ rows }: ProductSummaryTableProps) {
  return (
    <div className="grid gap-5">
      {countries.map((pais) => (
        <ProductCountrySection
          key={pais}
          pais={pais}
          rows={rows.filter((row) => row.pais === pais)}
        />
      ))}
    </div>
  );
}
