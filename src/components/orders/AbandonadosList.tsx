"use client";

import { Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import {
  triggerAbandonadosSync,
  type TriggerAbandonadosSyncResult,
} from "@/app/(app)/pedidos/abandonados-actions";
import {
  AbandonadoRow,
  type AbandonadoListItem,
} from "@/components/orders/AbandonadoRow";
import { Button } from "@/components/ui/button";

export type { AbandonadoListItem } from "@/components/orders/AbandonadoRow";

type AbandonadosListProps = {
  rows: AbandonadoListItem[];
  totalCount: number;
  page: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

const COUNTRY_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "CO", label: "CO" },
  { value: "MX", label: "MX" },
];

const STATE_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "nuevo", label: "Nuevos" },
  { value: "contactado", label: "Contactados" },
  { value: "recuperado", label: "Recuperados" },
  { value: "descartado", label: "Descartados" },
];

function FilterPills({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="mr-1 font-body text-xs font-semibold uppercase text-text-secondary">
        {label}
      </legend>
      <div className="inline-flex flex-wrap rounded-full border border-border bg-bg-surface p-1">
        {options.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.value)}
              className={`h-8 rounded-full px-3 font-body text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? "bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)]"
                  : "text-text-secondary hover:bg-bg-page hover:text-text-primary"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AbandonadosList({
  rows,
  totalCount,
  page,
  hasPreviousPage,
  hasNextPage,
}: AbandonadosListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSyncing, startSyncTransition] = useTransition();
  const [syncResult, setSyncResult] =
    useState<TriggerAbandonadosSyncResult | null>(null);
  const selectedCountry = COUNTRY_OPTIONS.some(
    (option) => option.value === searchParams.get("pais"),
  )
    ? (searchParams.get("pais") ?? "todos")
    : "todos";
  const selectedState = STATE_OPTIONS.some(
    (option) => option.value === searchParams.get("estado_abandonado"),
  )
    ? (searchParams.get("estado_abandonado") ?? "todos")
    : "todos";

  function updateFilter(key: "pais" | "estado_abandonado", value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("vista", "abandonados");
    params.delete("page");

    if (value === "todos") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.push(`${pathname}?${params.toString()}`);
  }

  function buildPageHref(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("vista", "abandonados");

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    } else {
      params.delete("page");
    }

    return `${pathname}?${params.toString()}`;
  }

  function handleSync() {
    setSyncResult(null);

    startSyncTransition(async () => {
      try {
        const result = await triggerAbandonadosSync();
        setSyncResult(
          result.ok
            ? result
            : {
                ok: false,
                message:
                  "La sincronización no se completó. Se recargaron los datos que alcanzaron a guardarse.",
              },
        );
        router.refresh();
      } catch {
        setSyncResult({
          ok: false,
          message:
            "La sincronización no se completó. Se recargaron los datos disponibles.",
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-surface p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3">
          <FilterPills
            label="País"
            value={selectedCountry}
            options={COUNTRY_OPTIONS}
            onChange={(value) => updateFilter("pais", value)}
          />
          <FilterPills
            label="Estado"
            value={selectedState}
            options={STATE_OPTIONS}
            onChange={(value) => updateFilter("estado_abandonado", value)}
          />
        </div>

        <div className="flex max-w-full flex-col items-start gap-2 lg:items-end">
          <Button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="h-10 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-5 font-body font-semibold text-bg-surface shadow-md shadow-[var(--color-accent)]/20 hover:opacity-90 disabled:opacity-60"
          >
            {isSyncing ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            {isSyncing ? "Sincronizando..." : "Sincronizar"}
          </Button>

          <div aria-live="polite">
            {syncResult ? (
              <p
                role={syncResult.ok ? "status" : "alert"}
                className={`max-w-sm font-body text-xs ${
                  syncResult.ok ? "text-positive" : "text-negative"
                }`}
              >
                {syncResult.message}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <p className="mt-5 font-body text-sm text-text-secondary" aria-live="polite">
        <span className="font-mono font-semibold tabular-nums text-text-primary">
          {totalCount}
        </span>{" "}
        {totalCount === 1 ? "pedido abandonado" : "pedidos abandonados"}
      </p>

      {rows.length > 0 ? (
        <div className="mt-3 space-y-3">
          {rows.map((row, index) => (
            <div
              key={`${row.id}-${row.sincronizado_en}`}
              className="crm-list-entrance"
              style={{ animationDelay: `${Math.min(index * 40, 480)}ms` }}
            >
              <AbandonadoRow row={row} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-border bg-bg-surface p-6 font-body text-sm text-text-secondary shadow-md">
          No hay pedidos abandonados que coincidan con estos filtros.
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <Button
          asChild={hasPreviousPage}
          type="button"
          variant="outline"
          disabled={!hasPreviousPage}
          className="border-border bg-bg-base text-text-primary hover:bg-bg-base hover:text-text-primary"
        >
          {hasPreviousPage ? (
            <Link href={buildPageHref(page - 1)}>Anterior</Link>
          ) : (
            "Anterior"
          )}
        </Button>

        <p className="font-mono text-sm text-text-secondary">Página {page}</p>

        <Button
          asChild={hasNextPage}
          type="button"
          variant="outline"
          disabled={!hasNextPage}
          className="border-border bg-bg-base text-text-primary hover:bg-bg-base hover:text-text-primary"
        >
          {hasNextPage ? (
            <Link href={buildPageHref(page + 1)}>Siguiente</Link>
          ) : (
            "Siguiente"
          )}
        </Button>
      </div>
    </div>
  );
}
