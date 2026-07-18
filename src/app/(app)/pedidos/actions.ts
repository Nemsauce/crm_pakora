"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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

    revalidatePath("/pedidos");

    return { error: null, telefono: data.telefono ?? telefono };
  } catch (error) {
    console.error("Unexpected error updating order phone", {
      orderId,
      error,
    });
    return { error: "No se pudo actualizar el teléfono." };
  }
}
