import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

import { AbandonadosList } from "@/components/orders/AbandonadosList";
import { Button } from "@/components/ui/button";
import { OrderCardLink } from "@/components/orders/OrderCardLink";
import { OrderDetailDrawer } from "@/components/orders/OrderDetailDrawer";
import { OrderFilters } from "@/components/orders/OrderFilters";
import { RefreshOrdersButton } from "@/components/orders/RefreshOrdersButton";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

const PAGE_SIZE = 24;

export const maxDuration = 300;

type SearchParams = {
  vista?: string;
  pais?: string;
  estado_abandonado?: string;
  estado_crm?: string;
  nivel_riesgo?: string;
  q?: string;
  detalle?: string;
  page?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
};

type PedidosPageProps = {
  searchParams: Promise<SearchParams>;
};

type Pais = Database["public"]["Enums"]["pais_enum"];
type EstadoCrm = Database["public"]["Enums"]["estado_crm_enum"];
type EstadoAbandonado = Database["public"]["Enums"]["estado_abandonado_enum"];
type CategoriaEstado =
  Database["public"]["Enums"]["categoria_estado_enum"];
type PedidosView = "pedidos" | "abandonados";

const validCountries = new Set<string>(["CO", "MX"]);
const validStatuses = new Set<string>([
  "nuevo",
  "en_ruta",
  "entregado",
  "cancelado",
  "devolucion",
]);
const validRisks = new Set<string>(["alto", "medio", "bajo", "sin_datos"]);
const validAbandonadoStates = new Set<string>([
  "nuevo",
  "contactado",
  "recuperado",
  "descartado",
]);

function escapeIlikeTerm(term: string) {
  return term.replace(/[%,]/g, "");
}

function getStatusKey(estado: string, transportadora: string | null) {
  return `${estado}\u0000${transportadora ?? ""}`;
}

function getPage(value: string | undefined) {
  const page = Number(value);

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

function parseDateParam(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = parseISO(value);

  return isValid(date) && format(date, "yyyy-MM-dd") === value ? date : null;
}

function getSelectedDateRange(params: SearchParams) {
  const parsedFrom = parseDateParam(params.fecha_desde);
  const parsedTo = parseDateParam(params.fecha_hasta);

  if (!parsedFrom && !parsedTo) {
    return null;
  }

  const firstDate = parsedFrom ?? parsedTo;
  const lastDate = parsedTo ?? parsedFrom;

  if (!firstDate || !lastDate) {
    return null;
  }

  const from = firstDate <= lastDate ? firstDate : lastDate;
  const to = firstDate <= lastDate ? lastDate : firstDate;

  return {
    from: format(from, "yyyy-MM-dd"),
    to: format(to, "yyyy-MM-dd"),
    fromDate: from,
    toDate: to,
  };
}

function getDateCountDescription(
  dateRange: ReturnType<typeof getSelectedDateRange>,
) {
  if (!dateRange) {
    return "";
  }

  if (dateRange.from === dateRange.to) {
    return ` del ${format(dateRange.fromDate, "d 'de' MMMM", {
      locale: es,
    })}`;
  }

  const sameMonth =
    format(dateRange.fromDate, "yyyy-MM") ===
    format(dateRange.toDate, "yyyy-MM");

  if (sameMonth) {
    return ` del ${format(dateRange.fromDate, "d", {
      locale: es,
    })} al ${format(dateRange.toDate, "d 'de' MMMM", { locale: es })}`;
  }

  return ` del ${format(dateRange.fromDate, "d 'de' MMMM", {
    locale: es,
  })} al ${format(dateRange.toDate, "d 'de' MMMM", { locale: es })}`;
}

function createPageHref(searchParams: SearchParams, page: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") {
      params.set(key, value);
    }
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/pedidos?${query}` : "/pedidos";
}

function PedidosViewSwitcher({ view }: { view: PedidosView }) {
  const options = [
    { value: "pedidos" as const, label: "Pedidos", href: "/pedidos" },
    {
      value: "abandonados" as const,
      label: "Abandonados",
      href: "/pedidos?vista=abandonados",
    },
  ];

  return (
    <nav
      className="inline-flex flex-wrap rounded-xl border border-transparent bg-[var(--color-bg-surface-subtle)] p-1 shadow-sm"
      aria-label="Vista de pedidos"
    >
      {options.map((option) => {
        const isActive = option.value === view;

        return (
          <Link
            key={option.value}
            href={option.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-[var(--density-row-height-compact)] items-center rounded-lg border px-4 font-body text-sm font-semibold outline-none transition-[color,background-color,border-color] duration-[var(--motion-duration-hover-focus)] focus-visible:ring-2 focus-visible:ring-ring ${
              isActive
                ? "border-[var(--color-border-selected)] bg-[var(--color-bg-selected)] text-[var(--color-accent)]"
                : "border-transparent text-text-secondary hover:bg-[var(--color-bg-hover)] hover:text-text-primary"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ListEntranceStyles() {
  return (
    <style>{`
      @keyframes crm-fade-slide-in {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .crm-list-entrance {
        opacity: 0;
        animation: crm-fade-slide-in var(--motion-duration-content) cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      }

      @media (prefers-reduced-motion: reduce) {
        .crm-list-entrance {
          opacity: 1;
          transform: none;
          animation: none;
        }
      }
    `}</style>
  );
}

function PedidosPageHeader({ view }: { view: PedidosView }) {
  const isAbandonados = view === "abandonados";

  return (
    <>
      <div className="flex flex-col gap-4 border-b border-border/30 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Pedidos
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            {isAbandonados ? "Pedidos abandonados" : "Lista de pedidos"}
          </h1>
          {isAbandonados ? (
            <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
              Recupera conversaciones iniciadas antes de que el pedido fuera
              confirmado.
            </p>
          ) : null}
        </div>
        {isAbandonados ? null : <RefreshOrdersButton />}
      </div>

      <div className="mt-5">
        <PedidosViewSwitcher view={view} />
      </div>
    </>
  );
}

export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  const params = await searchParams;
  const view: PedidosView =
    params.vista === "abandonados" ? "abandonados" : "pedidos";
  const page = getPage(params.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const supabase = await createClient();

  if (view === "abandonados") {
    let abandonadosQuery = supabase
      .from("abandonados")
      .select(
        "id,pais,codigo_externo,nombre,apellido,telefono,direccion,ciudad,departamento,nombre_producto,precio,fecha_abandono,estado,sincronizado_en",
        { count: "exact" },
      )
      .order("fecha_abandono", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (params.pais && validCountries.has(params.pais)) {
      abandonadosQuery = abandonadosQuery.eq("pais", params.pais as Pais);
    }

    if (
      params.estado_abandonado &&
      validAbandonadoStates.has(params.estado_abandonado)
    ) {
      abandonadosQuery = abandonadosQuery.eq(
        "estado",
        params.estado_abandonado as EstadoAbandonado,
      );
    }

    const { data, error, count } = await abandonadosQuery;

    if (error) {
      throw new Error(
        `No se pudieron cargar los pedidos abandonados: ${error.message}`,
      );
    }

    const abandonados = data ?? [];
    const totalCount = count ?? abandonados.length;

    return (
      <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-4 py-5 sm:px-6 lg:px-8">
        <ListEntranceStyles />
        <PedidosPageHeader view={view} />
        <AbandonadosList
          rows={abandonados}
          totalCount={totalCount}
          page={page}
          hasPreviousPage={page > 1}
          hasNextPage={to + 1 < totalCount}
        />
      </section>
    );
  }

  const selectedDateRange = getSelectedDateRange(params);
  let query = supabase
    .from("orders")
    .select("*", { count: "exact" })
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.pais && validCountries.has(params.pais)) {
    query = query.eq("pais", params.pais as Pais);
  }

  if (params.estado_crm && validStatuses.has(params.estado_crm)) {
    query = query.eq("estado_crm", params.estado_crm as EstadoCrm);
  }

  if (params.nivel_riesgo && validRisks.has(params.nivel_riesgo)) {
    if (params.nivel_riesgo === "sin_datos") {
      query = query.or("nivel_riesgo.is.null,nivel_riesgo.eq.sin_datos");
    } else {
      query = query.eq("nivel_riesgo", params.nivel_riesgo);
    }
  }

  if (selectedDateRange) {
    query = query
      .gte("fecha", selectedDateRange.from)
      .lte("fecha", selectedDateRange.to);
  }

  const searchTerm = params.q?.trim();

  if (searchTerm) {
    const term = escapeIlikeTerm(searchTerm);
    query = query.or(
      `nombre.ilike.%${term}%,apellido.ilike.%${term}%,numero_orden.ilike.%${term}%`,
    );
  }

  const { data: orders, error, count } = await query;

  if (error) {
    throw new Error(`No se pudieron cargar los pedidos: ${error.message}`);
  }

  const orderList = orders ?? [];
  const orderIds = orderList.map((order) => order.id);
  const dropiStates = Array.from(
    new Set(
      orderList
        .map((order) => order.estado_dropi)
        .filter((estado): estado is string => Boolean(estado)),
    ),
  );
  const [statusCatalogResult, openTasksResult] = await Promise.all([
    dropiStates.length > 0
      ? supabase
          .from("status_catalog")
          .select("estado,transportadora,categoria")
          .in("estado", dropiStates)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length > 0
      ? supabase
          .from("tasks")
          .select("order_id")
          .in("order_id", orderIds)
          .in("estado", ["pendiente", "en_progreso"])
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (statusCatalogResult.error) {
    throw new Error(
      `No se pudieron clasificar los estados de los pedidos: ${statusCatalogResult.error.message}`,
    );
  }

  if (openTasksResult.error) {
    throw new Error(
      `No se pudieron cargar las tareas abiertas de los pedidos: ${openTasksResult.error.message}`,
    );
  }

  const categoryByStatus = new Map<string, CategoriaEstado>();

  for (const status of statusCatalogResult.data ?? []) {
    categoryByStatus.set(
      getStatusKey(status.estado, status.transportadora),
      status.categoria,
    );
  }

  function getOrderCategory(
    order: (typeof orderList)[number],
  ): CategoriaEstado {
    if (!order.estado_dropi) {
      return "sin_clasificar";
    }

    if (order.transportadora) {
      const exactCategory = categoryByStatus.get(
        getStatusKey(order.estado_dropi, order.transportadora),
      );

      if (exactCategory) {
        return exactCategory;
      }
    }

    return (
      categoryByStatus.get(getStatusKey(order.estado_dropi, null)) ??
      "sin_clasificar"
    );
  }

  const openTaskOrderIds = new Set(
    (openTasksResult.data ?? []).map((task) => task.order_id),
  );
  const displayOrders = orderList.map((order) => ({
    ...order,
    categoria_estado: getOrderCategory(order),
    has_open_task: openTaskOrderIds.has(order.id),
  }));
  const totalCount = count ?? orderList.length;
  const selectedOrderId = params.detalle ?? null;
  const hasPreviousPage = page > 1;
  const hasNextPage = to + 1 < totalCount;
  const dateCountDescription = getDateCountDescription(selectedDateRange);

  return (
    <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-4 py-5 sm:px-6 lg:px-8">
      <PedidosPageHeader view={view} />

      <div className="mt-5">
        <OrderFilters />
      </div>

      <p className="mt-5 font-body text-sm text-text-secondary" aria-live="polite">
        <span className="font-mono font-semibold tabular-nums text-text-primary">
          {totalCount}
        </span>{" "}
        {totalCount === 1 ? "pedido" : "pedidos"}
        {dateCountDescription}
      </p>

      {orderList.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-xl bg-[var(--color-bg-surface-subtle)] p-1 shadow-sm">
          <div
            aria-hidden="true"
            className="hidden min-h-[var(--density-row-height-compact)] grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.1fr)_minmax(0,0.75fr)_minmax(0,0.85fr)] items-center gap-2 px-3 font-body text-[11px] font-semibold uppercase tracking-wide text-text-secondary lg:grid xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.62fr)_minmax(0,1.05fr)_minmax(0,0.42fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.78fr)_minmax(0,0.32fr)]"
          >
            <span>Pedido / cliente</span>
            <span>Estado / categoría</span>
            <span>Riesgo</span>
            <span>
              <span className="xl:hidden">Producto / logística</span>
              <span className="hidden xl:inline">Producto</span>
            </span>
            <span className="hidden xl:block">País</span>
            <span className="hidden xl:block">Transportadora / guía</span>
            <span>Total</span>
            <span>
              <span className="xl:hidden">Actualización / tarea</span>
              <span className="hidden xl:inline">Última actualización</span>
            </span>
            <span className="hidden text-center xl:block">Tarea</span>
          </div>

          <div className="grid gap-1" aria-label="Lista de pedidos">
            {displayOrders.map((order) => (
              <OrderCardLink
                key={order.id}
                order={order}
                selected={String(order.id) === selectedOrderId}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-[var(--color-bg-surface-elevated)] p-6 font-body text-sm text-text-secondary shadow-sm">
          No hay pedidos que coincidan con estos filtros.
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-border/30 pt-4">
        <Button
          asChild={hasPreviousPage}
          type="button"
          variant="outline"
          disabled={!hasPreviousPage}
          className="border-border bg-bg-base text-text-primary hover:bg-bg-base hover:text-text-primary"
        >
          {hasPreviousPage ? (
            <Link href={createPageHref(params, page - 1)}>Anterior</Link>
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
            <Link href={createPageHref(params, page + 1)}>Siguiente</Link>
          ) : (
            "Siguiente"
          )}
        </Button>
      </div>

      <OrderDetailDrawer />
    </section>
  );
}
