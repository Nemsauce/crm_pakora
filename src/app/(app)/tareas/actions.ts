"use server";

import {
  sendTelegramMessage,
  type TelegramCountry,
} from "@/lib/notifications/sendTelegram";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CompleteTaskResult = {
  error: string | null;
};

export async function completeTask(
  taskId: number,
  notes?: string,
): Promise<CompleteTaskResult> {
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return { error: "Tarea inválida." };
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userEmail = userData.user?.email;

  if (userError || !userEmail) {
    return { error: "No se pudo identificar el usuario activo." };
  }

  const trimmedNotes = notes?.trim();
  const completedAt = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({
      estado: "completada",
      completado_en: completedAt,
      completado_por: userEmail,
      notas_completado: trimmedNotes ? trimmedNotes : null,
      updated_at: completedAt,
    })
    .eq("id", taskId)
    .in("estado", ["pendiente", "en_progreso"]);

  if (error) {
    return { error: "No se pudo completar la tarea." };
  }

  return { error: null };
}

export type ReassignTaskResult = {
  error: string | null;
};

export type SnoozeTaskResult = {
  error: string | null;
};

type TasksSnoozeClient = {
  from(table: "tasks"): {
    update(values: { snoozed_until: string; updated_at: string }): {
      eq(column: "id", value: number): {
        in(
          column: "estado",
          values: ["pendiente", "en_progreso"],
        ): PromiseLike<{ error: { message: string } | null }>;
      };
    };
  };
};

export async function snoozeTask(
  taskId: number,
  snoozeUntil: Date,
): Promise<SnoozeTaskResult> {
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return { error: "Tarea inválida." };
  }

  const snoozeTimestamp =
    snoozeUntil instanceof Date ? snoozeUntil.getTime() : Number.NaN;

  if (!Number.isFinite(snoozeTimestamp) || snoozeTimestamp <= Date.now()) {
    return { error: "La nueva fecha debe estar en el futuro." };
  }

  const supabase = await createClient();
  const tasksClient = supabase as unknown as TasksSnoozeClient;
  const updatedAt = new Date().toISOString();
  const { error } = await tasksClient
    .from("tasks")
    .update({
      snoozed_until: new Date(snoozeTimestamp).toISOString(),
      updated_at: updatedAt,
    })
    .eq("id", taskId)
    .in("estado", ["pendiente", "en_progreso"]);

  if (error) {
    console.error("Failed to snooze task", {
      taskId,
      message: error.message,
    });
    return { error: "No se pudo posponer la tarea." };
  }

  return { error: null };
}

async function notifyAssignee({
  userId,
  taskId,
  titulo,
  orderId,
  numeroOrden,
  pais,
}: {
  userId: string;
  taskId: number;
  titulo: string;
  orderId: number | null;
  numeroOrden: string | null;
  pais: TelegramCountry | null;
}) {
  try {
    const supabase = createAdminClient();
    const notificacionTitulo = "📋 Te asignaron una tarea";
    const notificacionMensaje = `${titulo} · pedido ${numeroOrden ?? "sin número"}`;

    const { error: insertError } = await supabase.from("notifications").insert({
      user_id: userId,
      tipo: "tarea_urgente_asignada",
      titulo: notificacionTitulo,
      mensaje: notificacionMensaje,
      order_id: orderId,
      task_id: taskId,
    });

    if (insertError) {
      throw insertError;
    }

    try {
      const { data: assigneeProfile, error: profileError } = await supabase
        .from("profiles")
        .select("telegram_chat_id")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const profile = assigneeProfile as unknown as {
        telegram_chat_id: string | null;
      } | null;

      if (profile?.telegram_chat_id) {
        if (!pais) {
          throw new Error("Order country is unavailable for Telegram notification");
        }

        await sendTelegramMessage(
          profile.telegram_chat_id,
          `${notificacionTitulo}\n${notificacionMensaje}`,
          pais,
        );
      }
    } catch (telegramError) {
      console.error("Failed to send Telegram assignment notification", telegramError);
    }
  } catch (error) {
    console.error("Failed to insert assignment notification", error);
  }
}

export async function reassignTask(
  taskId: number,
  userId: string | null,
): Promise<ReassignTaskResult> {
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return { error: "Tarea inválida." };
  }

  const supabase = await createClient();
  const { data: existingTask } = await supabase
    .from("tasks")
    .select(
      "asignado_a, titulo, order_id, orders(numero_orden, nombre, apellido, pais)",
    )
    .eq("id", taskId)
    .maybeSingle();

  const { error } = await supabase
    .from("tasks")
    .update({
      asignado_a: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    return { error: "No se pudo reasignar la tarea." };
  }

  if (userId && existingTask && userId !== existingTask.asignado_a) {
    const order = existingTask.orders;

    await notifyAssignee({
      userId,
      taskId,
      titulo: existingTask.titulo,
      orderId: existingTask.order_id,
      numeroOrden: order?.numero_orden ?? null,
      pais: order?.pais ?? null,
    });
  }

  return { error: null };
}
