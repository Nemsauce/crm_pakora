import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Clock,
  Package,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  getTodaySummary,
  type TodayAlertItem,
  type TodayOrderItem,
  type TodayTaskItem,
} from "@/lib/hoy/getTodaySummary";

export const dynamic = "force-dynamic";

const BOGOTA_TIME_ZONE = "America/Bogota";

const countFormatter = new Intl.NumberFormat("es-CO");
const deadlineFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: BOGOTA_TIME_ZONE,
});
const alertTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: BOGOTA_TIME_ZONE,
});
const currencyFormatter = {
  CO: new Intl.NumberFormat("es-CO", {
    currency: "COP",
    maximumFractionDigits: 0,
    style: "currency",
  }),
  MX: new Intl.NumberFormat("es-MX", {
    currency: "MXN",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }),
} as const;

const taskTypeLabel: Record<TodayTaskItem["type"], string> = {
  llamar_confirmacion: "Confirmación",
  notificar_guia: "Notificar guía",
  presionar_entrega: "Presionar entrega",
  notificar_proximo_llegar: "Próximo a llegar",
  resolver_novedad: "Resolver novedad",
};

const alertTypeLabel: Record<TodayAlertItem["tipo"], string> = {
  tarea_urgente_asignada: "Tarea urgente",
  tarea_vencida: "Tarea vencida",
  pedido_nuevo: "Pedido nuevo",
  novedad: "Novedad",
  pedido_entregado: "Pedido entregado",
  pedido_devolucion: "Devolución",
  pedido_en_reparto: "Pedido en reparto",
};

function pluralize(count: number, singular: string, plural: string) {
  return `${countFormatter.format(count)} ${count === 1 ? singular : plural}`;
}

function capitalizeFirst(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function getUnreadAlertSentence(count: number) {
  if (count === 0) {
    return "No tienes alertas operativas sin leer.";
  }

  return `Tienes ${pluralize(count, "alerta operativa", "alertas operativas")} sin leer.`;
}

function getGreeting(generatedAt: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: BOGOTA_TIME_ZONE,
    }).format(new Date(generatedAt)),
  );

  if (hour < 12) {
    return "Buenos días";
  }

  return hour < 19 ? "Buenas tardes" : "Buenas noches";
}

function getCustomerLabel(
  order: Pick<TodayTaskItem["order"], "nombre" | "apellido">,
) {
  return (
    [order.nombre, order.apellido].filter(Boolean).join(" ") ||
    "Cliente sin nombre"
  );
}

function getOrderLabel(
  order: Pick<TodayTaskItem["order"], "id" | "numero_orden">,
) {
  return order.numero_orden ?? `ID ${order.id}`;
}

function formatDeadline(deadline: string | null) {
  if (!deadline) {
    return "Sin fecha límite";
  }

  const parsed = new Date(deadline);
  return Number.isNaN(parsed.getTime())
    ? "Fecha por confirmar"
    : deadlineFormatter.format(parsed);
}

function TaskUrgencyBadge({
  deadline,
  generatedAt,
}: {
  deadline: string | null;
  generatedAt: string;
}) {
  const isOverdue =
    deadline !== null && Date.parse(deadline) < Date.parse(generatedAt);

  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-1 font-body text-[11px] font-semibold ${
        isOverdue
          ? "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
          : "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
      }`}
    >
      {isOverdue ? "Vencida" : "Hoy"}
    </span>
  );
}

function TaskPreviewList({
  items,
  generatedAt,
  emptyMessage,
}: {
  items: TodayTaskItem[];
  generatedAt: string;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-[var(--color-bg-surface-subtle)] px-3 py-4 font-body text-sm text-text-secondary">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {items.map((task) => (
        <li key={task.id}>
          <Link
            href={task.href}
            className="group grid min-h-[var(--density-row-height-compact)] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-transparent bg-[var(--color-bg-surface-elevated)] px-3 py-2.5 shadow-sm outline-none transition-[background-color,box-shadow] duration-[var(--motion-duration-hover-focus)] hover:bg-[var(--color-bg-hover)] hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-body text-sm font-semibold text-text-primary">
                  {task.title}
                </span>
                <span className="hidden shrink-0 font-body text-[11px] text-text-secondary sm:inline">
                  {taskTypeLabel[task.type]}
                </span>
              </span>
              <span className="mt-1 block truncate font-body text-xs text-text-secondary">
                {getOrderLabel(task.order)} · {getCustomerLabel(task.order)} ·{" "}
                {formatDeadline(task.deadline)}
              </span>
            </span>
            <TaskUrgencyBadge
              deadline={task.deadline}
              generatedAt={generatedAt}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function getOrderPreviewDescription(
  items: TodayOrderItem[],
  empty: string,
  prefix: string,
) {
  const first = items[0];

  if (!first) {
    return empty;
  }

  return `${prefix}: ${getOrderLabel(first)} · ${getCustomerLabel(first)}`;
}

function OrderActionRow({
  href,
  label,
  description,
  count,
  tone,
}: {
  href: string;
  label: string;
  description: string;
  count: number;
  tone: "neutral" | "risk";
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[var(--density-row-height-comfortable)] items-center gap-3 rounded-xl border border-transparent bg-[var(--color-bg-surface-elevated)] p-3 shadow-sm outline-none transition-[background-color,box-shadow] duration-[var(--motion-duration-hover-focus)] hover:bg-[var(--color-bg-hover)] hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          tone === "risk"
            ? "bg-[var(--color-risk-high-bg)] text-[var(--color-risk-high)]"
            : "bg-[var(--color-bg-surface-subtle)] text-[var(--color-accent)]"
        }`}
      >
        {tone === "risk" ? (
          <ShieldAlert className="size-4" aria-hidden="true" />
        ) : (
          <Package className="size-4" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-body text-sm font-semibold text-text-primary">
          {label}
        </span>
        <span className="mt-0.5 block truncate font-body text-xs text-text-secondary">
          {description}
        </span>
      </span>
      <span className="font-mono text-xl font-semibold tabular-nums text-text-primary">
        {countFormatter.format(count)}
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-text-secondary transition-transform duration-[var(--motion-duration-hover-focus)] group-hover:translate-x-0.5 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </Link>
  );
}

function AlertPreview({ alert }: { alert: TodayAlertItem }) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--color-warning-bg)] px-2 py-1 font-body text-[11px] font-semibold text-[var(--color-warning)]">
            {alertTypeLabel[alert.tipo]}
          </span>
          <time
            dateTime={alert.created_at}
            className="font-mono text-[11px] tabular-nums text-text-secondary"
          >
            {alertTimeFormatter.format(new Date(alert.created_at))}
          </time>
        </span>
        <span className="mt-1.5 block truncate font-body text-sm font-semibold text-text-primary">
          {alert.titulo}
        </span>
        {alert.mensaje ? (
          <span className="mt-0.5 block truncate font-body text-xs text-text-secondary">
            {alert.mensaje}
          </span>
        ) : null}
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-text-secondary"
        aria-hidden="true"
      />
    </>
  );
  const className =
    "flex min-h-[var(--density-row-height-compact)] items-center gap-3 rounded-xl border border-transparent bg-[var(--color-bg-surface-elevated)] p-3 shadow-sm outline-none transition-[background-color,box-shadow] duration-[var(--motion-duration-hover-focus)] hover:bg-[var(--color-bg-hover)] hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

  return alert.href ? (
    <Link href={alert.href} className={className}>
      {content}
    </Link>
  ) : (
    <Link href="/alertas?lectura=unread" className={className}>
      {content}
    </Link>
  );
}

export default async function HoyPage() {
  const summary = await getTodaySummary();
  const greeting = getGreeting(summary.generatedAt);
  const nextTask = summary.nextQueue[0] ?? null;
  const nextHighRiskHref =
    summary.activeHighRiskOrders.items[0]?.href ?? "/pedidos";
  const ordersTodayHref = `/pedidos?fecha_desde=${summary.operationalDate}&fecha_hasta=${summary.operationalDate}`;

  return (
    <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-4 py-5 sm:px-6 lg:px-8">
      <header className="border-b border-border/30 pb-5">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
          Hoy · resumen operativo
        </p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-text-primary sm:text-3xl">
              {greeting}
              {summary.operatorName ? `, ${summary.operatorName}` : ""}
            </h1>
            <p className="mt-1 flex items-center gap-2 font-body text-sm text-text-secondary">
              <CalendarDays className="size-4" aria-hidden="true" />
              {capitalizeFirst(summary.operationalDateLabel)} · Bogotá
            </p>
          </div>
          <p className="max-w-2xl font-body text-sm leading-6 text-text-secondary lg:text-right">
            Hay{" "}
            {pluralize(
              summary.overdueTasks.count,
              "tarea vencida",
              "tareas vencidas",
            )}
            . La agenda de hoy contiene{" "}
            {pluralize(summary.todayTasks.count, "tarea", "tareas")}; estos
            dos cortes pueden solaparse. Entraron{" "}
            {pluralize(
              summary.ordersReceivedToday.count,
              "pedido",
              "pedidos",
            )}{" "}
            y{" "}
            {pluralize(
              summary.activeHighRiskOrders.count,
              "pedido activo está",
              "pedidos activos están",
            )}{" "}
            en riesgo alto. {getUnreadAlertSentence(
              summary.unreadAttentionAlerts.count,
            )}
          </p>
        </div>
      </header>

      <section
        className="mt-5 rounded-2xl border border-[var(--color-border-selected)] bg-[var(--color-bg-surface-elevated)] p-4 shadow-lg sm:p-5"
        aria-labelledby="next-action-heading"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
              Siguiente acción
            </p>
            {nextTask ? (
              <>
                <h2
                  id="next-action-heading"
                  className="mt-2 truncate font-display text-xl font-semibold text-text-primary"
                >
                  {nextTask.title}
                </h2>
                <p className="mt-1 font-body text-sm text-text-secondary">
                  {taskTypeLabel[nextTask.type]} ·{" "}
                  {getOrderLabel(nextTask.order)} ·{" "}
                  {getCustomerLabel(nextTask.order)}
                </p>
                <p className="mt-2 flex items-center gap-2 font-mono text-xs tabular-nums text-text-secondary">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {formatDeadline(nextTask.deadline)}
                </p>
              </>
            ) : (
              <>
                <h2
                  id="next-action-heading"
                  className="mt-2 font-display text-xl font-semibold text-text-primary"
                >
                  Cola operativa al día
                </h2>
                <p className="mt-1 font-body text-sm text-text-secondary">
                  No hay tareas abiertas disponibles para resolver ahora.
                </p>
              </>
            )}
          </div>
          <Button
            asChild
            className="min-h-[var(--density-row-height-compact)] shrink-0 bg-gradient-to-r from-accent-from to-accent-to px-5 text-[var(--color-on-accent)] hover:opacity-90"
          >
            <Link href={nextTask?.href ?? "/tareas"}>
              {nextTask ? "Resolver siguiente" : "Revisar tareas"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.85fr)]">
        <section
          className="rounded-2xl border border-transparent bg-[var(--color-bg-surface-subtle)] p-3 shadow-sm sm:p-4"
          aria-labelledby="tasks-heading"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-body text-xs uppercase text-text-secondary">
                Qué resolver ahora
              </p>
              <h2
                id="tasks-heading"
                className="mt-1 font-display text-lg font-semibold text-text-primary"
              >
                Vencimientos
              </h2>
            </div>
            <Link
              href="/tareas"
              className="font-body text-sm font-semibold text-[var(--color-accent)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Abrir cola
            </Link>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="font-body text-sm font-semibold text-text-primary">
                  Vencidas
                </h3>
                <span className="font-mono text-sm font-semibold tabular-nums text-[var(--color-danger)]">
                  {countFormatter.format(summary.overdueTasks.count)}
                </span>
              </div>
              <TaskPreviewList
                items={summary.overdueTasks.items}
                generatedAt={summary.generatedAt}
                emptyMessage="No hay tareas vencidas."
              />
              {summary.overdueTasks.count > summary.overdueTasks.items.length ? (
                <Link
                  href="/tareas?vencidas=true"
                  className="mt-2 inline-flex font-body text-xs font-semibold text-[var(--color-accent)] hover:underline"
                >
                  Ver todas las vencidas
                </Link>
              ) : null}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="font-body text-sm font-semibold text-text-primary">
                  Con fecha de hoy
                </h3>
                <span className="font-mono text-sm font-semibold tabular-nums text-[var(--color-warning)]">
                  {countFormatter.format(summary.todayTasks.count)}
                </span>
              </div>
              <TaskPreviewList
                items={summary.todayTasks.items}
                generatedAt={summary.generatedAt}
                emptyMessage="No hay tareas con vencimiento hoy."
              />
              <p className="mt-2 font-body text-xs text-text-secondary">
                Una tarea de este bloque también aparece como vencida si su
                hora ya pasó.
              </p>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section
            className="rounded-2xl border border-transparent bg-[var(--color-bg-surface-subtle)] p-3 shadow-sm sm:p-4"
            aria-labelledby="orders-heading"
          >
            <div className="flex items-center gap-2">
              <ClipboardList
                className="size-4 text-[var(--color-accent)]"
                aria-hidden="true"
              />
              <h2
                id="orders-heading"
                className="font-display text-lg font-semibold text-text-primary"
              >
                Pedidos que mirar
              </h2>
            </div>
            <div className="mt-3 space-y-2">
              <OrderActionRow
                href={ordersTodayHref}
                label="Recibidos hoy"
                description={getOrderPreviewDescription(
                  summary.ordersReceivedToday.items,
                  "Sin pedidos nuevos en la fecha operativa.",
                  "Último recibido",
                )}
                count={summary.ordersReceivedToday.count}
                tone="neutral"
              />
              <OrderActionRow
                href={nextHighRiskHref}
                label="Riesgo alto activo"
                description={getOrderPreviewDescription(
                  summary.activeHighRiskOrders.items,
                  "Sin pedidos activos de riesgo alto.",
                  "Abrir último actualizado",
                )}
                count={summary.activeHighRiskOrders.count}
                tone="risk"
              />
            </div>
            <p className="mt-2 font-body text-xs text-text-secondary">
              Este conteo excluye categorías finales; el acceso abre un pedido
              que sí pertenece a este conjunto.
            </p>
          </section>

          <section
            className="rounded-2xl border border-transparent bg-[var(--color-bg-surface-subtle)] p-3 shadow-sm sm:p-4"
            aria-labelledby="alerts-heading"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BellRing
                  className="size-4 text-[var(--color-warning)]"
                  aria-hidden="true"
                />
                <h2
                  id="alerts-heading"
                  className="font-display text-lg font-semibold text-text-primary"
                >
                  Alertas por atender
                </h2>
              </div>
              <span className="font-mono text-lg font-semibold tabular-nums text-text-primary">
                {countFormatter.format(summary.unreadAttentionAlerts.count)}
              </span>
            </div>
            <p className="mt-1 font-body text-xs text-text-secondary">
              Sin leer, para tu usuario, dentro de Acción requerida.
            </p>
            {summary.unreadAttentionAlerts.items.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {summary.unreadAttentionAlerts.items.map((alert) => (
                  <li key={alert.id}>
                    <AlertPreview alert={alert} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl bg-[var(--color-bg-surface-elevated)] px-3 py-4 font-body text-sm text-text-secondary shadow-sm">
                No tienes alertas operativas sin leer.
              </p>
            )}
            <Link
              href="/alertas?lectura=unread"
              className="mt-3 inline-flex font-body text-xs font-semibold text-[var(--color-accent)] hover:underline"
            >
              Ver bandeja sin leer
            </Link>
          </section>
        </div>
      </div>

      <section
        className="mt-5 rounded-2xl border border-transparent bg-[var(--color-bg-surface-subtle)] p-3 shadow-sm sm:p-4"
        aria-labelledby="street-money-heading"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-body text-xs uppercase text-text-secondary">
              Foto operativa actual
            </p>
            <h2
              id="street-money-heading"
              className="mt-1 flex items-center gap-2 font-display text-lg font-semibold text-text-primary"
            >
              <CircleDollarSign
                className="size-4 text-[var(--color-positive)]"
                aria-hidden="true"
              />
              Dinero en la calle
            </h2>
          </div>
          <Link
            href="/command-center/finanzas"
            className="font-body text-sm font-semibold text-[var(--color-accent)] hover:underline"
          >
            Abrir Finanzas
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(["CO", "MX"] as const).map((pais) => {
            const money = summary.streetMoney[pais];

            return (
              <div
                key={pais}
                className="flex min-h-[var(--density-row-height-comfortable)] items-center justify-between gap-4 rounded-xl bg-[var(--color-bg-surface-elevated)] p-4 shadow-sm"
              >
                <div>
                  <p className="font-body text-xs font-semibold uppercase text-text-secondary">
                    {pais === "CO" ? "Colombia · COP" : "México · MXN"}
                  </p>
                  <p className="mt-1 font-body text-xs text-text-secondary">
                    {pluralize(
                      money.pendingOrders,
                      "pedido por entregar",
                      "pedidos por entregar",
                    )}
                  </p>
                </div>
                <p className="font-mono text-lg font-semibold tabular-nums text-text-primary sm:text-xl">
                  {currencyFormatter[pais].format(money.amount)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <nav
        className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/30 pt-4"
        aria-label="Atajos operativos"
      >
        <span className="mr-1 font-body text-xs font-semibold uppercase text-text-secondary">
          Ir a
        </span>
        {[
          { label: "Tareas vencidas", href: "/tareas?vencidas=true" },
          { label: "Cola completa", href: "/tareas" },
          { label: "Pedidos de hoy", href: ordersTodayHref },
          {
            label: "Todos con nivel de riesgo alto",
            href: "/pedidos?nivel_riesgo=alto",
          },
          { label: "Alertas sin leer", href: "/alertas?lectura=unread" },
          { label: "Finanzas", href: "/command-center/finanzas" },
        ].map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--color-bg-surface-elevated)] px-3 font-body text-xs font-semibold text-text-secondary shadow-sm outline-none transition-colors duration-[var(--motion-duration-hover-focus)] hover:bg-[var(--color-bg-hover)] hover:text-text-primary focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            {link.label}
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </section>
  );
}
