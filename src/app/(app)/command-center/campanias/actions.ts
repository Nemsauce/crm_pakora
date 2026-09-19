"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { runMetaCampaignsSync } from "@/app/api/meta/sync-campaigns/route";
import {
  MetaCampaignStatusError,
  updateCampaignStatus,
  type EditableCampaignStatus,
} from "@/lib/meta/updateCampaignStatus";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type MetaCampaignAutopauseRule = {
  autopause_activa: boolean;
  autopause_limite_gasto: number | null;
  autopause_desde: string | null;
  autopause_hasta: string | null;
  autopause_ultima_revision: string | null;
  autopause_pausada_por_regla: boolean;
};

export type MetaCampaignAutopauseInput = Pick<
  MetaCampaignAutopauseRule,
  | "autopause_activa"
  | "autopause_limite_gasto"
  | "autopause_desde"
  | "autopause_hasta"
>;

export type MetaCampaignAutopauseResult =
  | { ok: true; rule: MetaCampaignAutopauseRule; message: string }
  | { ok: false; message: string };

const AUTOPAUSE_COLUMNS =
  "autopause_activa,autopause_limite_gasto,autopause_desde,autopause_hasta,autopause_ultima_revision,autopause_pausada_por_regla";

type MetaCampaignActionRow = MetaCampaignAutopauseRule & {
  id: string;
  moneda: string | null;
  producto_base: string | null;
  estado: string;
  ad_account_id: string;
  actualizado_en: string;
};

type MetaCampaignsTableDefinition = {
  Row: MetaCampaignActionRow;
  Insert: {
    id: string;
    producto_base?: string | null;
  };
  Update: Partial<MetaCampaignAutopauseInput> & {
    producto_base?: string | null;
    estado?: string;
    actualizado_en?: string;
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

export type ChangeMetaCampaignStatusResult =
  | { ok: true; estado: EditableCampaignStatus; message: string }
  | { ok: false; message: string; metaEstado?: EditableCampaignStatus };

export async function changeMetaCampaignStatus(
  campaignId: string,
  status: EditableCampaignStatus,
): Promise<ChangeMetaCampaignStatusResult> {
  if (
    typeof campaignId !== "string" ||
    !/^\d+$/.test(campaignId.trim()) ||
    (status !== "ACTIVE" && status !== "PAUSED")
  ) {
    return { ok: false, message: "La campaña o el estado solicitado no es válido." };
  }

  let supabase: Awaited<ReturnType<typeof getAuthenticatedClient>>;
  const normalizedId = campaignId.trim();
  try {
    supabase = await getAuthenticatedClient();
    if (!supabase) {
      return { ok: false, message: "Debes iniciar sesión para cambiar el estado de una campaña." };
    }
    // Use the authenticated client's RLS visibility; never accept an arbitrary
    // Meta object or account supplied by the browser.
    const { data: campaign, error } = await getMetaCampaignsClient(supabase)
      .from("meta_campaigns")
      .select("id,estado,ad_account_id")
      .eq("id", normalizedId)
      .maybeSingle();

    if (error || !campaign) {
      return { ok: false, message: "No se pudo acceder a la campaña en el CRM." };
    }
    if (campaign.estado !== "ACTIVE" && campaign.estado !== "PAUSED") {
      return { ok: false, message: "Solo se pueden cambiar campañas activas o pausadas. Las archivadas o eliminadas no se pueden reactivar desde aquí." };
    }

    await updateCampaignStatus(campaign.id, status, campaign.ad_account_id);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof MetaCampaignStatusError
        ? error.message
        : "No se pudo cambiar el estado de la campaña. Verificá su estado en Meta antes de reintentar.",
    };
  }

  try {
    const { data, error } = await getMetaCampaignsClient(supabase)
      .from("meta_campaigns")
      .update({ estado: status, actualizado_en: new Date().toISOString() })
      .eq("id", normalizedId)
      .select("id,estado")
      .maybeSingle();
    if (error || data?.estado !== status) throw new Error("Local status not saved");
  } catch {
    // Meta already succeeded: disclose the partial result, without claiming
    // that the campaign stayed in its previous state or issuing a rollback.
    return {
      ok: false,
      metaEstado: status,
      message: `Meta confirmó la campaña ${status === "PAUSED" ? "pausada" : "activa"}, pero no se pudo guardar el estado en el CRM. Actualizá las campañas desde el listado para sincronizar.`,
    };
  }

  revalidatePath("/command-center/campanias");
  revalidatePath(`/command-center/campanias/${normalizedId}`);
  return {
    ok: true,
    estado: status,
    message: status === "PAUSED" ? "Campaña pausada en Meta y en el CRM." : "Campaña reactivada en Meta y en el CRM.",
  };
}

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
      message: `${result.campaignsStored} campañas actualizadas.`,
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

  revalidatePath("/command-center/campanias");
  revalidatePath(`/command-center/campanias/${normalizedCampaignId}`);

  return {
    ok: true,
    productoBase: data.producto_base,
    message: data.producto_base
      ? "Producto guardado."
      : "Asignación eliminada.",
  };
}

function isAutopauseDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function getAutopauseToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validateAutopauseRule(rule: MetaCampaignAutopauseInput): string | null {
  if (!rule || typeof rule !== "object" || Array.isArray(rule) ||
      typeof rule.autopause_activa !== "boolean") {
    return "La configuración de auto-pausa no es válida.";
  }

  const limit = rule.autopause_limite_gasto;
  if (limit !== null && (
    typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0 ||
    !Number.isSafeInteger(Math.round(limit * 100)) ||
    Math.round(limit * 100) / 100 !== limit
  )) {
    return "Ingresá un límite de gasto positivo en COP, con máximo dos decimales.";
  }

  if ((rule.autopause_desde !== null && !isAutopauseDate(rule.autopause_desde)) ||
      (rule.autopause_hasta !== null && !isAutopauseDate(rule.autopause_hasta))) {
    return "Las fechas de auto-pausa deben ser válidas y tener formato AAAA-MM-DD.";
  }

  if (rule.autopause_activa && (limit === null || rule.autopause_desde === null)) {
    return "Para activar la auto-pausa, configurá un límite de gasto y una fecha de inicio.";
  }

  if (rule.autopause_hasta !== null && rule.autopause_desde === null) {
    return "Seleccioná la fecha de inicio del rango de auto-pausa.";
  }

  if (rule.autopause_desde !== null &&
      rule.autopause_desde > (rule.autopause_hasta ?? getAutopauseToday())) {
    return "La fecha de inicio no puede ser posterior al final del rango de auto-pausa.";
  }

  return null;
}

export async function getMetaCampaignAutopause(
  campaignId: string,
): Promise<MetaCampaignAutopauseResult> {
  if (typeof campaignId !== "string" || !/^\d+$/.test(campaignId.trim())) {
    return { ok: false, message: "La campaña no es válida." };
  }

  try {
    const supabase = await getAuthenticatedClient();
    if (!supabase) {
      return { ok: false, message: "Debes iniciar sesión para consultar la auto-pausa." };
    }

    const { data, error } = await getMetaCampaignsClient(supabase)
      .from("meta_campaigns")
      .select(AUTOPAUSE_COLUMNS)
      .eq("id", campaignId.trim())
      .maybeSingle();

    if (error || !data) {
      return { ok: false, message: "No se pudo consultar la auto-pausa de esta campaña." };
    }

    return { ok: true, rule: data, message: "Configuración de auto-pausa cargada." };
  } catch {
    return { ok: false, message: "No se pudo consultar la auto-pausa. Volvé a intentar." };
  }
}

export async function saveMetaCampaignAutopause(
  campaignId: string,
  rule: MetaCampaignAutopauseInput,
): Promise<MetaCampaignAutopauseResult> {
  if (typeof campaignId !== "string" || !/^\d+$/.test(campaignId.trim())) {
    return { ok: false, message: "La campaña no es válida." };
  }

  const validationError = validateAutopauseRule(rule);
  if (validationError) return { ok: false, message: validationError };

  const normalizedId = campaignId.trim();
  try {
    const supabase = await getAuthenticatedClient();
    if (!supabase) {
      return { ok: false, message: "Debes iniciar sesión para guardar la auto-pausa." };
    }

    const metaClient = getMetaCampaignsClient(supabase);
    if (rule.autopause_activa) {
      const { data: campaign, error } = await metaClient
        .from("meta_campaigns")
        .select("moneda")
        .eq("id", normalizedId)
        .maybeSingle();

      if (error || !campaign) {
        return { ok: false, message: "No se pudo acceder a la campaña en el CRM." };
      }
      if (campaign.moneda !== "COP") {
        return { ok: false, message: "La auto-pausa requiere que la moneda de Meta esté confirmada en COP." };
      }
    }

    // Explicitly whitelist editable rule fields. Status, audit timestamps and
    // the system-pause marker belong to the evaluator, never to browser input.
    let update = metaClient.from("meta_campaigns").update({
      autopause_activa: rule.autopause_activa,
      autopause_limite_gasto: rule.autopause_limite_gasto,
      autopause_desde: rule.autopause_desde,
      autopause_hasta: rule.autopause_hasta,
    }).eq("id", normalizedId);
    if (rule.autopause_activa) update = update.eq("moneda", "COP");

    const { data, error } = await update.select(AUTOPAUSE_COLUMNS).maybeSingle();
    if (error || !data) {
      return { ok: false, message: "No se pudo guardar la auto-pausa de esta campaña." };
    }

    revalidatePath("/command-center/campanias");
    revalidatePath(`/command-center/campanias/${normalizedId}`);
    return {
      ok: true,
      rule: data,
      message: data.autopause_activa ? "Auto-pausa activada y guardada." : "Auto-pausa desactivada y guardada.",
    };
  } catch {
    return { ok: false, message: "No se pudo guardar la auto-pausa. Volvé a intentar." };
  }
}
