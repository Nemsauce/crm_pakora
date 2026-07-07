"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type CosteoInsert = {
  pais: "CO";
  nombre_producto: string;
  precio_proveedor: number;
  flete_base: number;
  tasa_efectividad: number;
  costos_administrativos: number;
  fullfilment: number;
  cpa_ads: number;
  tasa_cancelacion: number;
  precio_venta: number;
};

type CosteosTableClient = {
  from(table: "costeos"): {
    insert(values: CosteoInsert): Promise<{
      error: { message: string } | null;
    }>;
  };
};

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(formData: FormData, name: string) {
  const rawValue = readString(formData, name).replace(",", ".");
  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`El campo ${name} debe ser un número válido.`);
  }

  return value;
}

export async function createCosteo(formData: FormData) {
  const nombreProducto = readString(formData, "nombre_producto");

  if (!nombreProducto) {
    throw new Error("El nombre del producto es obligatorio.");
  }

  const payload: CosteoInsert = {
    pais: "CO",
    nombre_producto: nombreProducto,
    precio_proveedor: readNumber(formData, "precio_proveedor"),
    flete_base: readNumber(formData, "flete_base"),
    tasa_efectividad: readNumber(formData, "tasa_efectividad") / 100,
    costos_administrativos: readNumber(formData, "costos_administrativos"),
    fullfilment: readNumber(formData, "fullfilment"),
    cpa_ads: readNumber(formData, "cpa_ads"),
    tasa_cancelacion: readNumber(formData, "tasa_cancelacion") / 100,
    precio_venta: readNumber(formData, "precio_venta"),
  };

  const supabase = (await createClient()) as unknown as CosteosTableClient;
  const { error } = await supabase.from("costeos").insert(payload);

  if (error) {
    throw new Error(`No se pudo guardar el costeo: ${error.message}`);
  }

  redirect("/costeos/co?guardado=1");
}
