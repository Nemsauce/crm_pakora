"use server";

import { revalidatePath } from "next/cache";

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

  revalidatePath("/tareas");

  return { error: null };
}

export type ReassignTaskResult = {
  error: string | null;
};

async function notifyAssignee({
  userId,
  taskId,
  titulo,
  orderId,
  numeroOrden,
  clienteNombre,
}: {
  userId: string;
  taskId: number;
  titulo: string;
  orderId: number | null;
  numeroOrden: string | null;
  clienteNombre: string | null;
}) {
  try {
    const supabase = createAdminClient();
    const contextParts = [numeroOrden, clienteNombre].filter(Boolean);
    const mensaje =
      contextParts.length > 0
        ? `Pedido ${contextParts.join(" · ")}`
        : `Tarea: ${titulo}`;

    const { error: insertError } = await supabase.from("notifications").insert({
      user_id: userId,
      tipo: "tarea_urgente_asignada",
      titulo: `Tarea asignada: ${titulo}`,
      mensaje,
      order_id: orderId,
      task_id: taskId,
    });

    if (insertError) {
      throw insertError;
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
    .select("asignado_a, titulo, order_id, orders(numero_orden, nombre, apellido)")
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

  revalidatePath("/tareas");

  if (userId && existingTask && userId !== existingTask.asignado_a) {
    const order = existingTask.orders;
    const clienteNombre = order
      ? [order.nombre, order.apellido].filter(Boolean).join(" ") || null
      : null;

    await notifyAssignee({
      userId,
      taskId,
      titulo: existingTask.titulo,
      orderId: existingTask.order_id,
      numeroOrden: order?.numero_orden ?? null,
      clienteNombre,
    });
  }

  return { error: null };
}
