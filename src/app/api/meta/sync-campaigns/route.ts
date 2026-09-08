import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  fetchMetaCampaigns,
  MetaCampaignsApiError,
  MetaCampaignsConfigError,
  type MetaCampaignCountry,
  type MetaCampaignInsight,
} from "@/lib/meta/fetchMetaCampaigns";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 60;

type MetaCampaignRow = {
  id: string;
  ad_account_id: string;
  nombre: string;
  estado: string;
  objetivo: string | null;
  pais: MetaCampaignCountry | null;
  gasto: number | null;
  impresiones: number | null;
  clics: number | null;
  alcance: number | null;
  moneda: string | null;
  insight_desde: string | null;
  insight_hasta: string | null;
  actualizado_en: string;
};

type MetaCampaignsTable = {
  Row: MetaCampaignRow;
  Insert: MetaCampaignRow;
  Update: Partial<MetaCampaignRow>;
  Relationships: [];
};

type MetaCampaignDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      meta_campaigns: MetaCampaignsTable;
    };
  };
};

export type MetaCampaignSyncResult = {
  adAccountId: string;
  syncedAt: string;
  campaignsFetched: number;
  campaignsStored: number;
  insightsFetched: number;
  insightDesde: string;
  insightHasta: string;
  currency: string | null;
  apiCalls: number;
  maxObservedUsagePercent: number | null;
  partial: boolean;
  rateLimitDetected: boolean;
  warnings: string[];
};

class MetaCampaignSyncOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaCampaignSyncOperationError";
  }
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(
    cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`,
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runMetaCampaignsSync());
  } catch (error) {
    const knownError =
      error instanceof MetaCampaignsConfigError ||
      error instanceof MetaCampaignsApiError ||
      error instanceof MetaCampaignSyncOperationError;
    const errorMessage = knownError
      ? error.message
      : "Failed to sync Meta campaigns";

    console.error("Failed to sync Meta campaigns", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: errorMessage,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function runMetaCampaignsSync(): Promise<MetaCampaignSyncResult> {
  const fetched = await fetchMetaCampaigns();
  const syncedAt = new Date().toISOString();
  const supabase = createAdminClient() as unknown as SupabaseClient<MetaCampaignDatabase>;
  const campaignIds = fetched.campaigns.map((campaign) => campaign.id);
  let existingById = new Map<string, MetaCampaignRow>();

  if (campaignIds.length > 0) {
    const { data: existingRows, error: existingError } = await supabase
      .from("meta_campaigns")
      .select("*")
      .in("id", campaignIds);

    if (existingError) {
      throw new MetaCampaignSyncOperationError(
        "Failed to load existing Meta campaigns",
      );
    }

    existingById = new Map(
      (existingRows ?? []).map((row) => [row.id, row]),
    );
  }

  const rows = fetched.campaigns.map((campaign): MetaCampaignRow => {
    const existing = existingById.get(campaign.id);
    const metrics = resolveMetrics(campaign.insight, existing);
    const hasFreshInsight = campaign.insight !== null;

    return {
      id: campaign.id,
      ad_account_id: campaign.adAccountId,
      nombre: campaign.nombre,
      estado: campaign.estado,
      objetivo: campaign.objetivo,
      pais: campaign.pais,
      gasto: metrics.gasto,
      impresiones: metrics.impresiones,
      clics: metrics.clics,
      alcance: metrics.alcance,
      moneda: fetched.currency ?? existing?.moneda ?? null,
      insight_desde: hasFreshInsight
        ? fetched.insightDesde
        : existing?.insight_desde ?? null,
      insight_hasta: hasFreshInsight
        ? fetched.insightHasta
        : existing?.insight_hasta ?? null,
      actualizado_en: syncedAt,
    };
  });

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("meta_campaigns")
      .upsert(rows, { onConflict: "id" });

    if (upsertError) {
      throw new MetaCampaignSyncOperationError(
        "Failed to store Meta campaigns",
      );
    }
  }

  return {
    adAccountId: fetched.adAccountId,
    syncedAt,
    campaignsFetched: fetched.campaigns.length,
    campaignsStored: rows.length,
    insightsFetched: fetched.insightsFetched,
    insightDesde: fetched.insightDesde,
    insightHasta: fetched.insightHasta,
    currency: fetched.currency,
    apiCalls: fetched.apiCalls,
    maxObservedUsagePercent: fetched.maxObservedUsagePercent,
    partial: fetched.partial,
    rateLimitDetected: fetched.rateLimitDetected,
    warnings: fetched.warnings,
  };
}

function resolveMetrics(
  fresh: MetaCampaignInsight | null,
  existing: MetaCampaignRow | undefined,
) {
  if (fresh) {
    return fresh;
  }

  return {
    gasto: existing?.gasto ?? null,
    impresiones: existing?.impresiones ?? null,
    clics: existing?.clics ?? null,
    alcance: existing?.alcance ?? null,
  };
}
