"use server";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type GlobalSearchResult = Pick<
  Tables<"orders">,
  | "id"
  | "numero_orden"
  | "nombre"
  | "apellido"
  | "nombre_producto"
  | "estado_crm"
>;

export type GlobalSearchResponse = {
  results: GlobalSearchResult[];
  error: string | null;
};

function escapeIlikeTerm(value: string) {
  return value
    .replace(/[%,().]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export async function searchOrders(
  query: string,
): Promise<GlobalSearchResponse> {
  const term = escapeIlikeTerm(query);

  if (!term) {
    return { results: [], error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,numero_orden,nombre,apellido,nombre_producto,estado_crm",
    )
    .or(
      `nombre.ilike.%${term}%,apellido.ilike.%${term}%,telefono.ilike.%${term}%,numero_orden.ilike.%${term}%`,
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Global order search failed", error);
    return {
      results: [],
      error: "No se pudo completar la búsqueda.",
    };
  }

  return {
    results: data ?? [],
    error: null,
  };
}
