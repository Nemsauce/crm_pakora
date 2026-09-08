import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { runMetaCampaignsSync } from "@/app/api/meta/sync-campaigns/route";
import {
  MetaCampaignsTable,
  type MetaCampaignRow,
} from "@/components/command-center/MetaCampaignsTable";
import {
  RefreshMetaCampaignsButton,
  type RefreshMetaCampaignsResult,
} from "@/components/command-center/RefreshMetaCampaignsButton";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const CAMPAIGNS_PATH = "/command-center/campanias";

type MetaCampaignsTableDefinition = {
  Row: MetaCampaignRow;
  Insert: {
    id: string;
    ad_account_id: string;
    nombre: string;
    estado: string;
    objetivo?: string | null;
    pais?: string | null;
    gasto?: number | null;
    impresiones?: number | null;
    clics?: number | null;
    alcance?: number | null;
    moneda?: string | null;
    insight_desde?: string | null;
    insight_hasta?: string | null;
    actualizado_en?: string;
  };
  Update: Partial<MetaCampaignRow>;
  Relationships: [];
};

type MetaCampaignsDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & {
      meta_campaigns: MetaCampaignsTableDefinition;
    };
  };
};

function getMetaCampaignsClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  return supabase as unknown as SupabaseClient<MetaCampaignsDatabase>;
}

async function refreshMetaCampaigns(): Promise<RefreshMetaCampaignsResult> {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      message: "Debes iniciar sesión para actualizar las campañas.",
    };
  }

  try {
    const result = await runMetaCampaignsSync();
    revalidatePath(CAMPAIGNS_PATH);

    if (result.partial) {
      return {
        ok: true,
        partial: true,
        message: result.rateLimitDetected
          ? `Actualización parcial: se guardaron ${result.campaignsStored} campañas, pero Meta limitó parte de la consulta.`
          : `Actualización parcial: se guardaron ${result.campaignsStored} campañas, pero Meta no entregó todas las páginas o métricas.`,
      };
    }

    return {
      ok: true,
      message: `${result.campaignsStored} campañas actualizadas con ${result.apiCalls} consultas a Meta.`,
    };
  } catch (error) {
    console.error(
      "Manual Meta campaigns sync failed",
      error instanceof Error ? error.name : "Unknown error",
    );

    return {
      ok: false,
      message: "No se pudieron actualizar las campañas. Intenta nuevamente.",
    };
  }
}

export default async function CommandCenterCampaignsPage() {
  const supabase = getMetaCampaignsClient(await createClient());
  const { data, error } = await supabase
    .from("meta_campaigns")
    .select(
      "id,ad_account_id,nombre,estado,objetivo,pais,gasto,impresiones,clics,alcance,moneda,insight_desde,insight_hasta,actualizado_en",
    )
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(`No se pudieron cargar las campañas: ${error.message}`);
  }

  return (
    <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="border-b border-[var(--color-border-subtle)] pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
              Torre de control
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Campañas
            </h1>
            <p className="mt-2 max-w-3xl font-body text-sm text-text-secondary">
              Inversión, impresiones, clics y alcance reportados por Meta Ads
              para los últimos 30 días.
            </p>
            <p className="mt-2 max-w-3xl font-body text-sm text-text-secondary">
              Esta vista aún no cruza campañas con ventas ni calcula el ROAS
              real del CRM.
            </p>
          </div>

          <RefreshMetaCampaignsButton refreshAction={refreshMetaCampaigns} />
        </div>
      </div>

      <div className="mt-6">
        <MetaCampaignsTable campaigns={data ?? []} />
      </div>
    </section>
  );
}
