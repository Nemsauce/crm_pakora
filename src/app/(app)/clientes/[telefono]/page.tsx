import {
  ArrowLeft,
  MessageCircle,
  PackageCheck,
  PackageX,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getCustomerHistoryStats } from "@/lib/orders/getCustomerHistoryStats";
import { createClient } from "@/lib/supabase/server";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { formatPhoneForWhatsApp } from "@/lib/whatsapp/formatPhoneForWhatsApp";

type Order = Tables<"orders">;
type Categoria = Database["public"]["Enums"]["categoria_estado_enum"];
type EstadoCrm = Order["estado_crm"];

type ClientePageProps = {
  params: Promise<{ telefono: string }>;
  searchParams: Promise<{ pais?: string | string[] }>;
};

const estadoLabel: Record<EstadoCrm, string> = {
  nuevo: "Nuevo",
  en_ruta: "En tránsito",
  entregado: "Entregado",
  cancelado: "Cancelado",
  devolucion: "Devolución",
};

const estadoClassName: Record<EstadoCrm, string> = {
  nuevo: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  en_ruta: "bg-bg-page text-[var(--foreground)]",
  entregado: "bg-risk-low-bg text-risk-low",
  cancelado: "bg-risk-high-bg text-risk-high",
  devolucion: "bg-risk-high-bg text-risk-high",
};

const riskLabel: Record<string, string> = {
  alto: "Riesgo alto",
  medio: "Riesgo medio",
  bajo: "Riesgo bajo",
  sin_datos: "Sin datos",
};

const riskClassName: Record<string, string> = {
  alto: "bg-risk-high-bg text-risk-high",
  medio: "bg-risk-medium-bg text-risk-medium",
  bajo: "bg-risk-low-bg text-risk-low",
  sin_datos: "bg-bg-page text-[var(--muted-foreground)]",
};

const paisLabel: Record<Order["pais"], string> = {
  CO: "Colombia",
  MX: "México",
};

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Bogota",
});

const calendarDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const snapshotDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

function getCustomerName(order: Order) {
  return [order.nombre, order.apellido].filter(Boolean).join(" ") ||
    "Cliente sin nombre";
}

function normalizeRisk(value: string | null) {
  return value === "alto" || value === "medio" || value === "bajo"
    ? value
    : "sin_datos";
}

function getRequestedCountry(
  value: string | string[] | undefined,
): Order["pais"] | null {
  const country = Array.isArray(value) ? value[0] : value;

  return country === "CO" || country === "MX" ? country : null;
}

function formatSnapshotDate(updatedAt: string) {
  const date = new Date(updatedAt);

  return Number.isNaN(date.getTime())
    ? "fecha no disponible"
    : snapshotDateFormatter.format(date);
}

function formatOrderDate(order: Order) {
  if (order.fecha) {
    const [year, month, day] = order.fecha.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (!Number.isNaN(date.getTime())) {
      return calendarDateFormatter.format(date);
    }
  }

  const createdAt = new Date(order.created_at);
  return Number.isNaN(createdAt.getTime())
    ? "Sin fecha"
    : dateFormatter.format(createdAt);
}

function getStatusKey(estado: string, transportadora: string | null) {
  return `${estado}\u0000${transportadora ?? ""}`;
}

export default async function ClientePage({
  params,
  searchParams,
}: ClientePageProps) {
  const [{ telefono }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  if (!telefono) {
    notFound();
  }

  const supabase = await createClient();
  const requestedCountry = getRequestedCountry(resolvedSearchParams.pais);
  let customerCountry = requestedCountry;

  if (!customerCountry) {
    const { data: latestExactPhoneOrder, error: latestOrderError } =
      await supabase
        .from("orders")
        .select("pais")
        .eq("telefono", telefono)
        .order("fecha", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (latestOrderError) {
      throw new Error(
        `No se pudo identificar el país del cliente: ${latestOrderError.message}`,
      );
    }

    customerCountry = latestExactPhoneOrder?.pais ?? null;
  }

  if (!customerCountry) {
    notFound();
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("telefono", telefono)
    .eq("pais", customerCountry)
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw new Error(`No se pudo cargar el perfil del cliente: ${error.message}`);
  }

  const orders = data ?? [];

  if (orders.length === 0) {
    notFound();
  }

  const dropiStates = Array.from(
    new Set(
      orders
        .map((order) => order.estado_dropi)
        .filter((estado): estado is string => Boolean(estado)),
    ),
  );
  const statusResult =
    dropiStates.length > 0
      ? await supabase
          .from("status_catalog")
          .select("estado,transportadora,categoria")
          .in("estado", dropiStates)
      : { data: [], error: null };

  if (statusResult.error) {
    throw new Error(
      `No se pudo clasificar el historial del cliente: ${statusResult.error.message}`,
    );
  }

  const categoryByStatus = new Map<string, Categoria>();

  for (const status of statusResult.data ?? []) {
    categoryByStatus.set(
      getStatusKey(status.estado, status.transportadora),
      status.categoria,
    );
  }

  function getOrderCategory(order: Order): Categoria {
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

  const categoryCounts = orders.reduce(
    (counts, order) => {
      const category = getOrderCategory(order);

      if (category === "entregado") {
        counts.entregados += 1;
      } else if (category === "cancelado") {
        counts.cancelados += 1;
      } else if (category === "devolucion") {
        counts.devueltos += 1;
      }

      return counts;
    },
    { entregados: 0, cancelados: 0, devueltos: 0 },
  );

  const latestOrder = orders[0];
  const risk = normalizeRisk(latestOrder.nivel_riesgo);
  const dropiHistory = getCustomerHistoryStats(latestOrder);
  const snapshotDate = formatSnapshotDate(latestOrder.updated_at);
  const whatsappNumber = latestOrder.telefono?.trim()
    ? formatPhoneForWhatsApp(latestOrder.telefono, latestOrder.pais)
    : "";
  const whatsappUrl = whatsappNumber
    ? `https://api.whatsapp.com/send/?phone=${whatsappNumber}`
    : null;
  const localMetrics = [
    {
      label: "Total pedidos",
      value: orders.length,
      icon: ShoppingBag,
      tone: "text-[var(--color-accent)] bg-[var(--color-accent)]/10",
    },
    {
      label: "Entregados",
      value: categoryCounts.entregados,
      icon: PackageCheck,
      tone: "text-risk-low bg-risk-low-bg",
    },
    {
      label: "Cancelados",
      value: categoryCounts.cancelados,
      icon: PackageX,
      tone: "text-risk-high bg-risk-high-bg",
    },
    {
      label: "Devoluciones",
      value: categoryCounts.devueltos,
      icon: RotateCcw,
      tone: "text-risk-high bg-risk-high-bg",
    },
  ];

  return (
    <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-6 py-6 sm:px-8">
      <header className="rounded-2xl border border-transparent bg-[var(--color-bg-surface-elevated)] p-5 shadow-sm">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-2 rounded-lg font-body text-sm font-semibold text-[var(--color-accent)] outline-none transition-colors duration-[var(--motion-duration-hover-focus)] hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a clientes
        </Link>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
              Perfil del cliente
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold text-[var(--foreground)]">
              {getCustomerName(latestOrder)}
            </h1>
          </div>
          {whatsappUrl ? (
            <Button
              asChild
              className="h-9 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 text-[var(--color-on-accent)] transition-opacity duration-[var(--motion-duration-hover-focus)] hover:opacity-90"
            >
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                WhatsApp
              </a>
            </Button>
          ) : null}
        </div>

        <dl className="mt-5 grid gap-4 rounded-xl bg-[var(--color-bg-surface-subtle)] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-body text-xs text-[var(--muted-foreground)]">
              Teléfono
            </dt>
            <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-[var(--foreground)]">
              {telefono}
            </dd>
          </div>
          <div>
            <dt className="font-body text-xs text-[var(--muted-foreground)]">
              País
            </dt>
            <dd className="mt-1 font-body text-sm font-semibold text-[var(--foreground)]">
              {paisLabel[latestOrder.pais]}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-body text-xs text-[var(--muted-foreground)]">
              Dirección
            </dt>
            <dd className="mt-1 font-body text-sm font-semibold text-[var(--foreground)]">
              {latestOrder.direccion?.trim() || "Sin dirección registrada"}
            </dd>
          </div>
        </dl>
      </header>

      <section
        aria-labelledby="dropi-history-title"
        className="mt-6 rounded-2xl border border-transparent bg-[var(--color-bg-surface-elevated)] p-5 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
              Alcance externo
            </p>
            <h2
              id="dropi-history-title"
              className="mt-2 font-display text-lg font-semibold text-[var(--foreground)]"
            >
              Historial en la red Dropi
            </h2>
            <p className="mt-2 max-w-3xl font-body text-sm text-[var(--muted-foreground)]">
              Snapshot de la actividad del cliente en toda la red Dropi. Estas
              cifras no representan únicamente los pedidos hechos en Pakora.
            </p>
          </div>
          <span
            className={`w-fit shrink-0 rounded-full px-3 py-1 font-body text-xs font-semibold ${riskClassName[risk]}`}
          >
            {riskLabel[risk]}
          </span>
        </div>

        {dropiHistory.hasHistory ? (
          <>
            <p className="mt-4 rounded-xl bg-[var(--color-bg-surface-subtle)] px-3 py-2 font-body text-xs text-[var(--muted-foreground)]">
              Snapshot guardado en el pedido más reciente. Última actualización
              del registro: {snapshotDate} (hora Colombia). No es una consulta en
              tiempo real a Dropi.
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="min-h-[var(--density-row-height-comfortable)] rounded-xl bg-[var(--color-bg-surface-subtle)] p-3">
                <dt className="font-body text-xs text-[var(--muted-foreground)]">
                  Pedidos en Dropi
                </dt>
                <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--foreground)]">
                  {dropiHistory.totalOrders}
                </dd>
              </div>
              <div className="min-h-[var(--density-row-height-comfortable)] rounded-xl bg-[var(--color-bg-surface-subtle)] p-3">
                <dt className="font-body text-xs text-[var(--muted-foreground)]">
                  Entregados
                </dt>
                <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-risk-low">
                  {dropiHistory.deliveredOrders}
                </dd>
              </div>
              <div className="min-h-[var(--density-row-height-comfortable)] rounded-xl bg-[var(--color-bg-surface-subtle)] p-3">
                <dt className="font-body text-xs text-[var(--muted-foreground)]">
                  Devueltos
                </dt>
                <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-risk-high">
                  {dropiHistory.returnedOrders}
                </dd>
              </div>
              <div className="min-h-[var(--density-row-height-comfortable)] rounded-xl bg-[var(--color-bg-surface-subtle)] p-3">
                <dt className="font-body text-xs text-[var(--muted-foreground)]">
                  Otros estados
                </dt>
                <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-risk-medium">
                  {dropiHistory.otherOrders}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <div className="mt-4 rounded-xl bg-[var(--color-bg-surface-subtle)] p-4">
            <p className="font-body text-sm font-semibold text-[var(--foreground)]">
              Sin historial de Dropi disponible
            </p>
            <p className="mt-1 font-body text-sm text-[var(--muted-foreground)]">
              El pedido más reciente de este cliente todavía no contiene un
              snapshot de historial de la red Dropi.
            </p>
          </div>
        )}
      </section>

      <section
        aria-labelledby="pakora-orders-title"
        className="mt-6 rounded-2xl border border-transparent bg-[var(--color-bg-surface-subtle)] p-5 shadow-sm"
      >
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">
            Alcance local
          </p>
          <h2
            id="pakora-orders-title"
            className="mt-2 font-display text-lg font-semibold text-[var(--foreground)]"
          >
            Pedidos en Pakora
          </h2>
          <p className="mt-2 max-w-3xl font-body text-sm text-[var(--muted-foreground)]">
            Pedidos guardados en este CRM para el teléfono y país exactos de este
            perfil.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {localMetrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <article
                key={metric.label}
                className="rounded-xl border border-transparent bg-[var(--color-bg-surface-elevated)] p-4 shadow-sm"
              >
                <div
                  className={`flex size-9 items-center justify-center rounded-full ${metric.tone}`}
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-3 font-body text-sm text-[var(--muted-foreground)]">
                  {metric.label}
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--foreground)]">
                  {metric.value}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-5 rounded-xl border border-transparent bg-[var(--color-bg-surface-elevated)] p-4 shadow-sm">
          <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
            Historial de pedidos
          </h3>

          <ul className="mt-3 divide-y divide-border">
            {orders.map((order) => (
              <li key={order.id} className="py-2 first:pt-0 last:pb-0">
                <Link
                  href={`/pedidos?detalle=${order.id}`}
                  className="flex min-h-[var(--density-row-height-compact)] flex-col justify-center gap-2 rounded-xl px-3 py-2 outline-none transition-colors duration-[var(--motion-duration-hover-focus)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="font-mono text-xs font-semibold tabular-nums text-[var(--muted-foreground)]">
                      {order.numero_orden ?? `ID ${order.id}`} ·{" "}
                      {formatOrderDate(order)}
                    </span>
                    <span className="mt-1 block truncate font-body text-sm font-medium text-[var(--foreground)]">
                      {order.nombre_producto?.trim() || "Producto sin nombre"}
                    </span>
                  </span>
                  <span
                    className={`w-fit shrink-0 rounded-full px-3 py-1 font-body text-xs font-semibold ${estadoClassName[order.estado_crm]}`}
                  >
                    {estadoLabel[order.estado_crm]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </section>
  );
}
