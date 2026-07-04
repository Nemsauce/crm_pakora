import { sendTelegramMessage } from "@/lib/notifications/sendTelegram";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/lib/supabase/database.types";

export type Order = Tables<"orders">;
type Task = Tables<"tasks">;
export type TaskType = Database["public"]["Enums"]["tipo_tarea_enum"];
type TaskState = Database["public"]["Enums"]["estado_tarea_enum"];

export type DecisionCategory =
  | "nuevo"
  | "confirmado"
  | "guia_generada"
  | "en_ruta"
  | "en_reparto"
  | "recoger_oficina"
  | "intento_fallido"
  | "novedad"
  | "proximo_a_llegar"
  | "entregado"
  | "cancelado"
  | "devolucion"
  | "sin_clasificar";

export type ProcessResult = {
  action: string;
  taskId?: number;
  categoria: string;
};

export type EnsureTaskOptions = {
  order: Order;
  tipo: TaskType;
  titulo: string;
  descripcion?: string | null;
};

const OPEN_TASK_STATES = ["pendiente", "en_progreso"] satisfies TaskState[];

export class OrderNotFoundError extends Error {
  constructor(orderId: number) {
    super(`Order ${orderId} not found`);
    this.name = "OrderNotFoundError";
  }
}

function deadlineInTwoHours() {
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
}

function automaticCloseMessage(estadoDropi: string | null) {
  return `Cerrada automáticamente por cambio de estado a ${estadoDropi ?? "sin estado"}, no gestionada manualmente.`;
}

function appendCloseMessage(description: string | null, message: string) {
  if (!description) {
    return message;
  }

  if (description.includes(message)) {
    return description;
  }

  return `${description}\n\n${message}`;
}

function getOrderNumber(order: Order) {
  return order.numero_orden ?? String(order.id);
}

function getCustomerName(order: Order) {
  const fullName = [order.nombre, order.apellido].filter(Boolean).join(" ");
  return fullName || "Cliente sin nombre";
}

async function updateProcessedState(orderId: number, estadoDropi: string | null) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ tarea_generada_para_estado: estadoDropi })
    .eq("id", orderId);

  if (error) {
    throw error;
  }
}

async function loadOrder(orderId: number) {
  const supabase = createAdminClient();
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

export async function lookupCategory(order: Order): Promise<DecisionCategory> {
  if (!order.estado_dropi) {
    return "sin_clasificar";
  }

  const supabase = createAdminClient();

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

async function findOpenTask(orderId: number, tipo: TaskType) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("order_id", orderId)
    .eq("tipo", tipo)
    .in("estado", OPEN_TASK_STATES)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureOpenTask({
  order,
  tipo,
  titulo,
  descripcion = null,
}: EnsureTaskOptions): Promise<ProcessResult> {
  const existingTask = await findOpenTask(order.id, tipo);

  if (existingTask) {
    return {
      action: "task_exists",
      taskId: existingTask.id,
      categoria: "",
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      order_id: order.id,
      tipo,
      titulo,
      descripcion,
      estado: "pendiente",
      intento_numero: 1,
      creado_por: "automatico",
      fecha_limite: deadlineInTwoHours(),
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return {
    action: "task_created",
    taskId: data.id,
    categoria: "",
  };
}

async function updateFailedAttemptTask(order: Order) {
  const tipo = "presionar_entrega";
  const descripcion = `Estado Dropi: ${order.estado_dropi ?? "sin estado"}`;
  const existingTask = await findOpenTask(order.id, tipo);

  if (!existingTask) {
    return ensureOpenTask({
      order,
      tipo,
      titulo: "Presionar entrega, intento fallido",
      descripcion,
    });
  }

  const supabase = createAdminClient();
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

async function buildNovedadDescription(order: Order) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("status_history")
    .select("novedad, notas")
    .eq("order_id", order.id)
    .order("registrado_en", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const notes = [data?.novedad, data?.notas].filter(Boolean).join(" | ");

  return notes
    ? `Estado Dropi: ${order.estado_dropi ?? "sin estado"}\nNovedad/notas: ${notes}`
    : `Estado Dropi: ${order.estado_dropi ?? "sin estado"}`;
}

type CloseTasksOptions = {
  tipo?: TaskType;
  completadoPor: string;
  closeMessage: string;
};

async function closeTasks(order: Order, options: CloseTasksOptions) {
  const supabase = createAdminClient();
  let query = supabase
    .from("tasks")
    .select("*")
    .eq("order_id", order.id)
    .in("estado", OPEN_TASK_STATES);

  if (options.tipo) {
    query = query.eq("tipo", options.tipo);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const openTasks = data ?? [];

  await Promise.all(
    openTasks.map((task: Task) =>
      supabase
        .from("tasks")
        .update({
          estado: "completada",
          completado_en: new Date().toISOString(),
          completado_por: options.completadoPor,
          descripcion: appendCloseMessage(task.descripcion, options.closeMessage),
        })
        .eq("id", task.id)
        .then(({ error: updateError }) => {
          if (updateError) {
            throw updateError;
          }
        }),
    ),
  );

  return {
    action: openTasks.length > 0 ? "tasks_closed" : "no_open_tasks_to_close",
    taskId: openTasks[0]?.id,
    categoria: "",
  };
}

export async function closeOpenTasks(order: Order) {
  return closeTasks(order, {
    completadoPor: "sistema (cambio de estado automático)",
    closeMessage: automaticCloseMessage(order.estado_dropi),
  });
}

async function closeTasksOfType(order: Order, tipo: TaskType) {
  return closeTasks(order, {
    tipo,
    completadoPor: "sistema (pedido confirmado, avanzó de estado)",
    closeMessage:
      "Cerrada automáticamente porque el pedido fue confirmado y avanzó de estado.",
  });
}

type NotificacionTipo = Database["public"]["Enums"]["notificacion_tipo_enum"];
type NotificationRecipient = {
  id: string;
  telegram_chat_id: string | null;
};

type NotifyActiveProfilesInput = {
  tipo: NotificacionTipo;
  titulo: string;
  mensaje: string | null;
  orderId: number;
  taskId: number | null;
};

async function notifyActiveProfiles({
  tipo,
  titulo,
  mensaje,
  orderId,
  taskId,
}: NotifyActiveProfilesInput): Promise<NotificationRecipient[]> {
  try {
    const supabase = createAdminClient();
    const { data: activeProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,telegram_chat_id")
      .eq("activo", true);

    if (profilesError) {
      throw profilesError;
    }

    const recipients = (activeProfiles ?? []) as unknown as NotificationRecipient[];

    if (recipients.length === 0) {
      return [];
    }

    const rows = recipients.map((profile) => ({
      user_id: profile.id,
      tipo,
      titulo,
      mensaje,
      order_id: orderId,
      task_id: taskId,
    }));

    const { error: insertError } = await supabase
      .from("notifications")
      .insert(rows);

    if (insertError) {
      throw insertError;
    }

    return recipients;
  } catch (error) {
    console.error("Failed to insert notifications", error);
    return [];
  }
}

async function executeDecision(
  order: Order,
  categoria: DecisionCategory,
): Promise<ProcessResult> {
  switch (categoria) {
    case "nuevo":
      return ensureOpenTask({
        order,
        tipo: "llamar_confirmacion",
        titulo: `Llamar para confirmar pedido ${getOrderNumber(order)}`,
      });
    case "guia_generada":
      return ensureOpenTask({
        order,
        tipo: "notificar_guia",
        titulo: "Notificar guía de seguimiento al cliente",
      });
    case "en_reparto":
      return ensureOpenTask({
        order,
        tipo: "presionar_entrega",
        titulo: "Confirmar que el cliente esté pendiente de recibir",
      });
    case "recoger_oficina":
      return ensureOpenTask({
        order,
        tipo: "presionar_entrega",
        titulo: "Avisar al cliente que debe recoger el paquete en oficina",
      });
    case "intento_fallido":
      return updateFailedAttemptTask(order);
    case "novedad": {
      const result = await ensureOpenTask({
        order,
        tipo: "resolver_novedad",
        titulo: "Revisar y gestionar novedad",
        descripcion: await buildNovedadDescription(order),
      });

      const notificationRecipients = await notifyActiveProfiles({
        tipo: "novedad",
        titulo: `Novedad en pedido ${getOrderNumber(order)}`,
        mensaje: `Estado Dropi: ${order.estado_dropi ?? "sin estado"}`,
        orderId: order.id,
        taskId: result.taskId ?? null,
      });

      for (const profile of notificationRecipients) {
        if (!profile.telegram_chat_id) {
          continue;
        }

        try {
          await sendTelegramMessage(
            profile.telegram_chat_id,
            `🔴 Novedad en pedido ${getOrderNumber(order)}: ${order.estado_dropi ?? "sin estado"}`,
          );
        } catch (error) {
          console.error("Failed to send Telegram novedad notification", error);
        }
      }

      return result;
    }
    case "proximo_a_llegar":
      return ensureOpenTask({
        order,
        tipo: "notificar_proximo_llegar",
        titulo: "Avisar al cliente que el paquete está próximo a llegar",
      });
    case "entregado": {
      const result = await closeOpenTasks(order);

      const notificationRecipients = await notifyActiveProfiles({
        tipo: "pedido_entregado",
        titulo: `Pedido ${getOrderNumber(order)} entregado`,
        mensaje: `Cliente: ${getCustomerName(order)}`,
        orderId: order.id,
        taskId: null,
      });

      for (const profile of notificationRecipients) {
        if (!profile.telegram_chat_id) {
          continue;
        }

        try {
          await sendTelegramMessage(
            profile.telegram_chat_id,
            `✅ Pedido ${getOrderNumber(order)} entregado a ${getCustomerName(order)}`,
          );
        } catch (error) {
          console.error("Failed to send Telegram delivery notification", error);
        }
      }

      return result;
    }
    case "confirmado":
      return closeTasksOfType(order, "llamar_confirmacion");
    case "cancelado":
      return closeOpenTasks(order);
    case "devolucion": {
      const result = await closeOpenTasks(order);
      const productName = order.nombre_producto?.trim() || "Producto sin nombre";

      const notificationRecipients = await notifyActiveProfiles({
        tipo: "pedido_devolucion" as NotificacionTipo,
        titulo: `Devolución: pedido ${getOrderNumber(order)}`,
        mensaje: `Cliente: ${getCustomerName(order)} | Producto: ${productName}`,
        orderId: order.id,
        taskId: null,
      });

      for (const profile of notificationRecipients) {
        if (!profile.telegram_chat_id) {
          continue;
        }

        try {
          await sendTelegramMessage(
            profile.telegram_chat_id,
            `🔵 Devolución en pedido ${getOrderNumber(order)}: ${getCustomerName(order)}`,
          );
        } catch (error) {
          console.error("Failed to send Telegram return notification", error);
        }
      }

      return result;
    }
    case "en_ruta":
    case "sin_clasificar":
      return { action: "noop", categoria };
    default:
      return { action: "noop", categoria: "sin_clasificar" };
  }
}

export async function processOrderEvent(
  orderId: number,
): Promise<{ action: string; taskId?: number; categoria: string }> {
  const order = await loadOrder(orderId);
  const categoria = await lookupCategory(order);

  if (order.estado_dropi === order.tarea_generada_para_estado) {
    return {
      action: "skipped_no_change",
      categoria,
    };
  }

  const result = await executeDecision(order, categoria);
  await updateProcessedState(order.id, order.estado_dropi);

  return {
    ...result,
    categoria,
  };
}
