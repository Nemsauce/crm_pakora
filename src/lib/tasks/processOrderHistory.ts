import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyCategoryDecision,
  lookupCategory,
  OrderNotFoundError,
  type Order,
} from "@/lib/tasks/processOrderEvent";

const MAX_HISTORY_ENTRIES = 50;

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
      const decision = await applyCategoryDecision(orderForEntry, categoria, {
        buildNovedadDescription: () => buildNovedadDescription(entry),
        sendNotifications: false,
      });

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
