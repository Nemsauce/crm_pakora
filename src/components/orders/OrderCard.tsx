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
  accent: "border-accent-from text-accent-to",
  muted: "border-border text-text-secondary",
  success: "border-risk-low text-risk-low",
  danger: "border-risk-high text-risk-high",
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

export function OrderCard({ order }: { order: Order }) {
  const badgeTone = estadoTone[order.estado_crm];

  return (
    <article className="flex min-h-56 flex-col justify-between rounded-lg border border-border bg-bg-base p-4 text-text-primary shadow-sm">
      <div className="space-y-3">
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
            className={`shrink-0 rounded-md border px-2 py-1 font-body text-xs font-medium ${badgeClassName[badgeTone]}`}
          >
            {estadoLabel[order.estado_crm]}
          </span>
        </div>

        <div className="grid gap-2 text-sm">
          <p className="truncate font-body text-text-secondary">
            {getLocation(order)}
          </p>
          <p className="line-clamp-2 min-h-10 font-body text-text-primary">
            {order.nombre_producto ?? "Producto sin nombre"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="font-body text-xs text-text-secondary">Total</p>
          <p className="mt-1 font-mono text-sm font-semibold text-text-primary">
            {formatCurrency(order)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-body text-xs text-text-secondary">Fecha</p>
          <p className="mt-1 font-mono text-xs text-text-primary">
            {formatDate(order.fecha)}
          </p>
        </div>
      </div>
    </article>
  );
}
