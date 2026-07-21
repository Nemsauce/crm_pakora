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
    className: "bg-bg-page text-[var(--foreground)]",
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
    <article className="rounded-2xl border border-border bg-bg-surface p-4 text-text-primary shadow-lg">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="break-words font-display text-base font-semibold text-text-primary">
            {row.nombre_producto}
          </h4>
        </div>

        <div className="shrink-0 sm:text-right">
          <p className="font-body text-xs text-text-secondary">Total</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text-primary">
            {formatCount(pais, row.total)}
          </p>
        </div>
      </div>

      {visibleChips.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {visibleChips.map((chip) => (
            <span
              key={chip.key}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-xs font-semibold ${chip.className}`}
            >
              <span>{chip.label}:</span>
              <span className="font-mono tabular-nums">
                {formatCount(pais, row[chip.key])}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4">
        {percentageMetrics.map((metric) => (
          <div
            key={metric.key}
            className={`rounded-2xl px-3 py-2 ${metric.className}`}
          >
            <p className="font-body text-[0.7rem] font-semibold">
              {metric.label}
            </p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
              {formatPercentage(row.total, row[metric.key])}
            </p>
          </div>
        ))}
      </div>
    </article>
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
    <section className="min-w-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            {countryLabel[pais]}
          </p>
          <h3 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Pedidos por producto
          </h3>
        </div>
        <p className="font-body text-sm text-text-secondary">
          Total y estados críticos
        </p>
      </div>

      <label
        htmlFor={searchId}
        className="mt-4 block font-body text-xs text-text-secondary"
      >
        Buscar producto
      </label>
      <div className="mt-1.5 flex h-11 items-center gap-2 rounded-2xl border border-border bg-bg-surface px-3 shadow-sm focus-within:ring-2 focus-within:ring-ring">
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

      {sortedRows.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {sortedRows.map((row) => (
            <ProductCard
              key={`${row.pais}-${row.nombre_producto}`}
              pais={pais}
              row={row}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-bg-page p-4 font-body text-sm text-text-secondary">
          {rows.length > 0 ? "Sin resultados" : "Sin datos"}
        </div>
      )}
    </section>
  );
}

export function ProductSummaryTable({ rows }: ProductSummaryTableProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
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
