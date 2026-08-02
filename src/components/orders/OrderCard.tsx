import { ClipboardList } from "lucide-react";

import type { Database, Tables } from "@/lib/supabase/database.types";

import { RiskOrb } from "./RiskOrb";

type CategoriaEstado =
  Database["public"]["Enums"]["categoria_estado_enum"];
type Order = Tables<"orders"> & {
  categoria_estado?: CategoriaEstado;
  has_open_task?: boolean;
};

type BadgeTone =
  | "accent"
  | "muted"
  | "transit"
  | "success"
  | "warning"
  | "danger";

const estadoLabel: Record<Order["estado_crm"], string> = {
  nuevo: "Nuevo",
  en_ruta: "En tránsito",
  entregado: "Entregado",
  cancelado: "Cancelado",
  devolucion: "Devolución",
};

const categoriaLabel: Record<CategoriaEstado, string> = {
  nuevo: "Nuevo",
  confirmado: "Confirmado",
  guia_generada: "Guía generada",
  en_ruta: "En ruta",
  novedad: "Novedad",
  proximo_a_llegar: "Próximo a llegar",
  entregado: "Entregado",
  cancelado: "Cancelado",
  devolucion: "Devolución",
  sin_clasificar: "Sin clasificar",
  en_reparto: "En reparto",
  recoger_oficina: "Recoger en oficina",
  intento_fallido: "Intento fallido",
};

const categoriaTone: Record<CategoriaEstado, BadgeTone> = {
  nuevo: "accent",
  confirmado: "accent",
  guia_generada: "muted",
  en_ruta: "transit",
  novedad: "warning",
  proximo_a_llegar: "transit",
  entregado: "success",
  cancelado: "danger",
  devolucion: "danger",
  sin_clasificar: "muted",
  en_reparto: "transit",
  recoger_oficina: "warning",
  intento_fallido: "danger",
};

const badgeClassName: Record<BadgeTone, string> = {
  accent:
    "bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)]",
  muted:
    "bg-[var(--color-bg-surface-subtle)] text-[var(--muted-foreground)]",
  transit:
    "bg-[var(--color-badge-en-ruta-bg)] text-[var(--color-badge-en-ruta)]",
  success: "bg-positive-bg text-positive",
  warning: "bg-risk-medium-bg text-risk-medium",
  danger: "bg-negative-bg text-negative",
};

const riskLabel = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
  sin_datos: "Sin datos",
} as const;

function normalizeRisk(nivelRiesgo: string | null) {
  if (
    nivelRiesgo === "bajo" ||
    nivelRiesgo === "medio" ||
    nivelRiesgo === "alto"
  ) {
    return nivelRiesgo;
  }

  return "sin_datos";
}

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
} satisfies Record<Order["pais"], Intl.NumberFormat>;

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "2-digit",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatCurrency(order: Order) {
  if (order.total === null) {
    return "Sin total";
  }

  return currencyFormatter[order.pais].format(order.total);
}

function formatDateTime(dateValue: string | null) {
  if (!dateValue) {
    return "Sin actualización";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return dateTimeFormatter.format(date);
}

function getCustomerName(order: Order) {
  const fullName = [order.nombre, order.apellido].filter(Boolean).join(" ");
  return fullName || "Cliente sin nombre";
}

function getOrderIdentifier(order: Order) {
  return order.numero_orden ?? `ID ${order.id}`;
}

export function OrderCard({
  order,
  selected = false,
}: {
  order: Order;
  selected?: boolean;
}) {
  const categoria = order.categoria_estado ?? "sin_clasificar";
  const badgeTone = categoriaTone[categoria];
  const risk = normalizeRisk(order.nivel_riesgo);

  return (
    <article
      className={[
        "grid min-h-[var(--density-row-height-compact)] grid-cols-2 items-center gap-3 rounded-lg border bg-[var(--color-bg-surface-elevated)] p-3 text-[var(--foreground)] shadow-sm transition-[background-color,border-color,box-shadow] duration-[var(--motion-duration-hover-focus)] motion-reduce:transition-none lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.1fr)_minmax(0,0.75fr)_minmax(0,0.85fr)] lg:gap-2 lg:px-3 lg:py-1.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.62fr)_minmax(0,1.05fr)_minmax(0,0.42fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.78fr)_minmax(0,0.32fr)]",
        selected
          ? "border-[var(--color-border-selected)] bg-[var(--color-bg-selected)] ring-2 ring-[var(--color-border-selected)] ring-offset-1 ring-offset-[var(--color-bg-surface-base)]"
          : "border-transparent hover:bg-[var(--color-bg-hover)] hover:shadow-md",
      ].join(" ")}
    >
      <div className="col-span-2 min-w-0 lg:col-span-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2
            className="truncate font-display text-sm font-semibold text-[var(--foreground)]"
            title={getCustomerName(order)}
          >
            {getCustomerName(order)}
          </h2>
          <span className="shrink-0 rounded-full bg-[var(--color-bg-surface-subtle)] px-2 py-0.5 font-body text-[10px] font-semibold text-[var(--muted-foreground)] xl:hidden">
            {order.pais}
          </span>
        </div>
        <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-[var(--muted-foreground)]">
          {getOrderIdentifier(order)}
        </p>
      </div>

      <div className="min-w-0">
        <p className="mb-1 font-body text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] lg:sr-only">
          Estado / categoría
        </p>
        <span
          className={`inline-flex max-w-full rounded-full px-2 py-1 font-body text-[11px] font-semibold ${badgeClassName[badgeTone]}`}
        >
          <span className="truncate">{categoriaLabel[categoria]}</span>
        </span>
        <p className="mt-1 truncate font-body text-[11px] text-[var(--muted-foreground)]">
          CRM: {estadoLabel[order.estado_crm]}
        </p>
      </div>

      <div className="min-w-0">
        <p className="mb-1 font-body text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] lg:sr-only">
          Riesgo
        </p>
        <div className="flex items-center gap-2">
          <RiskOrb nivelRiesgo={order.nivel_riesgo} />
          <span
            aria-hidden="true"
            className="truncate font-body text-xs font-medium text-[var(--foreground)]"
          >
            {riskLabel[risk]}
          </span>
        </div>
      </div>

      <div className="col-span-2 min-w-0 lg:col-span-1">
        <p className="mb-1 font-body text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] lg:sr-only">
          Producto
        </p>
        <p
          className="line-clamp-2 font-body text-sm text-[var(--foreground)] lg:truncate"
          title={order.nombre_producto ?? "Producto sin nombre"}
        >
          {order.nombre_producto ?? "Producto sin nombre"}
        </p>
        <p
          className="mt-1 hidden truncate font-body text-[10px] text-[var(--muted-foreground)] lg:block xl:hidden"
          title={`${order.transportadora ?? "Sin transportadora"} · ${order.guia_envio ?? "Sin guía"}`}
        >
          {order.transportadora ?? "Sin transportadora"} · {order.guia_envio ?? "Sin guía"}
        </p>
      </div>

      <div className="hidden min-w-0 items-center xl:flex">
        <span className="rounded-full bg-[var(--color-bg-surface-subtle)] px-2 py-1 font-body text-[11px] font-semibold text-[var(--muted-foreground)]">
          {order.pais}
        </span>
      </div>

      <div className="col-span-2 min-w-0 lg:hidden xl:col-span-1 xl:block">
        <p className="mb-1 font-body text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] xl:sr-only">
          Transportadora / guía
        </p>
        <p
          className="truncate font-body text-xs font-medium text-[var(--foreground)]"
          title={order.transportadora ?? "Sin transportadora"}
        >
          {order.transportadora ?? "Sin transportadora"}
        </p>
        <p
          className="mt-0.5 truncate font-mono text-[11px] text-[var(--muted-foreground)]"
          title={order.guia_envio ?? "Sin guía"}
        >
          {order.guia_envio ?? "Sin guía"}
        </p>
      </div>

      <div className="min-w-0">
        <p className="mb-1 font-body text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] lg:sr-only">
          Total
        </p>
        <p className="truncate font-mono text-xs font-semibold tabular-nums text-[var(--foreground)]">
          {formatCurrency(order)}
        </p>
      </div>

      <div className="min-w-0">
        <p className="mb-1 font-body text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] lg:sr-only">
          Última actualización
        </p>
        <time
          dateTime={order.updated_at}
          className="font-mono text-[11px] tabular-nums text-[var(--muted-foreground)]"
        >
          {formatDateTime(order.updated_at)}
        </time>
        <span className="mt-1 hidden items-center gap-1 font-body text-[10px] text-[var(--muted-foreground)] lg:flex xl:hidden">
          {order.has_open_task ? (
            <>
              <ClipboardList className="size-3" aria-hidden="true" />
              Tarea abierta
            </>
          ) : (
            "Sin tarea abierta"
          )}
        </span>
      </div>

      <div className="col-span-2 flex min-w-0 items-center lg:hidden xl:col-span-1 xl:flex xl:justify-center">
        {order.has_open_task ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-badge-nuevo-bg)] px-2 py-1 font-body text-[11px] font-semibold text-[var(--color-badge-nuevo)] xl:size-8 xl:justify-center xl:p-0"
            title="Tiene una tarea abierta"
          >
            <ClipboardList className="size-3.5" aria-hidden="true" />
            <span className="xl:sr-only">Tarea abierta</span>
          </span>
        ) : (
          <span
            className="font-body text-xs text-[var(--muted-foreground)]"
            title="Sin tareas abiertas"
          >
            <span className="xl:sr-only">Sin tarea abierta</span>
            <span aria-hidden="true" className="hidden xl:inline">
              —
            </span>
          </span>
        )}
      </div>
    </article>
  );
}
