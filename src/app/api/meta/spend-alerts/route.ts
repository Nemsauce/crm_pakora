import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { MetaCampaignsApiError, MetaCampaignsConfigError } from "@/lib/meta/fetchMetaCampaigns";
import {
  getAdLevelInsights, getCampaignTotalSpend, MetaSpendRateLimitError,
  type AdLevelInsight,
} from "@/lib/meta/getAdLevelInsights";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { sendTelegramAlert, TELEGRAM_MESSAGE_LIMIT } from "@/lib/telegram/sendAlert";

export const runtime = "nodejs";
export const maxDuration = 300;

type Campaign = {
  id: string;
  nombre: string;
  producto_base: string | null;
  moneda: string | null;
  alerta_activa: boolean;
  alerta_umbral_gasto: number | null;
  alerta_ultimo_gasto_notificado: number | null;
};
type SpendAlertsDatabase = Omit<Database, "public"> & {
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

const columns = "id,nombre,producto_base,moneda,alerta_activa,alerta_umbral_gasto,alerta_ultimo_gasto_notificado";
const cop = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

function escapeName(value: string) {
  // Truncate before escaping so HTML entities and Unicode characters stay whole.
  const characters = Array.from(value);
  const shortened = characters.length > 200 ? `${characters.slice(0, 199).join("")}…` : value;
  return shortened.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function buildMessage(campaign: Campaign, spend: number, delta: number, ads: AdLevelInsight[]) {
  const header = [
    "🔔 <b>Alerta de Gasto</b>",
    `Campaña: <b>${escapeName(campaign.nombre)}</b>`,
    `Producto: ${escapeName(campaign.producto_base ?? "Sin producto asignado")}`,
    `Gasto total: $${cop.format(spend)} COP`,
    `Nuevo gasto desde última alerta: $${cop.format(delta)} COP`,
    "", "📊 <b>Desglose por anuncio:</b>",
  ].join("\n");
  const footer = `\nTotal ventas: ${cop.format(ads.reduce((sum, ad) => sum + ad.purchases, 0))}`;
  let message = header;
  let shown = 0;
  for (const ad of [...ads].sort((a, b) => b.spend - a.spend)) {
    const cpa = ad.costPerPurchase === null ? "N/D" : `$${cop.format(ad.costPerPurchase)} COP`;
    const line = `\n• ${escapeName(ad.adName)}: gastó $${cop.format(ad.spend)} COP → ${cop.format(ad.purchases)} ventas (CPA: ${cpa})`;
    const remaining = ads.length - shown - 1;
    const omitted = remaining ? `\ny ${remaining} anuncios más` : "";
    if ((message + line + omitted + footer).length > TELEGRAM_MESSAGE_LIMIT) break;
    message += line;
    shown += 1;
  }
  if (shown < ads.length) message += `\ny ${ads.length - shown} anuncios más`;
  return message + footer;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deadline = AbortSignal.timeout(240_000);
  const summary = {
    checked: 0, alerted: 0,
    errors: [] as { campaignId: string | null; error: string }[],
  };
  const report = (campaignId: string | null, error: string) => {
    summary.errors.push({ campaignId, error });
    console.error("Meta spend alert", { campaignId, error });
  };

  try {
    const supabase = createAdminClient() as unknown as SupabaseClient<SpendAlertsDatabase>;
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,telegram_chat_id")
      .not("telegram_chat_id", "is", null)
      .abortSignal(deadline);
    if (profilesError) {
      report(null, "No se pudieron cargar los destinatarios de Telegram.");
      return NextResponse.json(summary);
    }
    const recipients = (profiles ?? []).flatMap((profile) => {
      const chatId = profile.telegram_chat_id?.trim();
      return chatId ? [{ id: profile.id, chatId }] : [];
    });
    if (!recipients.length) {
      return NextResponse.json({
        ...summary, message: "No Telegram recipients configured",
      });
    }
    let after: string | null = null;
    let stopped = false;
    while (!stopped) {
      deadline.throwIfAborted();
      let query = supabase.from("meta_campaigns").select(columns)
        .eq("alerta_activa", true).not("alerta_umbral_gasto", "is", null)
        .order("id").limit(500);
      if (after) query = query.gt("id", after);
      const { data: campaigns, error } = await query.abortSignal(deadline);
      if (error) throw new Error("Campaign lookup failed");
      if (!campaigns?.length) break;

      for (const campaign of campaigns) {
        if (deadline.aborted) { stopped = true; break; }
        summary.checked += 1;
        try {
          if (campaign.moneda?.trim().toUpperCase() !== "COP") {
            report(campaign.id, "La moneda de la campaña no es COP o es desconocida.");
            continue;
          }
          const threshold = Number(campaign.alerta_umbral_gasto);
          const previous = Number(campaign.alerta_ultimo_gasto_notificado ?? 0);
          if (!Number.isFinite(threshold) || threshold <= 0 || !Number.isFinite(previous) || previous < 0) {
            report(campaign.id, "El umbral o el gasto previamente notificado es inválido.");
            continue;
          }
          const spend = await getCampaignTotalSpend(campaign.id, "maximum", deadline);
          if (spend < previous + threshold) continue;
          const ads = await getAdLevelInsights(campaign.id, "maximum", deadline);
          deadline.throwIfAborted();
          const message = buildMessage(campaign, spend, spend - previous, ads);
          let sent = false;
          for (const recipient of recipients) {
            try {
              const delivered = await sendTelegramAlert(recipient.chatId, message, deadline);
              if (delivered) sent = true;
              else report(campaign.id, `Telegram no confirmó el envío al perfil ${recipient.id}.`);
            } catch {
              report(campaign.id, `No se pudo enviar la alerta al perfil ${recipient.id}.`);
            }
          }
          if (!sent) {
            report(campaign.id, "Telegram no confirmó el envío; el gasto notificado no se actualizó.");
            continue;
          }
          summary.alerted += 1;
          // CAS protects the watermark against stale writers. It cannot make
          // the external send atomic: overlapping runs or a post-send failure
          // may still send duplicates and are reported below.
          let update = supabase.from("meta_campaigns")
            .update({ alerta_ultimo_gasto_notificado: spend })
            .eq("id", campaign.id);
          update = campaign.alerta_ultimo_gasto_notificado === null
            ? update.is("alerta_ultimo_gasto_notificado", null)
            : update.eq("alerta_ultimo_gasto_notificado", campaign.alerta_ultimo_gasto_notificado);
          const { data: saved, error: saveError } = await update.select("id").abortSignal(deadline).maybeSingle();
          if (saveError || !saved) {
            report(campaign.id, "Alerta enviada, pero falló la actualización o cambió el gasto previo; puede haber una alerta duplicada.");
          }
        } catch (error) {
          if (error instanceof MetaSpendRateLimitError) stopped = true;
          report(campaign.id,
            error instanceof MetaCampaignsApiError || error instanceof MetaCampaignsConfigError
              ? error.message : "No se pudo procesar la alerta de gasto.");
          if (deadline.aborted) { stopped = true; break; }
          if (stopped) break;
        }
      }
      after = campaigns[campaigns.length - 1].id;
      if (campaigns.length < 500) break;
    }
  } catch {
    if (!deadline.aborted) report(null, "No se pudieron cargar las campañas para revisar alertas.");
  }
  if (deadline.aborted) report(null, "Se agotó el presupuesto de 240 segundos; quedan campañas pendientes.");
  return NextResponse.json(summary);
}
