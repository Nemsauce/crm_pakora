import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import {
  closeOpenTasks,
  ensureOpenTask,
  lookupCategory,
  OrderNotFoundError,
  type DecisionCategory,
  type Order,
  type ProcessResult,
  type TaskType,
} from "@/lib/tasks/processOrderEvent";

const MAX_HISTORY_ENTRIES = 50;
const OPEN_TASK_STATES = [
  "pendiente",
  "en_progreso",
] satisfies Database["public"]["Enums"]["estado_tarea_enum"][];

type AdminClient = ReturnType<typeof createAdminClient>;

export type OrderHistoryEntry = {
  estado: string;
  transportadora: string | null;
  novedad: string | null;
  registrado_en: string;
};

export type ProcessOrderHistoryResult = {
  processed: number;
  tasksCreated: number;
  tasksClosed: number;
  errors: string[];
};

type OpenFailedAttemptTask = {
  id: number;
  intento_numero: number;
};

function deadlineInTwoHours() {
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
}

function getOrderNumber(order: Order) {
  return order.numero_orden ?? String(order.id);
}

function buildNovedadDescription(entry: OrderHistoryEntry) {
  return entry.novedad
    ? `Estado Dropi: ${entry.estado}\nNovedad/notas: ${entry.novedad}`
    : `Estado Dropi: ${entry.estado}`;
}

function getEntryLabel(entry: OrderHistoryEntry, index: number) {
  return `history[${index}] ${entry.estado} @ ${entry.registrado_en}`;
}

function getOrderForEntry(order: Order, entry: OrderHistoryEntry): Order {
  return {
    ...order,
    estado_dropi: entry.estado,
    transportadora: entry.transportadora,
  };
}

async function loadOrder(supabase: AdminClient, orderId: number) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new OrderNotFoundError(orderId);
  }

  return data;
}

async function insertStatusHistoryEntry(
  supabase: AdminClient,
  orderId: number,
  entry: OrderHistoryEntry,
) {
  const { error } = await supabase.from("status_history").upsert(
    {
      order_id: orderId,
      estado: entry.estado,
      transportadora: entry.transportadora,
      novedad: entry.novedad,
      registrado_en: entry.registrado_en,
    },
    {
      onConflict: "order_id,estado,registrado_en",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    throw error;
  }
}

async function countOpenTasks(supabase: AdminClient, orderId: number) {
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .in("estado", OPEN_TASK_STATES);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function findOpenFailedAttemptTask(
  supabase: AdminClient,
  orderId: number,
) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id,intento_numero")
    .eq("order_id", orderId)
    .eq("tipo", "presionar_entrega")
    .in("estado", OPEN_TASK_STATES)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as OpenFailedAttemptTask | null;
}

async function updateFailedAttemptTask(
  supabase: AdminClient,
  order: Order,
): Promise<ProcessResult> {
  const tipo: TaskType = "presionar_entrega";
  const descripcion = `Estado Dropi: ${order.estado_dropi ?? "sin estado"}`;
  const existingTask = await findOpenFailedAttemptTask(supabase, order.id);

  if (!existingTask) {
    return ensureOpenTask({
      order,
      tipo,
      titulo: "Presionar entrega, intento fallido",
      descripcion,
    });
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      intento_numero: existingTask.intento_numero + 1,
      descripcion,
      fecha_limite: deadlineInTwoHours(),
    })
    .eq("id", existingTask.id)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return {
    action: "task_updated",
    taskId: data.id,
    categoria: "",
  };
}

async function processHistoryDecision(
  supabase: AdminClient,
  order: Order,
  categoria: DecisionCategory,
  entry: OrderHistoryEntry,
): Promise<{ result: ProcessResult; tasksClosed: number }> {
  switch (categoria) {
    case "nuevo":
      return {
        result: await ensureOpenTask({
          order,
          tipo: "llamar_confirmacion",
          titulo: `Llamar para confirmar pedido ${getOrderNumber(order)}`,
        }),
        tasksClosed: 0,
      };
    case "guia_generada":
      return {
        result: await ensureOpenTask({
          order,
          tipo: "notificar_guia",
          titulo: "Notificar guía de seguimiento al cliente",
        }),
        tasksClosed: 0,
      };
    case "en_reparto":
      return {
        result: await ensureOpenTask({
          order,
          tipo: "presionar_entrega",
          titulo: "Confirmar que el cliente esté pendiente de recibir",
        }),
        tasksClosed: 0,
      };
    case "recoger_oficina":
      return {
        result: await ensureOpenTask({
          order,
          tipo: "presionar_entrega",
          titulo: "Avisar al cliente que debe recoger el paquete en oficina",
        }),
        tasksClosed: 0,
      };
    case "intento_fallido":
      return {
        result: await updateFailedAttemptTask(supabase, order),
        tasksClosed: 0,
      };
    case "novedad":
      return {
        result: await ensureOpenTask({
          order,
          tipo: "resolver_novedad",
          titulo: "Revisar y gestionar novedad",
          descripcion: buildNovedadDescription(entry),
        }),
        tasksClosed: 0,
      };
    case "proximo_a_llegar":
      return {
        result: await ensureOpenTask({
          order,
          tipo: "notificar_proximo_llegar",
          titulo: "Avisar al cliente que el paquete está próximo a llegar",
        }),
        tasksClosed: 0,
      };
    case "entregado":
    case "cancelado":
    case "devolucion": {
      const openTasks = await countOpenTasks(supabase, order.id);
      const result = await closeOpenTasks(order);

      return {
        result,
        tasksClosed: openTasks,
      };
    }
    case "confirmado":
    case "en_ruta":
    case "sin_clasificar":
      return {
        result: { action: "noop", categoria },
        tasksClosed: 0,
      };
  }
}

async function updateOrderCurrentState(
  supabase: AdminClient,
  orderId: number,
  entry: OrderHistoryEntry,
) {
  const { error } = await supabase
    .from("orders")
    .update({
      estado_dropi: entry.estado,
      tarea_generada_para_estado: entry.estado,
    })
    .eq("id", orderId);

  if (error) {
    throw error;
  }
}

export async function processOrderHistory(
  orderId: number,
  history: OrderHistoryEntry[],
): Promise<ProcessOrderHistoryResult> {
  if (history.length === 0) {
    return {
      processed: 0,
      tasksCreated: 0,
      tasksClosed: 0,
      errors: [],
    };
  }

  if (history.length > MAX_HISTORY_ENTRIES) {
    console.warn("Order history payload exceeded safety cap; truncating", {
      order_id: orderId,
      received: history.length,
      processing: MAX_HISTORY_ENTRIES,
    });
  }

  const supabase = createAdminClient();
  const order = await loadOrder(supabase, orderId);
  const entries = history.slice(0, MAX_HISTORY_ENTRIES);
  const errors: string[] = [];
  let processed = 0;
  let tasksCreated = 0;
  let tasksClosed = 0;

  for (const [index, entry] of entries.entries()) {
    try {
      await insertStatusHistoryEntry(supabase, orderId, entry);

      const orderForEntry = getOrderForEntry(order, entry);
      const categoria = await lookupCategory(orderForEntry);
      const decision = await processHistoryDecision(
        supabase,
        orderForEntry,
        categoria,
        entry,
      );

      if (decision.result.action === "task_created") {
        tasksCreated += 1;
      }

      tasksClosed += decision.tasksClosed;
      processed += 1;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown history replay error";

      console.error("Failed to process order history entry", {
        order_id: orderId,
        entry,
        error: errorMessage,
      });

      errors.push(`${getEntryLabel(entry, index)}: ${errorMessage}`);
    }
  }

  try {
    await updateOrderCurrentState(
      supabase,
      orderId,
      entries[entries.length - 1]!,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown final state update error";

    console.error("Failed to update order after history replay", {
      order_id: orderId,
      error: errorMessage,
    });

    errors.push(`final_state: ${errorMessage}`);
  }

  return {
    processed,
    tasksCreated,
    tasksClosed,
    errors,
  };
}
