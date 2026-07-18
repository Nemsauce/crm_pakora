"use server";

import { revalidatePath } from "next/cache";

import { runDropiSyncCO } from "@/app/api/cron/dropi-sync-co/route";
import { runDropiSyncMX } from "@/app/api/cron/dropi-sync-mx/route";
import { createClient } from "@/lib/supabase/server";

const PEDIDOS_PATH = "/pedidos";

export type TriggerDropiSyncResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function triggerDropiSync(): Promise<TriggerDropiSyncResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      message: "Debes iniciar sesión para actualizar los pedidos.",
    };
  }

  let coOrdersMatched: number | null = null;
  let mxOrdersMatched: number | null = null;

  try {
    coOrdersMatched = (await runDropiSyncCO()).ordersMatched;
  } catch (error) {
    console.error(
      "Manual Dropi CO sync failed",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  try {
    mxOrdersMatched = (await runDropiSyncMX()).ordersMatched;
  } catch (error) {
    console.error(
      "Manual Dropi MX sync failed",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  revalidatePath(PEDIDOS_PATH);

  if (coOrdersMatched === null || mxOrdersMatched === null) {
    const countryResults = [
      `CO ${coOrdersMatched === null ? "falló" : `${coOrdersMatched} conciliados`}`,
      `MX ${mxOrdersMatched === null ? "falló" : `${mxOrdersMatched} conciliados`}`,
    ].join(", ");

    return {
      ok: false,
      message: `Actualización parcial: ${countryResults}. Intenta nuevamente.`,
    };
  }

  return {
    ok: true,
    message: `Actualizado: ${coOrdersMatched + mxOrdersMatched} pedidos conciliados (CO ${coOrdersMatched}, MX ${mxOrdersMatched}).`,
  };
}

export type UpdateOrderPhoneResult = {
  error: string | null;
  telefono?: string;
};

export async function updateOrderPhone(
  orderId: number,
  newPhone: string,
): Promise<UpdateOrderPhoneResult> {
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return { error: "Pedido inválido." };
  }

  const telefono = newPhone.trim();

  if (!telefono) {
    return { error: "El teléfono no puede estar vacío." };
  }

  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return { error: "No se pudo identificar el usuario activo." };
    }

    const { data, error } = await supabase
      .from("orders")
      .update({ telefono })
      .eq("id", orderId)
      .select("telefono")
      .maybeSingle();

    if (error) {
      console.error("Failed to update order phone", {
        orderId,
        message: error.message,
      });
      return { error: "No se pudo actualizar el teléfono." };
    }

    if (!data) {
      return { error: "Pedido no encontrado o sin acceso." };
    }

    revalidatePath(PEDIDOS_PATH);

    return { error: null, telefono: data.telefono ?? telefono };
  } catch (error) {
    console.error("Unexpected error updating order phone", {
      orderId,
      error,
    });
    return { error: "No se pudo actualizar el teléfono." };
  }
}
