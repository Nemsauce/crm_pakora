import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import {
  ensureOpenTask,
  type Order,
  type TaskType,
} from "@/lib/tasks/processOrderEvent";

const MAX_CANDIDATE_ORDERS = 1000;
const MAX_ORDERS_PER_RUN = 200;
const STALE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;

type DecisionCategory = Database["public"]["Enums"]["categoria_estado_enum"];
type AdminClient = ReturnType<typeof createAdminClient>;

type LatestStatusHistory = {
  registrado_en: string;
};

type OrderWithLatestStatusHistory = Order & {
  status_history: LatestStatusHistory[] | null;
};

export type CheckStaleOrdersResult = {
  processed: number;
  tasksCreated: number;
  errors: { order_id: number; error: string }[];
};

type StaleTaskConfig = {
  tipo: TaskType;
  titulo: string;
};

type ClassifiedStaleOrder = {
  order: OrderWithLatestStatusHistory;
  taskConfig: StaleTaskConfig;
};

type RecentlyCompletedTask = {
  order_id: number;
  tipo: TaskType;
  completado_en: string;
};

function getOrderNumber(order: Order) {
  return order.numero_orden ?? String(order.id);
}

async function lookupCategory(
  supabase: AdminClient,
  order: Order,
): Promise<DecisionCategory> {
  if (!order.estado_dropi) {
    return "sin_clasificar";
  }

  if (order.transportadora) {
    const { data, error } = await supabase
      .from("status_catalog")
      .select("categoria")
      .eq("estado", order.estado_dropi)
      .eq("transportadora", order.transportadora)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.categoria) {
      return data.categoria as DecisionCategory;
    }
  }

  const { data, error } = await supabase
    .from("status_catalog")
    .select("categoria")
    .eq("estado", order.estado_dropi)
    .is("transportadora", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data?.categoria ?? "sin_clasificar") as DecisionCategory;
}

function getStaleTaskConfig(
  order: Order,
  categoria: DecisionCategory,
): StaleTaskConfig | null {
  switch (categoria) {
    case "nuevo":
      return {
        tipo: "llamar_confirmacion",
        titulo: `Llamar para confirmar pedido ${getOrderNumber(order)}`,
      };
    case "confirmado":
      return {
        tipo: "resolver_novedad",
        titulo: "Pedido confirmado sin guía generada hace más de 2 días",
      };
    case "guia_generada":
      return {
        tipo: "resolver_novedad",
        titulo: "Guía generada pero sin movimiento hace más de 2 días",
      };
    case "en_ruta":
      return {
        tipo: "resolver_novedad",
        titulo: "Pedido en tránsito sin actualización hace más de 2 días",
      };
    case "en_reparto":
    case "recoger_oficina":
    case "intento_fallido":
      return {
        tipo: "presionar_entrega",
        titulo: "Presionar entrega, sin avance hace más de 2 días",
      };
    case "novedad":
      return {
        tipo: "resolver_novedad",
        titulo: "Revisar y gestionar novedad",
      };
    case "proximo_a_llegar":
      return {
        tipo: "resolver_novedad",
        titulo: "Cerca de destino sin avance hace más de 2 días",
      };
    case "sin_clasificar":
      return {
        tipo: "resolver_novedad",
        titulo: "Estado sin clasificar, revisar pedido estancado",
      };
    case "entregado":
    case "cancelado":
    case "devolucion":
      return null;
  }
}

function getLatestStatusRegisteredAt(order: OrderWithLatestStatusHistory) {
  return order.status_history?.[0]?.registrado_en ?? null;
}

function isOlderThanCutoff(value: string | null, cutoffTime: number) {
  if (!value) {
    return false;
  }

  const registeredAtTime = Date.parse(value);

  return Number.isFinite(registeredAtTime) && registeredAtTime < cutoffTime;
}

function getCompletionKey(orderId: number, tipo: TaskType) {
  return `${orderId}:${tipo}`;
}

async function loadStaleOrderCandidates(
  supabase: AdminClient,
  cutoffTime: number,
) {
  const { data, error } = await supabase
    .from("orders")
    .select("*, status_history!inner(registrado_en)")
    .eq("activo", true)
    .order("updated_at", { ascending: true })
    .order("registrado_en", {
      foreignTable: "status_history",
      ascending: false,
    })
    .limit(1, { foreignTable: "status_history" })
    .limit(MAX_CANDIDATE_ORDERS);

  if (error) {
    throw error;
  }

  return ((data ?? []) as OrderWithLatestStatusHistory[])
    .filter((order) =>
      isOlderThanCutoff(getLatestStatusRegisteredAt(order), cutoffTime),
    )
    .slice(0, MAX_ORDERS_PER_RUN);
}

async function loadRecentCompletionMap(
  supabase: AdminClient,
  classifiedOrders: ClassifiedStaleOrder[],
  cutoffTime: number,
) {
  if (classifiedOrders.length === 0) {
    return new Map<string, string>();
  }

  const orderIds = [...new Set(classifiedOrders.map(({ order }) => order.id))];
  const taskTypes = [
    ...new Set(classifiedOrders.map(({ taskConfig }) => taskConfig.tipo)),
  ];
  const relevantPairs = new Set(
    classifiedOrders.map(({ order, taskConfig }) =>
      getCompletionKey(order.id, taskConfig.tipo),
    ),
  );
  const { data, error } = await supabase
    .from("tasks")
    .select("order_id,tipo,completado_en")
    .in("order_id", orderIds)
    .in("tipo", taskTypes)
    .eq("estado", "completada")
    .not("completado_en", "is", null)
    .gt("completado_en", new Date(cutoffTime).toISOString())
    .order("completado_en", { ascending: false });

  if (error) {
    throw error;
  }

  const completions = new Map<string, string>();

  for (const task of (data ?? []) as RecentlyCompletedTask[]) {
    const key = getCompletionKey(task.order_id, task.tipo);

    if (relevantPairs.has(key) && !completions.has(key)) {
      completions.set(key, task.completado_en);
    }
  }

  return completions;
}

function wasSameTaskTypeCompletedRecently(
  completionMap: Map<string, string>,
  orderId: number,
  tipo: TaskType,
) {
  return completionMap.has(getCompletionKey(orderId, tipo));
}

export async function checkStaleOrders(): Promise<CheckStaleOrdersResult> {
  const supabase = createAdminClient();
  const cutoffTime = Date.now() - STALE_AFTER_MS;
  const orders = await loadStaleOrderCandidates(supabase, cutoffTime);
  const errors: CheckStaleOrdersResult["errors"] = [];
  const classifiedOrders: ClassifiedStaleOrder[] = [];
  let processed = 0;
  let tasksCreated = 0;

  for (const order of orders) {
    try {
      const categoria = await lookupCategory(supabase, order);
      const taskConfig = getStaleTaskConfig(order, categoria);

      if (!taskConfig) {
        processed += 1;
        continue;
      }

      classifiedOrders.push({
        order,
        taskConfig,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown stale-order error";

      console.error("Failed to classify stale order", {
        order_id: order.id,
        error: errorMessage,
      });

      errors.push({
        order_id: order.id,
        error: errorMessage,
      });
    }
  }

  const recentCompletions = await loadRecentCompletionMap(
    supabase,
    classifiedOrders,
    cutoffTime,
  );

  for (const { order, taskConfig } of classifiedOrders) {
    try {
      if (
        wasSameTaskTypeCompletedRecently(
          recentCompletions,
          order.id,
          taskConfig.tipo,
        )
      ) {
        processed += 1;
        continue;
      }

      const result = await ensureOpenTask({
        order,
        tipo: taskConfig.tipo,
        titulo: taskConfig.titulo,
      });

      if (result.action === "task_created") {
        tasksCreated += 1;
      }

      processed += 1;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown stale-order error";

      console.error("Failed to check stale order", {
        order_id: order.id,
        error: errorMessage,
      });

      errors.push({
        order_id: order.id,
        error: errorMessage,
      });
    }
  }

  return {
    processed,
    tasksCreated,
    errors,
  };
}
