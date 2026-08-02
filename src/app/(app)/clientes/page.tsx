import {
  ArrowDown,
  ChevronRight,
  Search,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCustomerDirectory,
  type CustomerDirectoryRow,
} from "@/lib/clientes/getCustomerDirectory";
import { getCustomerHistoryStats } from "@/lib/orders/getCustomerHistoryStats";
import type { Database } from "@/lib/supabase/database.types";

const PAGE_SIZE = 24;

type Pais = Database["public"]["Enums"]["pais_enum"];

type SearchParams = {
  q?: string | string[];
  pais?: string | string[];
  page?: string | string[];
};

type ClientesPageProps = {
  searchParams: Promise<SearchParams>;
};

const paisLabel: Record<Pais, string> = {
  CO: "Colombia",
  MX: "México",
};

const riskLabel = {
  alto: "Alto",
  medio: "Medio",
  bajo: "Bajo",
  sin_datos: "Sin datos",
} as const;

const riskClassName: Record<keyof typeof riskLabel, string> = {
  alto: "bg-risk-high-bg text-risk-high",
  medio: "bg-risk-medium-bg text-risk-medium",
  bajo: "bg-risk-low-bg text-risk-low",
  sin_datos:
    "bg-[var(--color-bg-surface-subtle)] text-[var(--muted-foreground)]",
};

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPage(value: string | string[] | undefined) {
  const page = Number(getFirstParam(value));

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function getCountry(value: string | string[] | undefined): Pais | null {
  const country = getFirstParam(value);
  return country === "CO" || country === "MX" ? country : null;
}

function getCustomerName(customer: CustomerDirectoryRow) {
  return (
    [customer.nombre, customer.apellido].filter(Boolean).join(" ").trim() ||
    "Cliente sin nombre"
  );
}

function normalizeRisk(value: string | null): keyof typeof riskLabel {
  return value === "alto" || value === "medio" || value === "bajo"
    ? value
    : "sin_datos";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin actividad";
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? "Fecha inválida"
    : dateFormatter.format(date);
}

function createPageHref(params: SearchParams, page: number) {
  const nextParams = new URLSearchParams();
  const query = getFirstParam(params.q)?.trim();
  const country = getCountry(params.pais);

  if (query) {
    nextParams.set("q", query);
  }

  if (country) {
    nextParams.set("pais", country);
  }

  if (page > 1) {
    nextParams.set("page", String(page));
  }

  const search = nextParams.toString();
  return search ? `/clientes?${search}` : "/clientes";
}

function getProfileHref(customer: CustomerDirectoryRow) {
  const params = new URLSearchParams({ pais: customer.pais });
  return `/clientes/${encodeURIComponent(customer.telefono)}?${params.toString()}`;
}

function CustomerRow({ customer }: { customer: CustomerDirectoryRow }) {
  const risk = normalizeRisk(customer.nivel_riesgo);
  const history = getCustomerHistoryStats(customer);
  const name = getCustomerName(customer);

  return (
    <Link
      href={getProfileHref(customer)}
      className="grid min-h-[var(--density-row-height-compact)] grid-cols-2 items-center gap-3 rounded-lg border border-transparent bg-[var(--color-bg-surface-elevated)] p-3 text-[var(--foreground)] shadow-sm outline-none transition-[background-color,border-color,box-shadow] duration-[var(--motion-duration-hover-focus)] hover:bg-[var(--color-bg-hover)] hover:shadow-md focus-visible:border-[var(--color-border-selected)] focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.46fr)_minmax(0,0.62fr)_minmax(0,0.72fr)_minmax(0,0.62fr)_minmax(0,1.2fr)_1.5rem] lg:gap-2 lg:px-3 lg:py-1.5"
    >
      <div className="col-span-2 min-w-0 lg:col-span-1">
        <p className="truncate font-display text-sm font-semibold text-text-primary">
          {name}
        </p>
        <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-text-secondary">
          {customer.telefono}
        </p>
      </div>

      <div className="min-w-0">
        <p className="mb-1 font-body text-[10px] uppercase tracking-wide text-text-secondary lg:sr-only">
          País
        </p>
        <span
          title={paisLabel[customer.pais]}
          className="inline-flex rounded-full bg-[var(--color-bg-surface-subtle)] px-2 py-1 font-body text-[11px] font-semibold text-text-secondary"
        >
          {customer.pais}
        </span>
      </div>

      <div className="min-w-0">
        <p className="mb-1 font-body text-[10px] uppercase tracking-wide text-text-secondary lg:sr-only">
          Riesgo Dropi
        </p>
        <span
          className={`inline-flex rounded-full px-2 py-1 font-body text-[11px] font-semibold ${riskClassName[risk]}`}
        >
          {riskLabel[risk]}
        </span>
      </div>

      <div className="min-w-0">
        <p className="mb-1 font-body text-[10px] uppercase tracking-wide text-text-secondary lg:sr-only">
          Actividad reciente
        </p>
        <p className="font-mono text-xs tabular-nums text-text-primary">
          {formatDate(customer.ultimo_pedido_fecha)}
        </p>
      </div>

      <div className="min-w-0">
        <p className="mb-1 font-body text-[10px] uppercase tracking-wide text-text-secondary lg:sr-only">
          Pedidos en Pakora
        </p>
        <p className="font-mono text-sm font-semibold tabular-nums text-text-primary">
          {customer.pedidos_pakora}
        </p>
      </div>

      <div className="col-span-2 min-w-0 lg:col-span-1">
        <p className="mb-1 font-body text-[10px] uppercase tracking-wide text-text-secondary lg:sr-only">
          Historial en Dropi
        </p>
        {history.hasHistory ? (
          <p className="truncate font-body text-xs text-text-secondary">
            <span className="font-mono font-semibold tabular-nums text-text-primary">
              {history.totalOrders}
            </span>{" "}
            pedidos · {history.deliveredOrders} entregados · {history.otherOrders}{" "}
            otros · {history.returnedOrders} devueltos
          </p>
        ) : (
          <p className="font-body text-xs text-text-secondary">
            Sin historial Dropi
          </p>
        )}
      </div>

      <ChevronRight
        className="hidden h-4 w-4 text-text-secondary lg:block"
        aria-hidden="true"
      />
    </Link>
  );
}

export default async function ClientesPage({
  searchParams,
}: ClientesPageProps) {
  const params = await searchParams;
  const requestedPage = getPage(params.page);
  const country = getCountry(params.pais);
  const query = getFirstParam(params.q)?.trim() ?? "";
  const directory = await getCustomerDirectory({
    query,
    country,
    page: requestedPage,
    pageSize: PAGE_SIZE,
  });
  const { customers, totalCount, page, totalPages } = directory;
  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;
  const hasFilters = Boolean(query || country);
  const firstVisible = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastVisible = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-4 py-5 sm:px-6 lg:px-8">
      <header className="border-b border-border/30 pb-4">
        <p className="font-body text-xs uppercase text-text-secondary">
          Clientes
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-text-primary">
              Directorio de clientes
            </h1>
            <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
              Un registro por cada combinación exacta de país y teléfono, sin
              normalizar los datos almacenados.
            </p>
          </div>
          <div className="flex items-center gap-2 font-body text-xs text-text-secondary">
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
            Actividad más reciente primero
          </div>
        </div>
      </header>

      <form
        action="/clientes"
        method="get"
        role="search"
        className="mt-5 grid gap-3 rounded-2xl border border-transparent bg-[var(--color-bg-surface-subtle)] p-2.5 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(11rem,0.28fr)_auto] md:items-end"
      >
        <label className="min-w-0 font-body text-xs font-semibold text-text-secondary">
          Buscar por nombre o teléfono
          <span className="relative mt-1.5 block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
              aria-hidden="true"
            />
            <Input
              name="q"
              type="search"
              maxLength={200}
              defaultValue={query}
              placeholder="Nombre o teléfono"
              className="h-[var(--density-row-height-compact)] border-border bg-[var(--color-bg-surface-elevated)] pl-9 font-body text-text-primary"
            />
          </span>
        </label>

        <label className="font-body text-xs font-semibold text-text-secondary">
          País
          <select
            name="pais"
            defaultValue={country ?? ""}
            className="mt-1.5 h-[var(--density-row-height-compact)] w-full rounded-lg border border-border bg-[var(--color-bg-surface-elevated)] px-3 font-body text-sm text-text-primary outline-none transition-colors duration-[var(--motion-duration-hover-focus)] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todos los países</option>
            <option value="CO">Colombia</option>
            <option value="MX">México</option>
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            className="h-[var(--density-row-height-compact)] bg-gradient-to-r from-accent-from to-accent-to px-4 text-[var(--color-on-accent)] hover:opacity-90"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Buscar
          </Button>
          {hasFilters ? (
            <Button
              asChild
              type="button"
              variant="ghost"
              className="h-[var(--density-row-height-compact)] text-text-secondary"
            >
              <Link href="/clientes">Limpiar</Link>
            </Button>
          ) : null}
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 font-body text-sm text-text-secondary">
        <p aria-live="polite">
          <span className="font-mono font-semibold tabular-nums text-text-primary">
            {totalCount}
          </span>{" "}
          {totalCount === 1 ? "cliente" : "clientes"}
        </p>
        {totalCount > 0 ? (
          <p className="font-mono text-xs tabular-nums">
            Mostrando {firstVisible}–{lastVisible}
          </p>
        ) : null}
      </div>

      {customers.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-xl bg-[var(--color-bg-surface-subtle)] p-1 shadow-sm">
          <div
            aria-hidden="true"
            className="hidden min-h-[var(--density-row-height-compact)] grid-cols-[minmax(0,1.35fr)_minmax(0,0.46fr)_minmax(0,0.62fr)_minmax(0,0.72fr)_minmax(0,0.62fr)_minmax(0,1.2fr)_1.5rem] items-center gap-2 px-3 font-body text-[11px] font-semibold uppercase tracking-wide text-text-secondary lg:grid"
          >
            <span>Cliente / teléfono</span>
            <span>País</span>
            <span>Riesgo</span>
            <span>Actividad reciente</span>
            <span>Pakora</span>
            <span>Historial en Dropi</span>
            <span />
          </div>

          <div className="grid gap-1" aria-label="Directorio de clientes">
            {customers.map((customer) => (
              <CustomerRow
                key={`${customer.pais}\u0000${customer.telefono}`}
                customer={customer}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex min-h-48 flex-col items-center justify-center rounded-xl bg-[var(--color-bg-surface-elevated)] p-6 text-center shadow-sm">
          <span className="flex size-11 items-center justify-center rounded-full bg-[var(--color-bg-surface-subtle)] text-text-secondary">
            <UsersRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-base font-semibold text-text-primary">
            No encontramos clientes
          </h2>
          <p className="mt-1 max-w-md font-body text-sm text-text-secondary">
            Prueba otro nombre, teléfono o país. La búsqueda no modifica ni
            normaliza el teléfono almacenado.
          </p>
        </div>
      )}

      <nav
        className="mt-6 flex items-center justify-between border-t border-border/30 pt-4"
        aria-label="Paginación del directorio"
      >
        <Button
          asChild={hasPreviousPage}
          type="button"
          variant="outline"
          disabled={!hasPreviousPage}
          className="border-border bg-[var(--color-bg-surface-elevated)] text-text-primary hover:bg-[var(--color-bg-hover)] hover:text-text-primary"
        >
          {hasPreviousPage ? (
            <Link href={createPageHref(params, page - 1)}>Anterior</Link>
          ) : (
            "Anterior"
          )}
        </Button>

        <p className="font-mono text-sm tabular-nums text-text-secondary">
          Página {page} de {totalPages}
        </p>

        <Button
          asChild={hasNextPage}
          type="button"
          variant="outline"
          disabled={!hasNextPage}
          className="border-border bg-[var(--color-bg-surface-elevated)] text-text-primary hover:bg-[var(--color-bg-hover)] hover:text-text-primary"
        >
          {hasNextPage ? (
            <Link href={createPageHref(params, page + 1)}>Siguiente</Link>
          ) : (
            "Siguiente"
          )}
        </Button>
      </nav>
    </section>
  );
}
