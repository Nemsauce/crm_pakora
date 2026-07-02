import { Calendar, MapPin } from "lucide-react";

import type { Tables } from "@/lib/supabase/database.types";

import { RiskOrb } from "./RiskOrb";

type Order = Tables<"orders">;

type BadgeTone = "accent" | "muted" | "success" | "danger";

const estadoLabel: Record<Order["estado_crm"], string> = {
  nuevo: "Nuevo",
  en_ruta: "En ruta",
  entregado: "Entregado",
  cancelado: "Cancelado",
  devolucion: "Devolución",
};

const estadoTone: Record<Order["estado_crm"], BadgeTone> = {
  nuevo: "accent",
  en_ruta: "muted",
  entregado: "success",
  cancelado: "danger",
  devolucion: "danger",
};

const badgeClassName: Record<BadgeTone, string> = {
  accent: "bg-primary/10 text-primary",
  muted: "bg-bg-page text-text-primary",
  success: "bg-risk-low-bg text-risk-low",
  danger: "bg-risk-high-bg text-risk-high",
};

const cornerBlobBackground: Record<Order["estado_crm"], string> = {
  nuevo:
    "radial-gradient(circle at 35% 35%, var(--color-badge-nuevo-bg) 0%, var(--color-accent-to) 48%, transparent 72%)",
  en_ruta:
    "radial-gradient(circle at 35% 35%, var(--color-badge-en-ruta-bg) 0%, var(--color-badge-en-ruta) 48%, transparent 72%)",
  entregado:
    "radial-gradient(circle at 35% 35%, var(--color-positive-bg) 0%, var(--color-positive) 48%, transparent 72%)",
  cancelado:
    "radial-gradient(circle at 35% 35%, var(--color-negative-bg) 0%, var(--color-negative) 48%, transparent 72%)",
  devolucion:
    "radial-gradient(circle at 35% 35%, var(--color-negative-bg) 0%, var(--color-negative) 48%, transparent 72%)",
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
} satisfies Record<Order["pais"], Intl.NumberFormat>;

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatCurrency(order: Order) {
  if (order.total === null) {
    return "Sin total";
  }

  return currencyFormatter[order.pais].format(order.total);
}

function formatDate(dateValue: string | null) {
  if (!dateValue) {
    return "Sin fecha";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return dateFormatter.format(date);
}

function getCustomerName(order: Order) {
  const fullName = [order.nombre, order.apellido].filter(Boolean).join(" ");
  return fullName || "Cliente sin nombre";
}

function getLocation(order: Order) {
  const location = [order.ciudad, order.departamento].filter(Boolean).join(", ");
  return location || "Ubicación pendiente";
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
  const badgeTone = estadoTone[order.estado_crm];

  return (
    <article
      className={[
        "relative flex min-h-56 flex-col justify-between overflow-hidden rounded-2xl border bg-bg-surface p-4 text-text-primary shadow-lg transition-colors",
        selected
          ? "border-accent ring-2 ring-accent/25"
          : "border-border",
      ].join(" ")}
    >
      <div
        className="pointer-events-none absolute -bottom-8 -right-8 z-0 h-28 w-36 rounded-[62%_38%_46%_54%/48%_44%_56%_52%] opacity-[0.14] dark:opacity-[0.12]"
        style={{ background: cornerBlobBackground[order.estado_crm] }}
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-3">
        <div className="flex items-start gap-3">
          <div className="pt-1">
            <RiskOrb nivelRiesgo={order.nivel_riesgo} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-base font-semibold text-text-primary">
              {getCustomerName(order)}
            </h2>
            <p className="mt-1 truncate font-mono text-xs text-text-secondary">
              {getOrderIdentifier(order)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 font-body text-xs font-semibold ${badgeClassName[badgeTone]}`}
          >
            {estadoLabel[order.estado_crm]}
          </span>
        </div>

        <div className="grid gap-2 text-sm">
          <p className="flex min-w-0 items-center gap-1.5 font-body text-[var(--color-text-secondary)]">
            <MapPin
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">{getLocation(order)}</span>
          </p>
          <p className="line-clamp-2 min-h-10 font-body text-text-primary">
            {order.nombre_producto ?? "Producto sin nombre"}
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-5 flex items-end justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="font-body text-xs text-text-secondary">Total</p>
          <p className="mt-1 font-mono text-sm font-semibold text-text-primary">
            {formatCurrency(order)}
          </p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5 font-body text-xs text-[var(--color-text-secondary)]">
            <Calendar
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            Fecha
          </p>
          <p className="mt-1 font-mono text-xs text-text-primary">
            {formatDate(order.fecha)}
          </p>
        </div>
      </div>
    </article>
  );
}
