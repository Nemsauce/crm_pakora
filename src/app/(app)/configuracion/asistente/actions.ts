"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const ASSISTANT_SETTINGS_PATH = "/configuracion/asistente";

function readRules(formData: FormData) {
  const value = formData.get("reglas");

  return typeof value === "string" ? value.trim() : "";
}

export async function saveAssistantRules(formData: FormData) {
  const reglas = readRules(formData);
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  const updatedBy = user?.email?.trim();

  if (authError || !updatedBy) {
    throw new Error("Debes iniciar sesión para guardar las reglas.");
  }

  const { data, error } = await supabase
    .from("asistente_whatsapp_config")
    .update({ reglas, updated_por: updatedBy })
    .eq("id", 1)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `No se pudieron guardar las reglas: ${error?.message ?? "Configuración no encontrada."}`,
    );
  }

  revalidatePath(ASSISTANT_SETTINGS_PATH);
  redirect(`${ASSISTANT_SETTINGS_PATH}?guardado=1`);
}
