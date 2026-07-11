"use server";

import { revalidatePath } from "next/cache";

import { runDropkillerSync } from "@/app/api/cron/dropkiller-sync/route";
import { createClient } from "@/lib/supabase/server";

const INVESTIGACION_PATH = "/command-center/investigacion";

export type SaveDropkillerProductInput = {
  external_id: string | number | null;
  dropkiller_uuid: string | null;
  country_code: "CO" | "MX";
  nombre_producto: string | null;
  sale_price: number | string | null;
  primary_image_url: string | null;
  sold_units_last_7_days: number | string | null;
  sold_units_last_30_days: number | string | null;
  total_sold_units: number | string | null;
  providers_count: number | string | null;
};

type SavedProductInsert = {
  external_id: string;
  dropkiller_uuid: string | null;
  country_code: "CO" | "MX";
  nombre_producto: string;
  sale_price: number | null;
  primary_image_url: string | null;
  sold_units_last_7_days: number | null;
  sold_units_last_30_days: number | null;
  total_sold_units: number | null;
  providers_count: number | null;
  saved_by: string;
};

type MutationResult = PromiseLike<{
  error: { message: string } | null;
}>;

type SavedProductsMutationClient = {
  from(table: "dropkiller_saved_products"): {
    upsert: (
      values: SavedProductInsert,
      options: { onConflict: string; ignoreDuplicates: boolean },
    ) => MutationResult;
    delete: () => {
      eq: (column: "id", value: string | number) => MutationResult;
    };
  };
};

export type TriggerDropkillerSyncResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function triggerDropkillerSync(): Promise<TriggerDropkillerSyncResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      message: "Debes iniciar sesión para actualizar la investigación.",
    };
  }

  try {
    const result = await runDropkillerSync();

    revalidatePath(INVESTIGACION_PATH);

    return {
      ok: true,
      message: `${result.totalProductsStored} productos actualizados, ${result.saturation.providersCountResolved} finalistas con datos de competencia.`,
    };
  } catch (error) {
    console.error(
      "Manual Dropkiller sync failed",
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      ok: false,
      message: "No se pudo actualizar Dropkiller. Intenta nuevamente.",
    };
  }
}

export async function saveDropkillerProduct(
  input: SaveDropkillerProductInput,
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Debes iniciar sesión para guardar productos.");
  }

  const payload = normalizeSavedProduct(input, user.id);
  const mutationClient = supabase as unknown as SavedProductsMutationClient;
  const { error } = await mutationClient
    .from("dropkiller_saved_products")
    .upsert(payload, {
      onConflict: "external_id,country_code",
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(`No se pudo guardar el producto: ${error.message}`);
  }

  revalidatePath(INVESTIGACION_PATH);
}

export async function removeSavedProduct(
  savedProductId: string | number,
) {
  if (
    (typeof savedProductId !== "string" &&
      typeof savedProductId !== "number") ||
    String(savedProductId).trim() === ""
  ) {
    throw new Error("El producto guardado no es válido.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Debes iniciar sesión para quitar productos guardados.");
  }

  const mutationClient = supabase as unknown as SavedProductsMutationClient;
  const { error } = await mutationClient
    .from("dropkiller_saved_products")
    .delete()
    .eq("id", savedProductId);

  if (error) {
    throw new Error(`No se pudo quitar el producto: ${error.message}`);
  }

  revalidatePath(INVESTIGACION_PATH);
}

function normalizeSavedProduct(
  input: SaveDropkillerProductInput,
  userId: string,
): SavedProductInsert {
  const externalId = toRequiredString(input.external_id, "external_id");
  const nombreProducto =
    toNullableString(input.nombre_producto) ?? "Producto sin nombre";

  if (input.country_code !== "CO" && input.country_code !== "MX") {
    throw new Error("El país del producto no es válido.");
  }

  return {
    external_id: externalId,
    dropkiller_uuid: toNullableString(input.dropkiller_uuid),
    country_code: input.country_code,
    nombre_producto: nombreProducto,
    sale_price: toNullableNumber(input.sale_price),
    primary_image_url: toNullableHttpUrl(input.primary_image_url),
    sold_units_last_7_days: toNullableNumber(input.sold_units_last_7_days),
    sold_units_last_30_days: toNullableNumber(input.sold_units_last_30_days),
    total_sold_units: toNullableNumber(input.total_sold_units),
    providers_count: toNullableNumber(input.providers_count),
    saved_by: userId,
  };
}

function toRequiredString(value: string | number | null, field: string) {
  const normalized = value === null ? "" : String(value).trim();

  if (!normalized) {
    throw new Error(`El campo ${field} es obligatorio.`);
  }

  return normalized;
}

function toNullableString(value: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

function toNullableHttpUrl(value: string | null) {
  const normalized = toNullableString(value);

  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:"
      ? normalized
      : null;
  } catch {
    return null;
  }
}

function toNullableNumber(value: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
