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

async function loadStaleOrderCandidates(supabase: AdminClient) {
  const cutoffTime = Date.now() - STALE_AFTER_MS;
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

export async function checkStaleOrders(): Promise<CheckStaleOrdersResult> {
  const supabase = createAdminClient();
  const orders = await loadStaleOrderCandidates(supabase);
  const errors: CheckStaleOrdersResult["errors"] = [];
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
