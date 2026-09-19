import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchMetaCampaignMetrics } from "@/lib/meta/fetchMetaCampaigns";
import { MetaCampaignStatusError, updateCampaignStatus } from "@/lib/meta/updateCampaignStatus";
import { sendTelegramMessage } from "@/lib/notifications/sendTelegram";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type Campaign = {
  id: string;
  nombre: string;
  ad_account_id: string;
  pais: string | null;
  moneda: string | null;
  estado: string;
  autopause_activa: boolean;
  autopause_limite_gasto: number | null;
  autopause_desde: string | null;
  autopause_hasta: string | null;
  autopause_ultima_revision: string | null;
  autopause_pausada_por_regla: boolean;
  actualizado_en: string;
};

type AutopauseDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      meta_campaigns: {
        Row: Campaign;
        Insert: Partial<Campaign> & { id: string };
        Update: Partial<Campaign>;
        Relationships: [];
      };
    };
  };
};

export type AutopauseSummary = {
  evaluated: number;
  paused: string[];
  errors: { campaignId: string | null; error: string }[];
  dryRun?: true;
  wouldPause?: string[];
};

const PAGE_SIZE = 500;
const REQUEST_DELAY_MS = 300;
// The review timestamp also claims a campaign for overlapping cron requests.
// Five minutes is below the intended 15–30 minute schedule and covers maxDuration.
const CLAIM_TTL_MS = 5 * 60_000;
const RUN_BUDGET_MS = 180_000;
const columns = "id,nombre,ad_account_id,pais,moneda,estado,autopause_activa,autopause_limite_gasto,autopause_desde,autopause_hasta,autopause_ultima_revision,autopause_pausada_por_regla,actualizado_en";
const cop = new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 2,
});

class AutopauseRateLimitError extends Error {}

async function isActiveInMeta(campaign: Campaign) {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token || !/^\d+$/.test(campaign.id) || !/^(act_)?\d+$/.test(campaign.ad_account_id)) {
    throw new Error("Invalid Meta configuration");
  }
  // updateCampaignStatus is intentionally idempotent and returns void even
  // when already PAUSED. Check the live state to avoid attributing a stale
  // CRM ACTIVE record to the rule. The helper still validates before writing.
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${campaign.id}?fields=id,account_id,status`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (response.status === 429) throw new AutopauseRateLimitError();
  const payload: unknown = await response.json();
  const body = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown> : null;
  const error = body?.error as { code?: unknown } | undefined;
  if ([4, 17, 32, 613, 80000, 80001, 80002, 80003, 80004, 80005, 80006, 80008, 80009, 80014].includes(Number(error?.code))) {
    throw new AutopauseRateLimitError();
  }
  if (!response.ok || error || body?.id !== campaign.id ||
    body.account_id !== campaign.ad_account_id.replace(/^act_/, "") || typeof body.status !== "string") {
    throw new Error("Invalid Meta campaign response");
  }
  return body.status === "ACTIVE";
}

function todayInBogota() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function sameRule(current: Campaign, snapshot: Campaign) {
  return current.estado === "ACTIVE" && current.autopause_activa === true &&
    current.autopause_limite_gasto !== null &&
    Number(current.autopause_limite_gasto) === Number(snapshot.autopause_limite_gasto) &&
    current.autopause_desde === snapshot.autopause_desde &&
    current.autopause_hasta === snapshot.autopause_hasta &&
    current.ad_account_id === snapshot.ad_account_id && current.moneda === snapshot.moneda;
}

/** Real execution is pause-only. Dry runs do not write even review timestamps. */
export async function evaluateAutopause(
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<AutopauseSummary> {
  const startedAt = Date.now();
  const supabase = createAdminClient() as unknown as SupabaseClient<AutopauseDatabase>;
  const result: AutopauseSummary = {
    evaluated: 0, paused: [], errors: [],
    ...(dryRun ? { dryRun: true as const, wouldPause: [] } : {}),
  };
  const report = (campaignId: string | null, error: string) => {
    result.errors.push({ campaignId, error });
  };
  const campaigns: Campaign[] = [];

  // Read the candidate set before changing statuses; offset pagination must not
  // skip rows as paused campaigns disappear from the ACTIVE filter.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("meta_campaigns")
      .select(columns).eq("autopause_activa", true)
      .not("autopause_limite_gasto", "is", null).eq("estado", "ACTIVE")
      .order("id").range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      report(null, "No se pudieron cargar todas las reglas de auto-pausa.");
      break;
    }
    campaigns.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  // Oldest first prevents starvation when the run stops on rate limits/time.
  campaigns.sort((a, b) => (a.autopause_ultima_revision ?? "").localeCompare(b.autopause_ultima_revision ?? ""));

  let stopForRateLimit = false;
  for (const [index, campaign] of campaigns.entries()) {
    if (stopForRateLimit || Date.now() - startedAt >= RUN_BUDGET_MS) {
      report(null, `${campaigns.length - index} campañas pendientes: ${stopForRateLimit ? "límite de uso de Meta" : "tiempo disponible agotado"}. Se reintentarán en la próxima revisión.`);
      break;
    }
    // Defense in depth: these conditions must hold even if the query changes.
    if (!campaign.autopause_activa || campaign.autopause_limite_gasto === null || campaign.estado !== "ACTIVE") continue;
    if (!dryRun && campaign.autopause_ultima_revision &&
      Date.now() - Date.parse(campaign.autopause_ultima_revision) < CLAIM_TTL_MS) continue;

    let claimedAt: string | null = null;
    let stage = "consultar el gasto de Meta";
    try {
      if (!dryRun) {
        claimedAt = new Date().toISOString();
        let claim = supabase.from("meta_campaigns")
          .update({ autopause_ultima_revision: claimedAt })
          .eq("id", campaign.id).eq("estado", "ACTIVE").eq("autopause_activa", true)
          .eq("autopause_limite_gasto", campaign.autopause_limite_gasto);
        claim = campaign.autopause_desde === null ? claim.is("autopause_desde", null) : claim.eq("autopause_desde", campaign.autopause_desde);
        claim = campaign.autopause_hasta === null ? claim.is("autopause_hasta", null) : claim.eq("autopause_hasta", campaign.autopause_hasta);
        claim = campaign.autopause_ultima_revision === null ? claim.is("autopause_ultima_revision", null) : claim.eq("autopause_ultima_revision", campaign.autopause_ultima_revision);
        const { data, error } = await claim.select("id").maybeSingle();
        if (error) {
          claimedAt = null;
          report(campaign.id, "No se pudo registrar el inicio de la revisión; no se intentó pausar.");
          continue;
        }
        if (!data) { claimedAt = null; continue; }
      }
      result.evaluated += 1;
      const limit = Number(campaign.autopause_limite_gasto);
      const dateTo = campaign.autopause_hasta ?? todayInBogota();
      if (!Number.isFinite(limit) || limit <= 0 ||
        !validDate(campaign.autopause_desde) || !validDate(dateTo) || campaign.autopause_desde > dateTo) {
        report(campaign.id, "La regla tiene un límite o un rango de fechas inválido.");
        continue;
      }
      if (campaign.moneda?.trim().toUpperCase() !== "COP") {
        report(campaign.id, "No se puede comparar el límite COP con una moneda de Meta distinta o desconocida.");
        continue;
      }
      if (result.evaluated > 1) await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
      const insights = await fetchMetaCampaignMetrics(campaign.autopause_desde, dateTo);
      stopForRateLimit = insights.rateLimitDetected;
      if (insights.partial || !insights.metricsComplete || insights.rateLimitDetected) {
        report(campaign.id, "Meta devolvió datos incompletos o alcanzó su límite de uso; no se intentó pausar.");
        continue;
      }
      if (insights.adAccountId.replace(/^act_/, "") !== campaign.ad_account_id.replace(/^act_/, "")) {
        report(campaign.id, "Los insights no corresponden a la cuenta publicitaria de la campaña.");
        continue;
      }
      const spend = insights.metrics.find((row) => row.campaignId === campaign.id)?.gasto ?? 0;
      if (!Number.isFinite(spend) || spend < 0) {
        report(campaign.id, "Meta devolvió un gasto inválido.");
        continue;
      }
      if (spend < limit) continue;

      stage = "verificar el estado actual de la campaña en Meta";
      if (!await isActiveInMeta(campaign)) continue;

      // Re-read immediately before the external write: a user may have disabled
      // or edited the rule, or manually paused the campaign during insights.
      stage = "verificar la regla antes de pausar";
      const { data: current, error } = await supabase.from("meta_campaigns")
        .select(columns).eq("id", campaign.id).maybeSingle();
      if (error) throw new Error("Rule lookup failed");
      if (!current || !sameRule(current, campaign)) continue;
      if (dryRun) { result.wouldPause!.push(campaign.nombre); continue; }
      // PostgREST can serialize the same timestamptz with +00:00 instead of Z.
      if (!claimedAt || !current.autopause_ultima_revision ||
        Date.parse(current.autopause_ultima_revision) !== Date.parse(claimedAt)) continue;

      stage = "pausar en Meta";
      // Never pass ACTIVE here. The existing helper validates the live account
      // and refuses archived/deleted campaigns; writes are never retried.
      await updateCampaignStatus(campaign.id, "PAUSED", campaign.ad_account_id);
      result.paused.push(campaign.nombre);

      // Meta already succeeded. A database/Telegram failure must not undo it or
      // hide the successful pause from the response/other notification channels.
      try {
        const { data: saved, error: saveError } = await supabase.from("meta_campaigns")
          .update({ estado: "PAUSED", autopause_pausada_por_regla: true, actualizado_en: new Date().toISOString() })
          .eq("id", campaign.id).eq("estado", "ACTIVE").eq("autopause_activa", true)
          .eq("autopause_ultima_revision", claimedAt).select("id").maybeSingle();
        if (saveError || !saved) throw new Error("Persistence failed");
      } catch {
        report(campaign.id, "Meta confirmó la pausa, pero no se pudo guardar el estado en el CRM. Sincronizá las campañas.");
      }

      stage = "notificar por Telegram (la campaña ya está pausada)";
      const { data: profiles, error: profilesError } = await supabase.from("profiles")
        .select("telegram_chat_id").eq("activo", true).not("telegram_chat_id", "is", null);
      if (profilesError) throw new Error("Recipients lookup failed");
      const chatIds = [...new Set((profiles ?? []).map((profile) => profile.telegram_chat_id).filter((id): id is string => Boolean(id)))];
      if (!chatIds.length) report(campaign.id, "Campaña pausada; no hay destinatarios activos con Telegram configurado.");
      const country = campaign.pais === "CO" || campaign.pais === "MX" ? campaign.pais : undefined;
      for (const chatId of chatIds) {
        try {
          await sendTelegramMessage(chatId,
            `⏸ Auto-pausa por gasto\n${campaign.nombre}\nLímite: ${cop.format(limit)} COP\nGasto real: ${cop.format(spend)} COP\nPeríodo: ${campaign.autopause_desde} → ${dateTo}\nLa reactivación es manual desde el CRM.`, country);
        } catch {
          report(campaign.id, "Campaña pausada; falló el envío de una notificación de Telegram.");
        }
      }
    } catch (error) {
      // Raw fetch/Telegram errors may contain secrets. Only the status helper's
      // deliberately sanitized messages are safe to return.
      if (error instanceof AutopauseRateLimitError) {
        report(campaign.id, "Meta alcanzó su límite de uso al verificar el estado; no se intentó pausar.");
        stopForRateLimit = true;
      } else if (error instanceof MetaCampaignStatusError) {
        report(campaign.id, error.message);
        stopForRateLimit = /límite de uso/.test(error.message);
      } else {
        report(campaign.id, `No se pudo ${stage}.`);
      }
    } finally {
      if (claimedAt) {
        try {
          const { error } = await supabase.from("meta_campaigns")
            .update({ autopause_ultima_revision: new Date().toISOString() })
            .eq("id", campaign.id).eq("autopause_activa", true)
            .not("autopause_limite_gasto", "is", null).eq("autopause_ultima_revision", claimedAt);
          if (error) throw new Error("Review timestamp failed");
        } catch {
          report(campaign.id, "No se pudo registrar el fin de la revisión.");
        }
      }
    }
  }
  return result;
}
