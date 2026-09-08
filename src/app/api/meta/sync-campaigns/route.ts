import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  fetchMetaCampaigns,
  MetaCampaignsApiError,
  MetaCampaignsConfigError,
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
  pais: string | null;
  moneda: string | null;
  producto_base: string | null;
  actualizado_en: string;
};

type MetaCampaignInsert = {
  id: string;
  ad_account_id: string;
  nombre: string;
  estado: string;
  objetivo: string | null;
  moneda?: string | null;
  actualizado_en: string;
};

type MetaCampaignsTable = {
  Row: MetaCampaignRow;
  Insert: MetaCampaignInsert;
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
  const supabase = createAdminClient() as unknown as SupabaseClient<
    MetaCampaignDatabase
  >;
  const rows: MetaCampaignInsert[] = fetched.campaigns.map((campaign) => ({
    id: campaign.id,
    ad_account_id: campaign.adAccountId,
    nombre: campaign.nombre,
    estado: campaign.estado,
    objetivo: campaign.objetivo,
    ...(fetched.currency ? { moneda: fetched.currency } : {}),
    actualizado_en: syncedAt,
  }));

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
    currency: fetched.currency,
    apiCalls: fetched.apiCalls,
    maxObservedUsagePercent: fetched.maxObservedUsagePercent,
    partial: fetched.partial,
    rateLimitDetected: fetched.rateLimitDetected,
    warnings: fetched.warnings,
  };
}
