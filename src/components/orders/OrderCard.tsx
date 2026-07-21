import { Calendar, MapPin } from "lucide-react";

import type { Tables } from "@/lib/supabase/database.types";

import { RiskOrb } from "./RiskOrb";

type Order = Tables<"orders">;

type BadgeTone = "accent" | "muted" | "success" | "danger";

const estadoLabel: Record<Order["estado_crm"], string> = {
  nuevo: "Nuevo",
  en_ruta: "En tránsito",
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
  accent: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  muted: "bg-bg-page text-[var(--foreground)]",
  success: "bg-risk-low-bg text-risk-low",
  danger: "bg-risk-high-bg text-risk-high",
};

const cornerBlobBackground = {
  bajo:
    "radial-gradient(circle at 35% 35%, var(--color-risk-low-bg) 0%, var(--color-risk-low) 48%, transparent 72%)",
  medio:
    "radial-gradient(circle at 35% 35%, var(--color-risk-medium-bg) 0%, var(--color-risk-medium) 48%, transparent 72%)",
  alto:
    "radial-gradient(circle at 35% 35%, var(--color-risk-high-bg) 0%, var(--color-risk-high) 48%, transparent 72%)",
  sin_datos:
    "radial-gradient(circle at 35% 35%, var(--color-bg-page) 0%, var(--muted-foreground) 48%, transparent 72%)",
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

  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);

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
  const risk = normalizeRisk(order.nivel_riesgo);

  return (
    <article
      className={[
        "relative flex min-h-56 flex-col justify-between overflow-hidden rounded-2xl border bg-bg-surface p-4 text-[var(--foreground)] shadow-lg transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        selected
          ? "border-[var(--color-accent)] shadow-xl ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-bg-page"
          : "border-border",
      ].join(" ")}
    >
      <div
        className="pointer-events-none absolute -bottom-8 -right-8 z-0 h-28 w-36 rounded-[62%_38%_46%_54%/48%_44%_56%_52%] opacity-[0.14] dark:opacity-[0.12]"
        style={{ background: cornerBlobBackground[risk] }}
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-3">
        <div className="flex items-start gap-3">
          <div className="pt-1">
            <RiskOrb nivelRiesgo={order.nivel_riesgo} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-base font-semibold text-[var(--foreground)]">
              {getCustomerName(order)}
            </h2>
            <p className="mt-1 truncate font-mono text-xs text-[var(--muted-foreground)]">
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
          <p className="flex min-w-0 items-center gap-1.5 font-body text-[var(--muted-foreground)]">
            <MapPin
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">{getLocation(order)}</span>
          </p>
          <p className="line-clamp-2 min-h-10 font-body text-[var(--foreground)]">
            {order.nombre_producto ?? "Producto sin nombre"}
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-5 flex items-end justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="font-body text-xs text-[var(--muted-foreground)]">Total</p>
          <p className="mt-1 font-mono text-sm font-semibold text-[var(--foreground)]">
            {formatCurrency(order)}
          </p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5 font-body text-xs text-[var(--muted-foreground)]">
            <Calendar
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            Fecha
          </p>
          <p className="mt-1 font-mono text-xs text-[var(--foreground)]">
            {formatDate(order.fecha)}
          </p>
        </div>
      </div>
    </article>
  );
}
