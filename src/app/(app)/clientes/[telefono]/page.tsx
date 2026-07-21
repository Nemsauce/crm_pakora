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
import { createClient } from "@/lib/supabase/server";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { formatPhoneForWhatsApp } from "@/lib/whatsapp/formatPhoneForWhatsApp";

type Order = Tables<"orders">;
type Categoria = Database["public"]["Enums"]["categoria_estado_enum"];
type EstadoCrm = Order["estado_crm"];

type ClientePageProps = {
  params: Promise<{ telefono: string }>;
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

function formatOrderDate(order: Order) {
  if (order.fecha) {
    const [year, month, day] = order.fecha.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (!Number.isNaN(date.getTime())) {
      return dateFormatter.format(date);
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

export default async function ClientePage({ params }: ClientePageProps) {
  const { telefono } = await params;

  if (!telefono) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("telefono", telefono)
    .order("created_at", { ascending: false });

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
  const whatsappNumber = latestOrder.telefono?.trim()
    ? formatPhoneForWhatsApp(latestOrder.telefono, latestOrder.pais)
    : "";
  const whatsappUrl = whatsappNumber
    ? `https://api.whatsapp.com/send/?phone=${whatsappNumber}`
    : null;
  const metrics = [
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
      label: "Devueltos",
      value: categoryCounts.devueltos,
      icon: RotateCcw,
      tone: "text-risk-high bg-risk-high-bg",
    },
  ];

  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="border-b border-border pb-5">
        <Link
          href="/pedidos"
          className="inline-flex items-center gap-2 font-body text-sm font-semibold text-[var(--color-accent)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a pedidos
        </Link>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-body text-xs uppercase text-text-secondary">
              Perfil del cliente
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {getCustomerName(latestOrder)}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <span
              className={`w-fit rounded-full px-3 py-1 font-body text-xs font-semibold ${riskClassName[risk]}`}
            >
              {riskLabel[risk]}
            </span>
            {whatsappUrl ? (
              <Button
                asChild
                className="h-9 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 text-bg-surface hover:opacity-90"
              >
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <dl className="mt-5 grid gap-4 rounded-2xl border border-border bg-bg-surface p-4 shadow-lg sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-body text-xs text-text-secondary">Teléfono</dt>
            <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-text-primary">
              {telefono}
            </dd>
          </div>
          <div>
            <dt className="font-body text-xs text-text-secondary">País</dt>
            <dd className="mt-1 font-body text-sm font-semibold text-text-primary">
              {paisLabel[latestOrder.pais]}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-body text-xs text-text-secondary">Dirección</dt>
            <dd className="mt-1 font-body text-sm font-semibold text-text-primary">
              {latestOrder.direccion?.trim() || "Sin dirección registrada"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article
              key={metric.label}
              className="rounded-2xl border border-border bg-bg-surface p-4 shadow-lg"
            >
              <div
                className={`flex size-10 items-center justify-center rounded-full ${metric.tone}`}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-4 font-body text-sm text-text-secondary">
                {metric.label}
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text-primary">
                {metric.value}
              </p>
            </article>
          );
        })}
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-bg-surface p-5 shadow-lg">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Historial completo
          </p>
          <h2 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Pedidos del cliente
          </h2>
        </div>

        <ul className="mt-5 divide-y divide-border">
          {orders.map((order) => (
            <li key={order.id} className="py-3 first:pt-0 last:pb-0">
              <Link
                href={`/pedidos?detalle=${order.id}`}
                className="flex flex-col gap-3 rounded-xl px-3 py-3 outline-none transition-colors hover:bg-bg-page focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="font-mono text-xs font-semibold tabular-nums text-text-secondary">
                    {order.numero_orden ?? `ID ${order.id}`} ·{" "}
                    {formatOrderDate(order)}
                  </span>
                  <span className="mt-1 block truncate font-body text-sm font-medium text-text-primary">
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
      </section>
    </section>
  );
}
