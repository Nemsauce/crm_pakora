"use server";

import { createClient } from "@/lib/supabase/server";
import { generateTaskSuggestion } from "@/lib/whatsapp/generateTaskSuggestion";

export type SuggestTaskMessageResult =
  | { suggestion: string; error: null }
  | { suggestion: null; error: string };

export async function suggestTaskMessage(
  taskId: number,
): Promise<SuggestTaskMessageResult> {
  if (!Number.isSafeInteger(taskId) || taskId <= 0) {
    return { suggestion: null, error: "Tarea inválida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      suggestion: null,
      error: "No se pudo identificar el usuario activo.",
    };
  }

  const { data: accessibleTask, error: taskAccessError } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .maybeSingle();

  if (taskAccessError || !accessibleTask) {
    return {
      suggestion: null,
      error: "Tarea no encontrada o sin acceso.",
    };
  }

  try {
    const suggestion = await generateTaskSuggestion(taskId);
    return { suggestion, error: null };
  } catch (error) {
    console.error("Failed to generate task WhatsApp suggestion", {
      taskId,
      error,
    });
    return {
      suggestion: null,
      error: "No se pudo generar la sugerencia. Intenta nuevamente.",
    };
  }
}
