import {
  BellRing,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "@/app/(app)/notifications-actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

const PAGE_SIZE = 20;

type Notification = Pick<
  Tables<"notifications">,
  | "id"
  | "titulo"
  | "mensaje"
  | "created_at"
  | "leida"
  | "order_id"
  | "task_id"
  | "tipo"
  | "user_id"
>;

type NotificationType = Notification["tipo"];
type NotificationCategory = "critical" | "action" | "activity";
type AlertsTab = "action" | "activity" | "all";
type ReadFilter = "all" | "read" | "unread";

type AlertasPageProps = {
  searchParams: Promise<{
    tab?: string | string[];
    lectura?: string | string[];
    tipo?: string | string[];
    page?: string | string[];
  }>;
};

type AlertsQuery = {
  tab: AlertsTab;
  readFilter: ReadFilter;
  notificationType: NotificationType | null;
  page: number;
};

type DayGroup = {
  key: string;
  label: string;
  notificationsByCategory: Record<NotificationCategory, Notification[]>;
};

const notificationTypes = [
  "tarea_urgente_asignada",
  "tarea_vencida",
  "pedido_nuevo",
  "novedad",
  "pedido_entregado",
  "pedido_devolucion",
  "pedido_en_reparto",
] as const satisfies readonly NotificationType[];

const criticalTypes: NotificationType[] = [
  "tarea_vencida",
  "pedido_devolucion",
];
const actionTypes: NotificationType[] = [
  "tarea_urgente_asignada",
  "novedad",
  "pedido_en_reparto",
];
const activityTypes: NotificationType[] = [
  "pedido_nuevo",
  "pedido_entregado",
];

const categoryOrder: NotificationCategory[] = [
  "critical",
  "action",
  "activity",
];

const categoryMeta: Record<
  NotificationCategory,
  { label: string; className: string }
> = {
  critical: {
    label: "Críticas",
    className: "bg-risk-high-bg text-risk-high",
  },
  action: {
    label: "Acción requerida",
    className: "bg-risk-medium-bg text-risk-medium",
  },
  activity: {
    label: "Actividad",
    className: "bg-risk-low-bg text-risk-low",
  },
};

const notificationTypeLabel: Record<NotificationType, string> = {
  tarea_urgente_asignada: "Tarea urgente",
  tarea_vencida: "Tarea vencida",
  pedido_nuevo: "Pedido nuevo",
  novedad: "Novedad",
  pedido_entregado: "Pedido entregado",
  pedido_devolucion: "Pedido en devolución",
  pedido_en_reparto: "Pedido en reparto",
};

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Bogota",
  year: "numeric",
});

const dayLabelFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  timeZone: "America/Bogota",
  weekday: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getTab(value: string | string[] | undefined): AlertsTab {
  const tab = getFirstParam(value);

  return tab === "activity" || tab === "all" ? tab : "action";
}

function getReadFilter(value: string | string[] | undefined): ReadFilter {
  const readFilter = getFirstParam(value);

  if (readFilter === "read" || readFilter === "unread") {
    return readFilter;
  }

  return "all";
}

function getNotificationType(
  value: string | string[] | undefined,
): NotificationType | null {
  const notificationType = getFirstParam(value);

  return notificationTypes.some((type) => type === notificationType)
    ? (notificationType as NotificationType)
    : null;
}

function getPage(value: string | string[] | undefined) {
  const parsed = Number.parseInt(getFirstParam(value) ?? "1", 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function getCategory(notificationType: NotificationType): NotificationCategory {
  if (criticalTypes.includes(notificationType)) {
    return "critical";
  }

  if (activityTypes.includes(notificationType)) {
    return "activity";
  }

  return "action";
}

function getTabTypes(tab: AlertsTab): NotificationType[] | null {
  if (tab === "action") {
    return [...criticalTypes, ...actionTypes];
  }

  return tab === "activity" ? activityTypes : null;
}

function getNotificationDestination(notification: Notification) {
  if (notification.task_id !== null && notification.order_id !== null) {
    return `/tareas?detalle=${notification.order_id}&tareaId=${notification.task_id}`;
  }

  if (notification.order_id !== null) {
    return `/pedidos?detalle=${notification.order_id}`;
  }

  return null;
}

function getDayKey(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "fecha-no-disponible";
  }

  const parts = new Map(
    dayKeyFormatter
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

function formatDay(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : dayLabelFormatter.format(date);
}

function formatTime(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Hora no disponible"
    : timeFormatter.format(date);
}

function createCategoryGroups(): Record<NotificationCategory, Notification[]> {
  return {
    critical: [],
    action: [],
    activity: [],
  };
}

function groupNotificationsByDay(notifications: Notification[]) {
  const groupsByDay = new Map<string, DayGroup>();

  for (const notification of notifications) {
    const key = getDayKey(notification.created_at);
    const group = groupsByDay.get(key) ?? {
      key,
      label: formatDay(notification.created_at),
      notificationsByCategory: createCategoryGroups(),
    };

    group.notificationsByCategory[getCategory(notification.tipo)].push(
      notification,
    );
    groupsByDay.set(key, group);
  }

  return Array.from(groupsByDay.values());
}

function createAlertsHref(query: AlertsQuery) {
  const params = new URLSearchParams();

  if (query.tab !== "action") {
    params.set("tab", query.tab);
  }

  if (query.readFilter !== "all") {
    params.set("lectura", query.readFilter);
  }

  if (query.notificationType) {
    params.set("tipo", query.notificationType);
  }

  if (query.page > 1) {
    params.set("page", String(query.page));
  }

  const search = params.toString();

  return search ? `/alertas?${search}` : "/alertas";
}

function isNotificationDestination(value: string) {
  return value.startsWith("/tareas?") || value.startsWith("/pedidos?");
}

async function markNotificationReadAction(notificationId: number) {
  "use server";

  const result = await markNotificationRead(notificationId);

  if (result.error) {
    throw new Error(result.error);
  }

  revalidatePath("/alertas");
}

async function markNotificationUnreadAction(notificationId: number) {
  "use server";

  const result = await markNotificationUnread(notificationId);

  if (result.error) {
    throw new Error(result.error);
  }

  revalidatePath("/alertas");
}

async function markAllNotificationsReadAction() {
  "use server";

  const result = await markAllNotificationsRead();

  if (result.error) {
    throw new Error(result.error);
  }

  revalidatePath("/alertas");
}

async function openNotificationAction(
  notificationId: number,
  unread: boolean,
  destination: string,
) {
  "use server";

  if (!isNotificationDestination(destination)) {
    redirect("/alertas");
  }

  if (unread) {
    await markNotificationRead(notificationId);
    revalidatePath("/alertas");
  }

  redirect(destination);
}

function AlertNotificationRow({ notification }: { notification: Notification }) {
  const destination = getNotificationDestination(notification);
  const category = getCategory(notification.tipo);
  const typeLabel = notificationTypeLabel[notification.tipo];
  const isUnread = !notification.leida;
  const openAction = destination
    ? openNotificationAction.bind(null, notification.id, isUnread, destination)
    : null;
  const markAction = isUnread
    ? markNotificationReadAction.bind(null, notification.id)
    : markNotificationUnreadAction.bind(null, notification.id);

  const content = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
            isUnread ? "bg-risk-high" : "bg-[var(--muted-foreground)]/35"
          }`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 font-body text-[10px] font-semibold ${categoryMeta[category].className}`}
            >
              {typeLabel}
            </span>
            <span className="font-body text-xs text-text-secondary">
              {isUnread ? "No leída" : "Leída"}
            </span>
          </span>
          <span
            className={`mt-1 block font-body text-sm leading-5 text-text-primary ${
              isUnread ? "font-semibold" : "font-medium"
            }`}
          >
            {notification.titulo}
          </span>
          {notification.mensaje ? (
            <span className="mt-0.5 block whitespace-pre-line font-body text-sm leading-5 text-text-secondary">
              {notification.mensaje}
            </span>
          ) : null}
        </span>
      </div>
      <time
        dateTime={notification.created_at}
        className="mt-2 block pl-5 font-mono text-[11px] tabular-nums text-text-secondary"
      >
        {formatTime(notification.created_at)}
      </time>
    </>
  );

  return (
    <article className="group flex min-h-[var(--density-row-height-compact)] items-stretch gap-1 rounded-lg border border-transparent bg-[var(--color-bg-surface-elevated)] p-3 shadow-sm transition-[background-color,border-color,box-shadow] duration-[var(--motion-duration-hover-focus)] hover:bg-[var(--color-bg-hover)] hover:shadow-md motion-reduce:transition-none">
      {openAction ? (
        <form action={openAction} className="min-w-0 flex-1">
          <button
            type="submit"
            className="block h-full w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Abrir ${notification.titulo}`}
          >
            {content}
          </button>
        </form>
      ) : (
        <div className="min-w-0 flex-1">{content}</div>
      )}

      <form action={markAction} className="flex shrink-0 items-start">
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          className="rounded-full text-text-secondary hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]"
          aria-label={`Marcar “${notification.titulo}” como ${
            isUnread ? "leída" : "no leída"
          }`}
          title={isUnread ? "Marcar como leída" : "Marcar como no leída"}
        >
          {isUnread ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Mail className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </form>
    </article>
  );
}

export default async function AlertasPage({ searchParams }: AlertasPageProps) {
  const params = await searchParams;
  const tab = getTab(params.tab);
  const readFilter = getReadFilter(params.lectura);
  const notificationType = getNotificationType(params.tipo);
  const requestedPage = getPage(params.page);
  const currentQuery: AlertsQuery = {
    tab,
    readFilter,
    notificationType,
    page: requestedPage,
  };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const from = (requestedPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const tabTypes = getTabTypes(tab);
  let notificationsQuery = supabase
    .from("notifications")
    .select(
      "id,titulo,mensaje,created_at,leida,order_id,task_id,tipo,user_id",
      { count: "exact" },
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (tabTypes) {
    notificationsQuery = notificationsQuery.in("tipo", tabTypes);
  }

  if (notificationType) {
    notificationsQuery = notificationsQuery.eq("tipo", notificationType);
  }

  if (readFilter === "read") {
    notificationsQuery = notificationsQuery.eq("leida", true);
  } else if (readFilter === "unread") {
    notificationsQuery = notificationsQuery.eq("leida", false);
  }

  const [notificationsResult, unreadResult] = await Promise.all([
    notificationsQuery.range(from, to),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("leida", false),
  ]);

  if (notificationsResult.error) {
    throw new Error(
      `No se pudieron cargar las alertas: ${notificationsResult.error.message}`,
    );
  }

  if (unreadResult.error) {
    throw new Error(
      `No se pudo contar las alertas sin leer: ${unreadResult.error.message}`,
    );
  }

  const total = notificationsResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (requestedPage > totalPages) {
    redirect(
      createAlertsHref({
        ...currentQuery,
        page: totalPages,
      }),
    );
  }

  const notifications = (notificationsResult.data ?? []) as Notification[];
  const unreadCount = unreadResult.count ?? 0;
  const groupedDays = groupNotificationsByDay(notifications);
  const firstVisible = total === 0 ? 0 : from + 1;
  const lastVisible = Math.min(to + 1, total);
  const hasPreviousPage = requestedPage > 1;
  const hasNextPage = requestedPage < totalPages;
  const hasFilters =
    tab !== "action" || readFilter !== "all" || notificationType !== null;

  return (
    <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-4 py-5 sm:px-6 lg:px-8">
      <header className="border-b border-border/30 pb-4">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
          Operación
        </p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-text-primary">
              Alertas
            </h1>
            <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
              Bandeja de excepciones y actividad de pedidos. Las alertas se
              mantienen como leídas o no leídas; no se archivan ni resuelven
              desde aquí.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[var(--color-bg-surface-subtle)] px-3 py-2 font-body text-sm text-text-secondary shadow-sm">
            <BellRing className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
            <span className="font-mono font-semibold tabular-nums text-text-primary">
              {unreadCount}
            </span>
            sin leer
          </div>
        </div>
      </header>

      <nav
        className="mt-5 inline-flex max-w-full flex-wrap rounded-xl border border-transparent bg-[var(--color-bg-surface-subtle)] p-1 shadow-sm"
        aria-label="Vista de alertas"
      >
        {([
          ["action", "Acción requerida"],
          ["activity", "Actividad"],
          ["all", "Todas"],
        ] as const).map(([tabValue, label]) => {
          const active = tab === tabValue;

          return (
            <Link
              key={tabValue}
              href={createAlertsHref({
                ...currentQuery,
                tab: tabValue,
                page: 1,
              })}
              aria-current={active ? "page" : undefined}
              className={`min-h-[var(--density-row-height-compact)] rounded-lg border px-3 py-2 font-body text-sm font-semibold outline-none transition-colors duration-[var(--motion-duration-hover-focus)] focus-visible:ring-2 focus-visible:ring-ring sm:px-4 ${
                active
                  ? "border-[var(--color-border-selected)] bg-[var(--color-bg-selected)] text-[var(--color-accent)]"
                  : "border-transparent text-text-secondary hover:bg-[var(--color-bg-hover)] hover:text-text-primary"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <form
        action="/alertas"
        method="get"
        className="mt-3 grid gap-3 rounded-2xl border border-transparent bg-[var(--color-bg-surface-subtle)] p-2.5 shadow-sm md:grid-cols-[minmax(11rem,0.3fr)_minmax(14rem,0.5fr)_auto] md:items-end"
      >
        <input type="hidden" name="tab" value={tab} />
        <label className="font-body text-xs font-semibold text-text-secondary">
          Estado de lectura
          <select
            name="lectura"
            defaultValue={readFilter}
            className="mt-1.5 h-[var(--density-row-height-compact)] w-full rounded-lg border border-border bg-[var(--color-bg-surface-elevated)] px-3 font-body text-sm text-text-primary outline-none transition-colors duration-[var(--motion-duration-hover-focus)] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">Todas</option>
            <option value="unread">No leídas</option>
            <option value="read">Leídas</option>
          </select>
        </label>

        <label className="font-body text-xs font-semibold text-text-secondary">
          Tipo de alerta
          <select
            name="tipo"
            defaultValue={notificationType ?? ""}
            className="mt-1.5 h-[var(--density-row-height-compact)] w-full rounded-lg border border-border bg-[var(--color-bg-surface-elevated)] px-3 font-body text-sm text-text-primary outline-none transition-colors duration-[var(--motion-duration-hover-focus)] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Todos los tipos</option>
            {notificationTypes.map((type) => (
              <option key={type} value={type}>
                {notificationTypeLabel[type]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            className="h-[var(--density-row-height-compact)] bg-gradient-to-r from-accent-from to-accent-to px-4 text-[var(--color-on-accent)] hover:opacity-90"
          >
            Aplicar filtros
          </Button>
          {hasFilters ? (
            <Button
              asChild
              type="button"
              variant="ghost"
              className="h-[var(--density-row-height-compact)] text-text-secondary"
            >
              <Link href="/alertas">Limpiar</Link>
            </Button>
          ) : null}
        </div>
      </form>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="font-body text-sm text-text-secondary" aria-live="polite">
          <span className="font-mono font-semibold tabular-nums text-text-primary">
            {total}
          </span>{" "}
          {total === 1 ? "alerta" : "alertas"}
          {total > 0 ? (
            <span className="ml-2 font-mono text-xs tabular-nums">
              Mostrando {firstVisible}–{lastVisible}
            </span>
          ) : null}
        </div>

        <form action={markAllNotificationsReadAction}>
          <Button
            type="submit"
            variant="outline"
            disabled={unreadCount === 0}
            className="border-border bg-[var(--color-bg-surface-elevated)] text-text-primary hover:bg-[var(--color-bg-hover)] hover:text-text-primary"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Marcar todas como leídas
          </Button>
        </form>
      </div>

      {groupedDays.length > 0 ? (
        <div className="mt-4 space-y-6">
          {groupedDays.map((day) => (
            <section key={day.key} aria-labelledby={`day-${day.key}`}>
              <h2
                id={`day-${day.key}`}
                className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary"
              >
                {day.label}
              </h2>

              <div className="mt-2 rounded-xl bg-[var(--color-bg-surface-subtle)] p-1 shadow-sm">
                {categoryOrder.map((category) => {
                  const categoryNotifications =
                    day.notificationsByCategory[category];

                  if (categoryNotifications.length === 0) {
                    return null;
                  }

                  const categoryId = `${day.key}-${category}`;

                  return (
                    <section
                      key={category}
                      aria-labelledby={categoryId}
                      className="p-1.5 first:pt-1 last:pb-1"
                    >
                      <div className="mb-1.5 flex items-center gap-2 px-1.5">
                        <h3
                          id={categoryId}
                          className={`rounded-full px-2 py-0.5 font-body text-[11px] font-semibold ${categoryMeta[category].className}`}
                        >
                          {categoryMeta[category].label}
                        </h3>
                        <span className="font-mono text-[11px] tabular-nums text-text-secondary">
                          {categoryNotifications.length}
                        </span>
                      </div>
                      <div className="grid gap-1">
                        {categoryNotifications.map((notification) => (
                          <AlertNotificationRow
                            key={notification.id}
                            notification={notification}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex min-h-52 flex-col items-center justify-center rounded-xl bg-[var(--color-bg-surface-elevated)] p-6 text-center shadow-sm">
          <span className="flex size-11 items-center justify-center rounded-full bg-[var(--color-bg-surface-subtle)] text-text-secondary">
            <Inbox className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-base font-semibold text-text-primary">
            No hay alertas para esta vista
          </h2>
          <p className="mt-1 max-w-md font-body text-sm text-text-secondary">
            Ajusta los filtros o vuelve a Acción requerida para revisar las
            excepciones pendientes.
          </p>
        </div>
      )}

      <nav
        className="mt-6 flex items-center justify-between border-t border-border/30 pt-4"
        aria-label="Paginación de alertas"
      >
        <Button
          asChild={hasPreviousPage}
          type="button"
          variant="outline"
          disabled={!hasPreviousPage}
          className="border-border bg-[var(--color-bg-surface-elevated)] text-text-primary hover:bg-[var(--color-bg-hover)] hover:text-text-primary"
        >
          {hasPreviousPage ? (
            <Link
              href={createAlertsHref({
                ...currentQuery,
                page: requestedPage - 1,
              })}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Anterior
            </Link>
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Anterior
            </>
          )}
        </Button>

        <p className="font-mono text-sm tabular-nums text-text-secondary">
          Página {requestedPage} de {totalPages}
        </p>

        <Button
          asChild={hasNextPage}
          type="button"
          variant="outline"
          disabled={!hasNextPage}
          className="border-border bg-[var(--color-bg-surface-elevated)] text-text-primary hover:bg-[var(--color-bg-hover)] hover:text-text-primary"
        >
          {hasNextPage ? (
            <Link
              href={createAlertsHref({
                ...currentQuery,
                page: requestedPage + 1,
              })}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <>
              Siguiente
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </nav>
    </section>
  );
}
