"use server";

import { revalidatePath } from "next/cache";

import { syncAbandonados } from "@/lib/abandonados/syncAbandonados";
import { createClient } from "@/lib/supabase/server";
import { generateAbandonadoRecoveryMessage } from "@/lib/whatsapp/generateAbandonadoRecoveryMessage";

export type EstadoAbandonado =
  | "nuevo"
  | "contactado"
  | "recuperado"
  | "descartado";

export type SuggestAbandonadoMessageResult =
  | { suggestion: string; error: null }
  | { suggestion: null; error: string };

export type UpdateAbandonadoEstadoResult =
  | { estado: EstadoAbandonado; error: null }
  | { estado: null; error: string };

export type TriggerAbandonadosSyncResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const VALID_STATES = new Set<EstadoAbandonado>([
  "nuevo",
  "contactado",
  "recuperado",
  "descartado",
]);

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return {
    user,
    authError: error,
    abandonadosClient: supabase,
  };
}

export async function suggestAbandonadoMessage(
  abandonadoId: number,
): Promise<SuggestAbandonadoMessageResult> {
  if (!Number.isSafeInteger(abandonadoId) || abandonadoId <= 0) {
    return { suggestion: null, error: "Registro inválido." };
  }

  const { user, authError, abandonadosClient } =
    await getAuthenticatedClient();

  if (authError || !user) {
    return {
      suggestion: null,
      error: "No se pudo identificar el usuario activo.",
    };
  }

  const { data: accessibleRow, error: accessError } = await abandonadosClient
    .from("abandonados")
    .select("id")
    .eq("id", abandonadoId)
    .maybeSingle();

  if (accessError || !accessibleRow) {
    return {
      suggestion: null,
      error: "Registro no encontrado o sin acceso.",
    };
  }

  try {
    const suggestion =
      await generateAbandonadoRecoveryMessage(abandonadoId);
    return { suggestion, error: null };
  } catch (error) {
    console.error("Failed to generate abandoned checkout suggestion", {
      abandonadoId,
      error,
    });

    return {
      suggestion: null,
      error: "No se pudo generar la sugerencia. Intenta nuevamente.",
    };
  }
}

export async function updateAbandonadoEstado(
  abandonadoId: number,
  estado: EstadoAbandonado,
): Promise<UpdateAbandonadoEstadoResult> {
  if (
    !Number.isSafeInteger(abandonadoId) ||
    abandonadoId <= 0 ||
    !VALID_STATES.has(estado)
  ) {
    return { estado: null, error: "Datos de seguimiento inválidos." };
  }

  const { user, authError, abandonadosClient } =
    await getAuthenticatedClient();

  if (authError || !user) {
    return {
      estado: null,
      error: "No se pudo identificar el usuario activo.",
    };
  }

  const { data, error } = await abandonadosClient
    .from("abandonados")
    .update({ estado })
    .eq("id", abandonadoId)
    .select("estado")
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to update abandoned checkout state", {
      abandonadoId,
      message: error?.message ?? "Record not found or inaccessible",
    });
    return {
      estado: null,
      error: "No se pudo actualizar el estado.",
    };
  }

  revalidatePath("/pedidos");

  return { estado: data.estado, error: null };
}

export async function triggerAbandonadosSync(): Promise<TriggerAbandonadosSyncResult> {
  const { user, authError } = await getAuthenticatedClient();

  if (authError || !user) {
    return {
      ok: false,
      message: "Debes iniciar sesión para sincronizar los abandonados.",
    };
  }

  try {
    const result = await syncAbandonados();
    const countrySummary = result.countries
      .map((country) => `${country.pais} ${country.upsertedRows}`)
      .join(", ");

    revalidatePath("/pedidos");

    return {
      ok: true,
      message: `Sincronizados ${result.totalUpsertedRows} registros (${countrySummary}).`,
    };
  } catch (error) {
    console.error("Manual abandoned checkout sync failed", error);
    return {
      ok: false,
      message: "No se pudieron sincronizar los abandonados. Intenta nuevamente.",
    };
  }
}
