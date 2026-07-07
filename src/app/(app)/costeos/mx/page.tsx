import Link from "next/link";

import {
  CosteoCalculator,
  type CosteoCalculatorInitialValues,
} from "@/components/costeos/CosteoCalculator";
import { CosteoList, type CosteoListItem } from "@/components/costeos/CosteoList";
import {
  PromotionsPanel,
  type PromotionCosteoValues,
} from "@/components/costeos/PromotionsPanel";
import { createClient } from "@/lib/supabase/server";

const tabs = [
  { label: "Colombia", href: "/costeos/co", active: false },
  { label: "México", href: "/costeos/mx", active: true },
] as const;

const emptyMexicoCosteoValues = {
  nombre_producto: "",
  precio_proveedor: 0,
  flete_base: 0,
  tasa_efectividad: 0,
  costos_administrativos: 0,
  fullfilment: 0,
  cpa_ads: 0,
  cpa_porcentaje_objetivo: 0,
  tasa_cancelacion: 0,
  precio_venta: 0,
  precio_comparacion: 0,
  importe_gastado: null,
} satisfies CosteoCalculatorInitialValues;

type CosteosMexicoPageProps = {
  searchParams?: Promise<{
    guardado?: string | string[];
    importe?: string | string[];
    costeo?: string | string[];
  }>;
};

type CosteoRow = CosteoCalculatorInitialValues &
  CosteoListItem & {
    pais: "MX";
  };

type SupabaseError = {
  message: string;
};

type CosteoQueryBuilder = {
  eq(column: string, value: string): CosteoQueryBuilder;
  order(
    column: string,
    options: { ascending: boolean },
  ): Promise<{ data: CosteoRow[] | null; error: SupabaseError | null }>;
  maybeSingle(): Promise<{ data: CosteoRow | null; error: SupabaseError | null }>;
};

type CosteosReadClient = {
  from(table: "costeos"): {
    select(columns: string): CosteoQueryBuilder;
  };
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPromotionValues(costeo: CosteoRow): PromotionCosteoValues {
  const fleteConDevoluciones = costeo.flete_base / costeo.tasa_efectividad;
  const cpaConDevolucionesYCancelaciones =
    costeo.cpa_ads /
    (costeo.tasa_efectividad * (1 - costeo.tasa_cancelacion));
  const costoUnicoPorPedido =
    fleteConDevoluciones +
    costeo.costos_administrativos +
    costeo.fullfilment +
    cpaConDevolucionesYCancelaciones;
  const utilidadPorPedidoEntregado =
    costeo.precio_venta - (costeo.precio_proveedor + costoUnicoPorPedido);

  return {
    utilidadPorPedidoEntregado,
    costoUnicoPorPedido,
    precioProveedor: costeo.precio_proveedor,
    precioVenta: costeo.precio_venta,
  };
}

export default async function CosteosMexicoPage({
  searchParams,
}: CosteosMexicoPageProps) {
  const params = await searchParams;
  const saved = getSearchParam(params?.guardado) === "1";
  const importeSaved = getSearchParam(params?.importe) === "1";
  const selectedCosteoId = getSearchParam(params?.costeo) ?? null;
  const supabase = (await createClient()) as unknown as CosteosReadClient;
  const { data: costeosData, error: costeosError } = await supabase
    .from("costeos")
    .select("*")
    .eq("pais", "MX")
    .order("created_at", { ascending: false });

  if (costeosError) {
    throw new Error(`No se pudieron cargar los costeos: ${costeosError.message}`);
  }

  let selectedCosteo: CosteoRow | null = null;

  if (selectedCosteoId) {
    const { data, error } = await supabase
      .from("costeos")
      .select("*")
      .eq("pais", "MX")
      .eq("id", selectedCosteoId)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo cargar el costeo: ${error.message}`);
    }

    selectedCosteo = data;
  }

  const costeos = (costeosData ?? []).map((costeo) => ({
    ...costeo,
    id: String(costeo.id),
  }));

  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="border-b border-border pb-4">
        <p className="font-body text-xs uppercase text-text-secondary">
          COSTEOS
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          México
        </h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
          Calculadora operativa para validar margen antes de escalar producto.
        </p>
      </div>

      <nav className="mt-5 flex gap-2" aria-label="Países de costeos">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={`rounded-full px-4 py-2 font-body text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tab.active
                ? "bg-gradient-to-r from-accent-from to-accent-to font-semibold text-white shadow-md shadow-[var(--color-accent)]/20"
                : "border border-border bg-bg-surface font-medium text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <CosteoCalculator
        key={selectedCosteo ? String(selectedCosteo.id) : "nuevo"}
        pais="MX"
        saved={saved}
        importeSaved={importeSaved}
        costeoId={selectedCosteo ? String(selectedCosteo.id) : undefined}
        initialValues={selectedCosteo ?? emptyMexicoCosteoValues}
      />

      {selectedCosteo ? (
        <PromotionsPanel pais="MX" {...getPromotionValues(selectedCosteo)} />
      ) : null}

      <CosteoList costeos={costeos} selectedId={selectedCosteoId} />
    </section>
  );
}
