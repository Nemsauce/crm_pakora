import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MetaCampaignsTable,
  type MetaCampaignRow,
} from "@/components/command-center/MetaCampaignsTable";
import { RefreshMetaCampaignsButton } from "@/components/command-center/RefreshMetaCampaignsButton";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  estado?: string;
};

type CampaignsPageProps = {
  searchParams: Promise<SearchParams>;
};

type MetaCampaignsTableDefinition = {
  Row: MetaCampaignRow;
  Insert: {
    id: string;
    ad_account_id: string;
    nombre: string;
    estado: string;
    objetivo?: string | null;
    pais?: string | null;
    moneda?: string | null;
    producto_base?: string | null;
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

const DEFAULT_STATUS_FILTER = "ACTIVE";

function getMetaCampaignsClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  return supabase as unknown as SupabaseClient<MetaCampaignsDatabase>;
}

function getInitialStatusFilter(value: string | undefined) {
  const normalized = value?.trim().toUpperCase();

  if (!normalized) {
    return DEFAULT_STATUS_FILTER;
  }

  return normalized === "TODOS" || normalized === "ALL" ? "todos" : normalized;
}

export default async function CommandCenterCampaignsPage({
  searchParams,
}: CampaignsPageProps) {
  const params = await searchParams;
  const initialStatusFilter = getInitialStatusFilter(params.estado);
  const rawSupabase = await createClient();
  const supabase = getMetaCampaignsClient(rawSupabase);
  const [campaignsResult, productsResult] = await Promise.all([
    supabase
      .from("meta_campaigns")
      .select(
        "id,ad_account_id,nombre,estado,objetivo,pais,moneda,producto_base,actualizado_en",
      )
      .order("nombre", { ascending: true }),
    rawSupabase.rpc("product_order_summary"),
  ]);

  if (campaignsResult.error) {
    throw new Error(
      `No se pudieron cargar las campañas: ${campaignsResult.error.message}`,
    );
  }

  if (productsResult.error) {
    throw new Error(
      `No se pudieron cargar los productos base: ${productsResult.error.message}`,
    );
  }

  const productOptions = [
    ...new Set(
      (productsResult.data ?? [])
        .map((row) => row.nombre_producto.trim())
        .filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right, "es"));

  return (
    <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-[var(--color-border-subtle)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            Torre de control
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            Campañas
          </h1>
          <p className="mt-2 max-w-3xl font-body text-sm text-text-secondary">
            Catálogo de campañas de Meta y su producto asociado. Abre una
            campaña para consultar su rendimiento en vivo por rango de fechas.
          </p>
        </div>

        <RefreshMetaCampaignsButton />
      </div>

      <div className="mt-6">
        <MetaCampaignsTable
          key={initialStatusFilter}
          campaigns={campaignsResult.data ?? []}
          productOptions={productOptions}
          initialStatusFilter={initialStatusFilter}
        />
      </div>
    </section>
  );
}
