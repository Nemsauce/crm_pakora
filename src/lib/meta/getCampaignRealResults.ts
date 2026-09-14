import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/lib/supabase/database.types";

type Category = Database["public"]["Enums"]["categoria_estado_enum"];
type Country = Database["public"]["Enums"]["pais_enum"];
type MatchedOrder = Pick<
  Tables<"orders">,
  "id" | "pais" | "estado_dropi" | "transportadora" | "monto_a_ganar"
>;
type CategoryCatalog = Map<string, Map<string | null, Category>>;

export type CampaignRealResults = {
  total: number;
  confirmados: number;
  entregados: number;
  devoluciones: number;
  enProceso: number;
  cancelados: number;
  countries: Array<{
    pais: Country;
    moneda: "COP" | "MXN";
    total: number;
    gananciaEntregados: number;
    entregadosSinGanancia: number;
  }>;
};

const PAGE_SIZE = 1000;
const HISTORY_BATCH_SIZE = 200;
const CURRENCY_BY_COUNTRY = { CO: "COP", MX: "MXN" } as const;

function getProductBase(name: string | null) {
  // product_order_summary(): trim(split_part(trim(nombre_producto), ':', 1)).
  // Source: ccf1cb3, supabase/baseline/20260728_crm_public_schema.sql.
  // SQL trim() removes ordinary spaces only; preserve case and punctuation.
  return (
    name?.replace(/^ +| +$/g, "").split(":", 1)[0].replace(/^ +| +$/g, "") ??
    null
  );
}

async function loadCatalog(supabase: SupabaseClient<Database>) {
  const catalog: CategoryCatalog = new Map();
  let lastId: number | null = null;

  for (;;) {
    let query = supabase
      .from("status_catalog")
      .select("id,estado,transportadora,categoria")
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (lastId !== null) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const carriers = catalog.get(row.estado) ?? new Map();
      if (!carriers.has(row.transportadora)) {
        carriers.set(row.transportadora, row.categoria);
      }
      catalog.set(row.estado, carriers);
    }

    lastId = data[data.length - 1].id;
  }

  return catalog;
}

function lookupCategory(
  catalog: CategoryCatalog,
  state: string | null,
  carrier: string | null,
): Category {
  // Same precedence as processOrderEvent.lookupCategory, without N+1 queries.
  const carriers = state ? catalog.get(state) : undefined;
  return (
    (carrier ? carriers?.get(carrier) : undefined) ??
    carriers?.get(null) ??
    "sin_clasificar"
  );
}

async function loadMatchedOrders(
  supabase: SupabaseClient<Database>,
  productBase: string,
  dateFrom: string,
  dateTo: string,
) {
  const orders: MatchedOrder[] = [];
  let lastId: number | null = null;

  for (;;) {
    let query = supabase
      .from("orders")
      .select("id,nombre_producto,pais,estado_dropi,transportadora,monto_a_ganar")
      // fecha is a DATE: both calendar endpoints are inclusive, without UTC conversion.
      .gte("fecha", dateFrom)
      .lte("fecha", dateTo)
      .not("nombre_producto", "is", null)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (lastId !== null) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;

    for (const order of data) {
      if (getProductBase(order.nombre_producto) === productBase) {
        orders.push(order);
      }
    }

    lastId = data[data.length - 1].id;
  }

  return orders;
}

async function loadConfirmedOrderIds(
  supabase: SupabaseClient<Database>,
  orders: MatchedOrder[],
  catalog: CategoryCatalog,
) {
  const confirmedIds = new Set<number>();

  for (let offset = 0; offset < orders.length; offset += HISTORY_BATCH_SIZE) {
    const orderIds = orders
      .slice(offset, offset + HISTORY_BATCH_SIZE)
      .map((order) => order.id);
    let lastId: number | null = null;

    for (;;) {
      let query = supabase
        .from("status_history")
        .select("id,order_id,estado,transportadora")
        .in("order_id", orderIds)
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);

      if (lastId !== null) query = query.gt("id", lastId);

      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) break;

      for (const entry of data) {
        // product_order_summary counts a recorded confirmation at any point,
        // not an inferred confirmation from the order's current delivery state.
        // Resolve the historical state through the editable catalog and its own carrier.
        if (
          lookupCategory(catalog, entry.estado, entry.transportadora) ===
          "confirmado"
        ) {
          confirmedIds.add(entry.order_id);
        }
      }

      lastId = data[data.length - 1].id;
    }
  }

  return confirmedIds;
}

export async function getCampaignRealResults(
  supabase: SupabaseClient<Database>,
  productoBase: string | null,
  dateFrom: string,
  dateTo: string,
): Promise<CampaignRealResults | null> {
  if (!productoBase?.trim()) return null;

  const [orders, catalog] = await Promise.all([
    loadMatchedOrders(supabase, productoBase, dateFrom, dateTo),
    loadCatalog(supabase),
  ]);
  const confirmedIds = await loadConfirmedOrderIds(supabase, orders, catalog);
  const countries = new Map<Country, CampaignRealResults["countries"][number]>();
  const profitCents = new Map<Country, number>();
  const result: CampaignRealResults = {
    total: orders.length,
    confirmados: confirmedIds.size,
    entregados: 0,
    devoluciones: 0,
    enProceso: 0,
    cancelados: 0,
    countries: [],
  };

  for (const order of orders) {
    const country = countries.get(order.pais) ?? {
      pais: order.pais,
      moneda: CURRENCY_BY_COUNTRY[order.pais],
      total: 0,
      gananciaEntregados: 0,
      entregadosSinGanancia: 0,
    };
    country.total += 1;
    countries.set(order.pais, country);

    const category = lookupCategory(
      catalog,
      order.estado_dropi,
      order.transportadora,
    );
    if (category === "entregado") {
      result.entregados += 1;
      if (order.monto_a_ganar === null || !Number.isFinite(order.monto_a_ganar)) {
        country.entregadosSinGanancia += 1;
      } else {
        // monto_a_ganar is numeric(12,2); sum its cents without mixing currencies.
        profitCents.set(
          order.pais,
          (profitCents.get(order.pais) ?? 0) + Math.round(order.monto_a_ganar * 100),
        );
      }
    } else if (category === "devolucion") {
      result.devoluciones += 1;
    } else {
      result.enProceso += 1;
      if (category === "cancelado") result.cancelados += 1;
    }
  }

  result.countries = [...countries.values()]
    .sort((left, right) => left.pais.localeCompare(right.pais))
    .map((country) => ({
      ...country,
      gananciaEntregados: (profitCents.get(country.pais) ?? 0) / 100,
    }));

  return result;
}
