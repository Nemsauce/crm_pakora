import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database, Tables } from "@/lib/supabase/database.types";

const BOGOTA_TIME_ZONE = "America/Bogota";
const HIGH_RISK_PAGE_SIZE = 1_000;
const TASK_PREVIEW_LIMIT = 3;
const QUEUE_LIMIT = 5;
const ORDER_PREVIEW_LIMIT = 3;
const ALERT_PREVIEW_LIMIT = 3;

const attentionNotificationTypes = [
  "tarea_vencida",
  "pedido_devolucion",
  "tarea_urgente_asignada",
  "novedad",
  "pedido_en_reparto",
] as const satisfies readonly NotificationType[];

const finalOrderCategories = new Set<CategoriaEstado>([
  "entregado",
  "cancelado",
  "devolucion",
]);

type Pais = Database["public"]["Enums"]["pais_enum"];
type CategoriaEstado =
  Database["public"]["Enums"]["categoria_estado_enum"];
type NotificationType =
  Database["public"]["Enums"]["notificacion_tipo_enum"];
type TaskType = Database["public"]["Enums"]["tipo_tarea_enum"];
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type TaskOrderContext = Pick<
  Tables<"orders">,
  "id" | "numero_orden" | "nombre" | "apellido" | "pais"
>;

type TaskQueryRow = Pick<
  Tables<"tasks">,
  "id" | "titulo" | "tipo" | "fecha_limite" | "order_id"
> & {
  orders: TaskOrderContext;
};

type OrderPreviewRow = Pick<
  Tables<"orders">,
  | "id"
  | "numero_orden"
  | "nombre"
  | "apellido"
  | "pais"
  | "fecha"
  | "nivel_riesgo"
  | "updated_at"
>;

type HighRiskCandidate = Pick<
  Tables<"orders">,
  | "id"
  | "numero_orden"
  | "nombre"
  | "apellido"
  | "pais"
  | "fecha"
  | "nivel_riesgo"
  | "updated_at"
  | "estado_dropi"
  | "transportadora"
>;

type NotificationPreviewRow = Pick<
  Tables<"notifications">,
  | "id"
  | "titulo"
  | "mensaje"
  | "created_at"
  | "tipo"
  | "order_id"
  | "task_id"
>;

export type TodayTaskItem = {
  id: number;
  title: string;
  type: TaskType;
  deadline: string | null;
  order: TaskOrderContext;
  href: string;
};

export type TodayOrderItem = OrderPreviewRow & {
  href: string;
};

export type TodayAlertItem = NotificationPreviewRow & {
  href: string | null;
};

export type StreetMoneySummary = {
  pais: Pais;
  amount: number;
  pendingOrders: number;
};

export type TodaySummary = {
  generatedAt: string;
  operationalDate: string;
  operationalDateLabel: string;
  operatorName: string | null;
  overdueTasks: {
    count: number;
    items: TodayTaskItem[];
  };
  todayTasks: {
    count: number;
    items: TodayTaskItem[];
  };
  nextQueue: TodayTaskItem[];
  ordersReceivedToday: {
    count: number;
    items: TodayOrderItem[];
  };
  activeHighRiskOrders: {
    count: number;
    items: TodayOrderItem[];
  };
  unreadAttentionAlerts: {
    count: number;
    items: TodayAlertItem[];
  };
  streetMoney: Record<Pais, StreetMoneySummary>;
};

const operationalDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  timeZone: BOGOTA_TIME_ZONE,
  weekday: "long",
  year: "numeric",
});

function getBogotaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function getNextDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
}

function getBogotaDayBounds(dateKey: string) {
  const nextDateKey = getNextDateKey(dateKey);

  // Bogotá does not observe daylight saving time, so its operational day is UTC-5.
  return {
    start: `${dateKey}T00:00:00-05:00`,
    end: `${nextDateKey}T00:00:00-05:00`,
  };
}

function getStatusKey(estado: string, transportadora: string | null) {
  return `${estado}\u0000${transportadora ?? ""}`;
}

function toNumber(value: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toTaskItem(row: TaskQueryRow): TodayTaskItem {
  return {
    id: row.id,
    title: row.titulo,
    type: row.tipo,
    deadline: row.fecha_limite,
    order: row.orders,
    href: `/tareas?detalle=${row.order_id}&tareaId=${row.id}`,
  };
}

function toOrderItem(row: OrderPreviewRow): TodayOrderItem {
  return {
    ...row,
    href: `/pedidos?detalle=${row.id}`,
  };
}

function getNotificationHref(row: NotificationPreviewRow) {
  if (row.task_id !== null && row.order_id !== null) {
    return `/tareas?detalle=${row.order_id}&tareaId=${row.task_id}`;
  }

  if (row.order_id !== null) {
    return `/pedidos?detalle=${row.order_id}`;
  }

  return null;
}

async function getAllHighRiskCandidates(supabase: SupabaseClient) {
  const rows: HighRiskCandidate[] = [];

  for (let from = 0; ; from += HIGH_RISK_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id,numero_orden,nombre,apellido,pais,fecha,nivel_riesgo,updated_at,estado_dropi,transportadora",
      )
      .eq("nivel_riesgo", "alto")
      .eq("activo", true)
      .order("id", { ascending: true })
      .range(from, from + HIGH_RISK_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `No se pudieron cargar los pedidos de riesgo alto: ${error.message}`,
      );
    }

    const pageRows = (data ?? []) as HighRiskCandidate[];
    rows.push(...pageRows);

    if (pageRows.length < HIGH_RISK_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function aggregateStreetMoney(
  rows: Database["public"]["Functions"]["dinero_en_la_calle"]["Returns"],
) {
  const totals: Record<Pais, StreetMoneySummary> = {
    CO: { pais: "CO", amount: 0, pendingOrders: 0 },
    MX: { pais: "MX", amount: 0, pendingOrders: 0 },
  };

  for (const row of rows) {
    totals[row.pais].amount += toNumber(row.dinero_en_la_calle);
    totals[row.pais].pendingOrders += toNumber(row.pedidos_por_entregar);
  }

  totals.CO.amount = Number(totals.CO.amount.toFixed(0));
  totals.MX.amount = Number(totals.MX.amount.toFixed(2));

  return totals;
}

export async function getTodaySummary(
  now: Date = new Date(),
): Promise<TodaySummary> {
  const supabase = await createClient();
  const nowIso = now.toISOString();
  const operationalDate = getBogotaDateKey(now);
  const dayBounds = getBogotaDayBounds(operationalDate);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("No se pudo identificar el usuario activo para Hoy.");
  }

  const taskSelect =
    "id,titulo,tipo,fecha_limite,order_id,orders!inner(id,numero_orden,nombre,apellido,pais)";
  const orderPreviewSelect =
    "id,numero_orden,nombre,apellido,pais,fecha,nivel_riesgo,updated_at";

  const [
    profileResult,
    overdueTasksResult,
    todayTasksResult,
    queueResult,
    ordersTodayResult,
    highRiskCandidates,
    statusCatalogResult,
    unreadAlertsResult,
    streetMoneyResult,
  ] = await Promise.all([
    supabase.from("profiles").select("nombre").eq("id", user.id).maybeSingle(),
    supabase
      .from("tasks")
      .select(taskSelect, { count: "exact" })
      .in("estado", ["pendiente", "en_progreso"])
      .or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`)
      .lt("fecha_limite", nowIso)
      .order("fecha_limite", { ascending: true, nullsFirst: false })
      .limit(TASK_PREVIEW_LIMIT),
    supabase
      .from("tasks")
      .select(taskSelect, { count: "exact" })
      .in("estado", ["pendiente", "en_progreso"])
      .or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`)
      .gte("fecha_limite", dayBounds.start)
      .lt("fecha_limite", dayBounds.end)
      .order("fecha_limite", { ascending: true, nullsFirst: false })
      .limit(TASK_PREVIEW_LIMIT),
    supabase
      .from("tasks")
      .select(taskSelect)
      .in("estado", ["pendiente", "en_progreso"])
      .or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`)
      .order("fecha_limite", { ascending: true, nullsFirst: false })
      .limit(QUEUE_LIMIT),
    supabase
      .from("orders")
      .select(orderPreviewSelect, { count: "exact" })
      .eq("fecha", operationalDate)
      .order("created_at", { ascending: false })
      .limit(ORDER_PREVIEW_LIMIT),
    getAllHighRiskCandidates(supabase),
    supabase
      .from("status_catalog")
      .select("estado,transportadora,categoria"),
    supabase
      .from("notifications")
      .select(
        "id,titulo,mensaje,created_at,tipo,order_id,task_id",
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .eq("leida", false)
      .in("tipo", [...attentionNotificationTypes])
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(ALERT_PREVIEW_LIMIT),
    supabase.rpc("dinero_en_la_calle"),
  ]);

  const queryErrors = [
    ["perfil", profileResult.error],
    ["tareas vencidas", overdueTasksResult.error],
    ["tareas de hoy", todayTasksResult.error],
    ["próxima cola", queueResult.error],
    ["pedidos de hoy", ordersTodayResult.error],
    ["catálogo de estados", statusCatalogResult.error],
    ["alertas", unreadAlertsResult.error],
    ["dinero en la calle", streetMoneyResult.error],
  ] as const;

  for (const [label, error] of queryErrors) {
    if (error) {
      throw new Error(`No se pudo cargar ${label}: ${error.message}`);
    }
  }

  const categoryByStatus = new Map<string, CategoriaEstado>();

  for (const status of statusCatalogResult.data ?? []) {
    categoryByStatus.set(
      getStatusKey(status.estado, status.transportadora),
      status.categoria,
    );
  }

  const nonFinalHighRiskOrders = highRiskCandidates.filter((order) => {
    if (!order.estado_dropi) {
      return true;
    }

    const exactCategory = order.transportadora
      ? categoryByStatus.get(
          getStatusKey(order.estado_dropi, order.transportadora),
        )
      : null;
    const category =
      exactCategory ??
      categoryByStatus.get(getStatusKey(order.estado_dropi, null)) ??
      "sin_clasificar";

    return !finalOrderCategories.has(category);
  });
  const highRiskPreview = [...nonFinalHighRiskOrders]
    .sort(
      (first, second) =>
        Date.parse(second.updated_at) - Date.parse(first.updated_at),
    )
    .slice(0, ORDER_PREVIEW_LIMIT)
    .map(toOrderItem);
  const operatorName = profileResult.data?.nombre?.trim().split(/\s+/)[0] || null;

  return {
    generatedAt: nowIso,
    operationalDate,
    operationalDateLabel: operationalDateFormatter.format(now),
    operatorName,
    overdueTasks: {
      count: overdueTasksResult.count ?? 0,
      items: ((overdueTasksResult.data ?? []) as unknown as TaskQueryRow[]).map(
        toTaskItem,
      ),
    },
    todayTasks: {
      count: todayTasksResult.count ?? 0,
      items: ((todayTasksResult.data ?? []) as unknown as TaskQueryRow[]).map(
        toTaskItem,
      ),
    },
    nextQueue: ((queueResult.data ?? []) as unknown as TaskQueryRow[]).map(
      toTaskItem,
    ),
    ordersReceivedToday: {
      count: ordersTodayResult.count ?? 0,
      items: ((ordersTodayResult.data ?? []) as OrderPreviewRow[]).map(
        toOrderItem,
      ),
    },
    activeHighRiskOrders: {
      count: nonFinalHighRiskOrders.length,
      items: highRiskPreview,
    },
    unreadAttentionAlerts: {
      count: unreadAlertsResult.count ?? 0,
      items: ((unreadAlertsResult.data ?? []) as NotificationPreviewRow[]).map(
        (notification) => ({
          ...notification,
          href: getNotificationHref(notification),
        }),
      ),
    },
    streetMoney: aggregateStreetMoney(streetMoneyResult.data ?? []),
  };
}
