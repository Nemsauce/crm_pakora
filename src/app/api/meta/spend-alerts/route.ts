import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  MetaCampaignsApiError,
  MetaCampaignsConfigError,
} from "@/lib/meta/fetchMetaCampaigns";
import {
  getAdLevelInsights,
  getCampaignTotalSpend,
  MetaAdInsightsRateLimitError,
  type AdLevelInsight,
} from "@/lib/meta/getAdLevelInsights";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import {
  sendTelegramAlert,
  TELEGRAM_MESSAGE_LIMIT,
} from "@/lib/telegram/sendAlert";

export const runtime = "nodejs";
export const maxDuration = 300;

const PAGE_SIZE = 500;
const REQUEST_DELAY_MS = 300;
const RUN_BUDGET_MS = 240_000;
/** Leaves room for the closing lines when the per-ad list has to be trimmed. */
const MESSAGE_BUDGET = TELEGRAM_MESSAGE_LIMIT - 200;
const columns =
  "id,nombre,moneda,producto_base,alerta_activa,alerta_umbral_gasto,alerta_ultimo_gasto_notificado";

// meta_campaigns is not in the generated Supabase types yet; migration 054 added
// the alerta_* columns directly against the live database. Declare the shape
// locally, exactly as evaluateAutopause.ts and /api/meta/sync-campaigns do, so
// no generated type or schema artifact changes here.
type AlertCampaignRow = {
  id: string;
  nombre: string;
  moneda: string | null;
  producto_base: string | null;
  alerta_activa: boolean;
  alerta_umbral_gasto: number | null;
  alerta_ultimo_gasto_notificado: number | null;
};

type SpendAlertDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      meta_campaigns: {
        Row: AlertCampaignRow;
        Insert: Partial<AlertCampaignRow> & { id: string };
        Update: Partial<AlertCampaignRow>;
        Relationships: [];
      };
    };
  };
};

export type SpendAlertSummary = {
  checked: number;
  alerted: number;
  errors: { campaignId: string | null; error: string }[];
};

const copFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
});

function formatCop(value: number) {
  return `$${copFormatter.format(value)} COP`;
}

/**
 * parse_mode HTML means campaign, product and ad names are markup. An unescaped
 * `&` or `<` in a name makes Telegram reject the whole alert.
 */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMessage(
  campaign: AlertCampaignRow,
  spend: number,
  lastNotified: number,
  ads: AdLevelInsight[],
) {
  const totalPurchases = ads.reduce((total, ad) => total + ad.purchases, 0);
  // Highest spend first: it is what the alert is about, and it is what survives
  // if the per-ad list has to be trimmed to fit Telegram's limit.
  const sorted = [...ads].sort((left, right) => right.spend - left.spend);
  const header = [
    "🔔 <b>Alerta de Gasto</b>",
    `Campaña: <b>${escapeHtml(campaign.nombre)}</b>`,
    `Producto: ${escapeHtml(campaign.producto_base?.trim() || "Sin producto asignado")}`,
    "",
    `Gasto total: ${formatCop(spend)}`,
    `Nuevo gasto desde última alerta: ${formatCop(spend - lastNotified)}`,
    "",
    "📊 <b>Desglose por anuncio:</b>",
  ];
  const footer = ["", `Total ventas: ${totalPurchases}`];
  const adLines = sorted.map(
    (ad) =>
      `• ${escapeHtml(ad.adName)}: gastó ${formatCop(ad.spend)} → ${ad.purchases} ventas (CPA: ${
        ad.costPerPurchase === null ? "sin ventas" : formatCop(ad.costPerPurchase)
      })`,
  );
  const included: string[] = [];
  let length = [...header, ...footer].join("\n").length;

  for (const line of adLines) {
    if (length + line.length + 1 > MESSAGE_BUDGET) {
      break;
    }

    included.push(line);
    length += line.length + 1;
  }

  if (!adLines.length) {
    included.push("• Sin anuncios con entrega en este período.");
  } else if (included.length < adLines.length) {
    // Say the breakdown is partial rather than letting it read as complete.
    included.push(`• … y ${adLines.length - included.length} anuncios más.`);
  }

  return [...header, ...included, ...footer].join("\n");
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(
    cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`,
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const startedAt = Date.now();
  const supabase = createAdminClient() as unknown as SupabaseClient<SpendAlertDatabase>;
  const result: SpendAlertSummary = { checked: 0, alerted: 0, errors: [] };
  const report = (campaignId: string | null, error: string) => {
    result.errors.push({ campaignId, error });
  };
  const campaigns: AlertCampaignRow[] = [];

  // The route never writes alerta_activa or alerta_umbral_gasto, so the filtered
  // set is stable across pages and offset pagination cannot skip a row.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("meta_campaigns")
      .select(columns)
      .eq("alerta_activa", true)
      .not("alerta_umbral_gasto", "is", null)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      report(null, "No se pudieron cargar todas las reglas de alerta de gasto.");
      break;
    }

    campaigns.push(...(data ?? []));

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  let stopForRateLimit = false;

  for (const [index, campaign] of campaigns.entries()) {
    if (stopForRateLimit || Date.now() - startedAt >= RUN_BUDGET_MS) {
      report(
        null,
        `${campaigns.length - index} campañas pendientes: ${
          stopForRateLimit ? "límite de uso de Meta" : "tiempo disponible agotado"
        }. Se revisarán en la próxima ejecución.`,
      );
      break;
    }

    // Defense in depth: hold even if the query above changes.
    if (!campaign.alerta_activa || campaign.alerta_umbral_gasto === null) {
      continue;
    }

    result.checked += 1;

    const threshold = Number(campaign.alerta_umbral_gasto);
    const lastNotifiedRaw = campaign.alerta_ultimo_gasto_notificado;
    const lastNotified = lastNotifiedRaw === null ? 0 : Number(lastNotifiedRaw);

    if (!Number.isFinite(threshold) || threshold <= 0) {
      report(campaign.id, "El umbral de gasto de la alerta es inválido.");
      continue;
    }

    if (!Number.isFinite(lastNotified) || lastNotified < 0) {
      report(campaign.id, "El último gasto notificado es inválido.");
      continue;
    }

    // The alert reports COP. Comparing a COP threshold against another currency
    // would produce a wrong number rather than no number.
    if (campaign.moneda?.trim().toUpperCase() !== "COP") {
      report(
        campaign.id,
        "No se puede comparar el umbral en COP con una moneda de Meta distinta o desconocida.",
      );
      continue;
    }

    try {
      if (result.checked > 1) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
      }

      const spend = await getCampaignTotalSpend(campaign.id);

      if (spend < lastNotified + threshold) {
        continue;
      }

      const ads = await getAdLevelInsights(campaign.id);
      const message = buildMessage(campaign, spend, lastNotified, ads);

      // A failed send leaves the watermark untouched on purpose: the next run
      // re-evaluates the same campaign instead of losing the alert.
      if (!(await sendTelegramAlert(message))) {
        report(
          campaign.id,
          "No se pudo enviar la alerta por Telegram; se reintentará en la próxima ejecución.",
        );
        continue;
      }

      result.alerted += 1;

      // Compare-and-set on the value this run read, so a concurrent run cannot
      // roll the watermark back to an older spend figure.
      let update = supabase
        .from("meta_campaigns")
        .update({ alerta_ultimo_gasto_notificado: spend })
        .eq("id", campaign.id)
        .eq("alerta_activa", true);
      update =
        lastNotifiedRaw === null
          ? update.is("alerta_ultimo_gasto_notificado", null)
          : update.eq("alerta_ultimo_gasto_notificado", lastNotifiedRaw);

      const { data: saved, error: saveError } = await update
        .select("id")
        .maybeSingle();

      if (saveError || !saved) {
        report(
          campaign.id,
          "La alerta se envió, pero no se pudo guardar el último gasto notificado; la alerta puede repetirse.",
        );
      }
    } catch (error) {
      // Raw Meta errors can carry the request URL and the access token.
      if (error instanceof MetaAdInsightsRateLimitError) {
        stopForRateLimit = true;
        report(
          campaign.id,
          "Meta alcanzó su límite de uso; no se evaluó esta campaña.",
        );
      } else if (
        error instanceof MetaCampaignsApiError ||
        error instanceof MetaCampaignsConfigError
      ) {
        report(campaign.id, error.message);
      } else {
        report(campaign.id, "No se pudo evaluar la alerta de gasto de la campaña.");
      }
    }
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
