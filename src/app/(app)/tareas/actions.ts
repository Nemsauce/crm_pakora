"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type CompleteTaskResult = {
  error: string | null;
};

export async function completeTask(taskId: number): Promise<CompleteTaskResult> {
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return { error: "Tarea inválida." };
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userEmail = userData.user?.email;

  if (userError || !userEmail) {
    return { error: "No se pudo identificar el usuario activo." };
  }

  const completedAt = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({
      estado: "completada",
      completado_en: completedAt,
      completado_por: userEmail,
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

export async function reassignTask(
  taskId: number,
  userId: string | null,
): Promise<ReassignTaskResult> {
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return { error: "Tarea inválida." };
  }

  const supabase = await createClient();
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

  return { error: null };
}
