"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type Pais = "CO" | "MX";

type CosteoInsert = {
  pais: Pais;
  nombre_producto: string;
  precio_proveedor: number;
  flete_base: number;
  tasa_efectividad: number;
  costos_administrativos: number;
  fullfilment: number;
  cpa_ads: number;
  cpa_porcentaje_objetivo: number;
  tasa_cancelacion: number;
  precio_venta: number;
  precio_comparacion: number;
};

type CosteoUpdate = Omit<CosteoInsert, "pais">;

type CosteoCountry = {
  pais: Pais;
};

type CosteosTableClient = {
  from(table: "costeos"): {
    insert(values: CosteoInsert): Promise<{ error: { message: string } | null }>;
    select(columns: "pais"): {
      eq(column: "id", value: string): {
        maybeSingle(): Promise<{
          data: CosteoCountry | null;
          error: { message: string } | null;
        }>;
      };
    };
    update(values: Partial<CosteoInsert & { importe_gastado: number }>): {
      eq(
        column: string,
        value: string,
      ): {
        eq(
          nextColumn: string,
          nextValue: string,
        ): Promise<{ error: { message: string } | null }>;
      };
    };
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

function readOptionalNumber(formData: FormData, name: string) {
  const rawValue = readString(formData, name);

  if (!rawValue) {
    return 0;
  }

  const value = Number(rawValue.replace(",", "."));

  if (!Number.isFinite(value)) {
    throw new Error(`El campo ${name} debe ser un número válido.`);
  }

  return value;
}

function readPais(formData: FormData): Pais {
  const pais = readString(formData, "pais");

  if (pais === "CO" || pais === "MX") {
    return pais;
  }

  throw new Error("El país del costeo debe ser CO o MX.");
}

function getCosteosPath(pais: Pais) {
  return `/costeos/${pais.toLowerCase()}`;
}

function readDiscountPercentage(formData: FormData) {
  const discountPercentage = readOptionalNumber(formData, "precio_comparacion");

  if (discountPercentage < 0 || discountPercentage >= 100) {
    throw new Error("El % descuento mostrado debe ser menor a 100.");
  }

  return discountPercentage;
}

function readCosteoPayload(formData: FormData): CosteoUpdate {
  const nombreProducto = readString(formData, "nombre_producto");

  if (!nombreProducto) {
    throw new Error("El nombre del producto es obligatorio.");
  }

  return {
    nombre_producto: nombreProducto,
    precio_proveedor: readNumber(formData, "precio_proveedor"),
    flete_base: readNumber(formData, "flete_base"),
    tasa_efectividad: readNumber(formData, "tasa_efectividad") / 100,
    costos_administrativos: readNumber(formData, "costos_administrativos"),
    fullfilment: readNumber(formData, "fullfilment"),
    cpa_ads: readNumber(formData, "cpa_ads"),
    cpa_porcentaje_objetivo: readNumber(formData, "cpa_porcentaje_objetivo"),
    tasa_cancelacion: readNumber(formData, "tasa_cancelacion") / 100,
    precio_venta: readNumber(formData, "precio_venta"),
    precio_comparacion: readDiscountPercentage(formData),
  };
}

export async function createCosteo(formData: FormData) {
  const pais = readPais(formData);
  const payload: CosteoInsert = {
    pais,
    ...readCosteoPayload(formData),
  };

  const supabase = (await createClient()) as unknown as CosteosTableClient;
  const { error } = await supabase.from("costeos").insert(payload);

  if (error) {
    throw new Error(`No se pudo guardar el costeo: ${error.message}`);
  }

  redirect(`${getCosteosPath(pais)}?guardado=1`);
}

export async function updateCosteo(costeoId: string, formData: FormData) {
  const pais = readPais(formData);
  const payload = readCosteoPayload(formData);
  const supabase = (await createClient()) as unknown as CosteosTableClient;
  const { error } = await supabase
    .from("costeos")
    .update(payload)
    .eq("id", costeoId)
    .eq("pais", pais);

  if (error) {
    throw new Error(`No se pudo actualizar el costeo: ${error.message}`);
  }

  redirect(
    `${getCosteosPath(pais)}?costeo=${encodeURIComponent(costeoId)}&guardado=1`,
  );
}

export async function updateCosteoImporteGastado(
  costeoId: string,
  formData: FormData,
) {
  const importeGastado = readNumber(formData, "importe_gastado");
  const supabase = (await createClient()) as unknown as CosteosTableClient;
  const { data: costeo, error: costeoError } = await supabase
    .from("costeos")
    .select("pais")
    .eq("id", costeoId)
    .maybeSingle();

  if (costeoError || !costeo) {
    throw new Error(
      `No se pudo cargar el costeo: ${costeoError?.message ?? "Costeo no encontrado."}`,
    );
  }

  const { error } = await supabase
    .from("costeos")
    .update({ importe_gastado: importeGastado })
    .eq("id", costeoId)
    .eq("pais", costeo.pais);

  if (error) {
    throw new Error(`No se pudo guardar el importe gastado: ${error.message}`);
  }

  redirect(
    `${getCosteosPath(costeo.pais)}?costeo=${encodeURIComponent(costeoId)}&importe=1`,
  );
}
