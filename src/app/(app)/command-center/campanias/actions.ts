"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runMetaCampaignsSync } from "@/app/api/meta/sync-campaigns/route";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type MetaCampaignActionRow = {
  id: string;
  producto_base: string | null;
};

type MetaCampaignsTableDefinition = {
  Row: MetaCampaignActionRow;
  Insert: {
    id: string;
    producto_base?: string | null;
  };
  Update: {
    producto_base?: string | null;
  };
  Relationships: [];
};

type MetaCampaignsDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      meta_campaigns: MetaCampaignsTableDefinition;
    };
  };
};

export type RefreshMetaCampaignsResult =
  | { ok: true; message: string; partial?: boolean }
  | { ok: false; message: string };

export type SaveMetaCampaignProductResult =
  | { ok: true; message: string; productoBase: string | null }
  | { ok: false; message: string };

function getMetaCampaignsClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  return supabase as unknown as SupabaseClient<MetaCampaignsDatabase>;
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return error || !user ? null : supabase;
}

export async function refreshMetaCampaigns(): Promise<RefreshMetaCampaignsResult> {
  const supabase = await getAuthenticatedClient();

  if (!supabase) {
    return {
      ok: false,
      message: "Debes iniciar sesión para actualizar las campañas.",
    };
  }

  try {
    const result = await runMetaCampaignsSync();

    if (result.partial) {
      return {
        ok: true,
        partial: true,
        message: result.rateLimitDetected
          ? `Actualización parcial: se guardaron ${result.campaignsStored} campañas antes del límite de Meta.`
          : `Actualización parcial: se guardaron ${result.campaignsStored} campañas; Meta no entregó todo el catálogo.`,
      };
    }

    return {
      ok: true,
      message: `${result.campaignsStored} campañas actualizadas; recargando las métricas del rango visible.`,
    };
  } catch (error) {
    console.error(
      "Manual Meta campaigns sync failed",
      error instanceof Error ? error.name : "UnknownError",
    );

    return {
      ok: false,
      message: "No se pudieron actualizar las campañas. Intenta nuevamente.",
    };
  }
}

export async function saveMetaCampaignProduct(
  campaignId: string,
  productBase: string | null,
): Promise<SaveMetaCampaignProductResult> {
  const supabase = await getAuthenticatedClient();

  if (!supabase) {
    return {
      ok: false,
      message: "Debes iniciar sesión para asignar un producto.",
    };
  }

  const normalizedCampaignId = campaignId.trim();
  const normalizedProduct = productBase?.trim() || null;

  if (!/^\d+$/.test(normalizedCampaignId)) {
    return { ok: false, message: "La campaña no es válida." };
  }

  if (normalizedProduct) {
    const { data: productRows, error: productsError } = await supabase.rpc(
      "product_order_summary",
    );

    if (productsError) {
      return {
        ok: false,
        message: "No se pudo validar el producto seleccionado.",
      };
    }

    const validProducts = new Set(
      (productRows ?? [])
        .map((row) => row.nombre_producto.trim())
        .filter(Boolean),
    );

    if (!validProducts.has(normalizedProduct)) {
      return {
        ok: false,
        message: "El producto seleccionado ya no está disponible.",
      };
    }
  }

  const metaClient = getMetaCampaignsClient(supabase);
  const { data, error } = await metaClient
    .from("meta_campaigns")
    .update({ producto_base: normalizedProduct })
    .eq("id", normalizedCampaignId)
    .select("id,producto_base")
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to save Meta campaign product match", {
      hasDatabaseError: Boolean(error),
    });

    return {
      ok: false,
      message: "No se pudo guardar la asignación del producto.",
    };
  }

  return {
    ok: true,
    productoBase: data.producto_base,
    message: data.producto_base
      ? "Producto guardado."
      : "Asignación eliminada.",
  };
}
