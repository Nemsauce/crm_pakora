import "server-only";

import type {
  DropiHistoryEntry,
  DropiOrderMX,
} from "@/lib/dropi/fetchDropiOrdersMX";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import {
  processOrderHistory,
  type OrderHistoryEntry,
} from "@/lib/tasks/processOrderHistory";
import {
  lookupCategory,
  type DecisionCategory,
  type Order,
} from "@/lib/tasks/processOrderEvent";

const ACTIVE_ORDERS_SELECT =
  "id,numero_orden,id_orden_shopify,id_orden_dropi,telefono,fecha,total,estado_dropi,tarea_generada_para_estado,status_history(registrado_en)";
const PHONE_SUFFIX_LENGTH = 10;
const PHONE_MATCH_MAX_DATE_DIFFERENCE_MS = 3 * 24 * 60 * 60 * 1_000;

type LatestStatusHistory = {
  registrado_en: string | null;
};

type SupabaseActiveOrder = {
  id: number;
  numero_orden: string | null;
  id_orden_shopify: string | null;
  id_orden_dropi: number | null;
  telefono: string | null;
  fecha: string | null;
  total: number | null;
  estado_dropi: string | null;
  tarea_generada_para_estado: string | null;
  status_history: LatestStatusHistory[] | LatestStatusHistory | null;
};

type MatchMethod = "shop_order_id" | "id_orden_dropi" | "phone";

type OrderMatch = {
  dropiOrder: DropiOrderMX;
  matchMethod: MatchMethod;
  supabaseOrder: SupabaseActiveOrder;
};

type OrderUpdateWithExpectedProfit =
  Database["public"]["Tables"]["orders"]["Update"] & {
    monto_a_ganar: number | null;
  };

export type SyncDropiOrdersMXResult = {
  ordersFromDropi: number;
  ordersMatched: number;
  ordersWithMissingHistory: number;
  orderUpdateErrors: string[];
};

function normalizeId(value: unknown) {
  return value === null || value === undefined || value === ""
    ? null
    : String(value);
}

function getPhoneSuffix(value: unknown) {
  const digits = value === null || value === undefined
    ? ""
    : String(value).replace(/\D/g, "");

  return digits.length >= PHONE_SUFFIX_LENGTH
    ? digits.slice(-PHONE_SUFFIX_LENGTH)
    : null;
}

function getDropiInteger(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function getFiniteNumber(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function getCalendarDateEpoch(value: unknown) {
  if (typeof value !== "string") return null;

  const date = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];

  if (!date) return null;

  const epoch = Date.parse(`${date}T00:00:00.000Z`);

  return Number.isFinite(epoch) ? epoch : null;
}

function isCorroboratedPhoneMatch(
  dropiOrder: DropiOrderMX,
  supabaseOrder: SupabaseActiveOrder,
) {
  const dropiTotal = getFiniteNumber(dropiOrder.total_order);
  const supabaseTotal = getFiniteNumber(supabaseOrder.total);
  const dropiDate = getCalendarDateEpoch(dropiOrder.created_at);
  const supabaseDate = getCalendarDateEpoch(supabaseOrder.fecha);

  return (
    dropiTotal !== null &&
    supabaseTotal !== null &&
    Math.abs(dropiTotal - supabaseTotal) < 0.005 &&
    dropiDate !== null &&
    supabaseDate !== null &&
    Math.abs(dropiDate - supabaseDate) <=
      PHONE_MATCH_MAX_DATE_DIFFERENCE_MS
  );
}

function addGroupedValue<T>(
  groups: Map<string, T[]>,
  key: string,
  value: T,
) {
  const values = groups.get(key);

  if (values) {
    values.push(value);
  } else {
    groups.set(key, [value]);
  }
}

function matchDropiOrders(
  dropiOrders: DropiOrderMX[],
  supabaseOrders: SupabaseActiveOrder[],
) {
  const matchesByDropiIndex = new Map<number, OrderMatch>();
  const matchedSupabaseOrderIds = new Set<number>();

  function addMatch(
    index: number,
    dropiOrder: DropiOrderMX,
    supabaseOrder: SupabaseActiveOrder,
    matchMethod: MatchMethod,
  ) {
    matchesByDropiIndex.set(index, {
      dropiOrder,
      matchMethod,
      supabaseOrder,
    });
    matchedSupabaseOrderIds.add(supabaseOrder.id);
  }

  function matchRemainingById(
    matchMethod: Exclude<MatchMethod, "phone">,
    getDropiKey: (order: DropiOrderMX) => string | null,
    getSupabaseKey: (order: SupabaseActiveOrder) => string | null,
  ) {
    for (const [index, dropiOrder] of dropiOrders.entries()) {
      if (matchesByDropiIndex.has(index)) continue;

      const key = getDropiKey(dropiOrder);

      if (!key) continue;

      const supabaseOrder = supabaseOrders.find(
        (candidate) =>
          !matchedSupabaseOrderIds.has(candidate.id) &&
          getSupabaseKey(candidate) === key,
      );

      if (supabaseOrder) {
        addMatch(index, dropiOrder, supabaseOrder, matchMethod);
      }
    }
  }

  matchRemainingById(
    "shop_order_id",
    (order) => normalizeId(order.shop_order_id),
    (order) => normalizeId(order.id_orden_shopify),
  );
  matchRemainingById(
    "id_orden_dropi",
    (order) => normalizeId(order.id),
    (order) => normalizeId(order.id_orden_dropi),
  );

  const dropiGroups = new Map<
    string,
    Array<{ index: number; order: DropiOrderMX }>
  >();
  const supabaseGroups = new Map<string, SupabaseActiveOrder[]>();

  for (const [index, order] of dropiOrders.entries()) {
    if (
      matchesByDropiIndex.has(index) ||
      normalizeId(order.shop_order_id) !== null ||
      (getDropiInteger(order.id) ?? 0) <= 0
    ) {
      continue;
    }

    const phoneSuffix = getPhoneSuffix(order.phone);

    if (phoneSuffix) {
      addGroupedValue(dropiGroups, phoneSuffix, { index, order });
    }
  }

  for (const order of supabaseOrders) {
    if (
      matchedSupabaseOrderIds.has(order.id) ||
      order.id_orden_dropi !== null ||
      normalizeId(order.id_orden_shopify) === null
    ) {
      continue;
    }

    const phoneSuffix = getPhoneSuffix(order.telefono);

    if (phoneSuffix) {
      addGroupedValue(supabaseGroups, phoneSuffix, order);
    }
  }

  for (const [phoneSuffix, dropiCandidates] of dropiGroups) {
    const supabaseCandidates = supabaseGroups.get(phoneSuffix) ?? [];

    if (supabaseCandidates.length === 0) continue;

    if (dropiCandidates.length !== 1 || supabaseCandidates.length !== 1) {
      console.warn("Skipping ambiguous Dropi phone fallback", {
        country: "MX",
        phone_suffix: `***${phoneSuffix.slice(-4)}`,
        dropi_order_ids: dropiCandidates.map(({ order }) =>
          normalizeId(order.id),
        ),
        supabase_order_ids: supabaseCandidates.map((order) => order.id),
      });
      continue;
    }

    const [{ index, order: dropiOrder }] = dropiCandidates;
    const [supabaseOrder] = supabaseCandidates;

    if (!isCorroboratedPhoneMatch(dropiOrder, supabaseOrder)) {
      console.warn("Skipping uncorroborated Dropi phone fallback", {
        country: "MX",
        dropi_order_id: normalizeId(dropiOrder.id),
        supabase_order_id: supabaseOrder.id,
      });
      continue;
    }

    addMatch(index, dropiOrder, supabaseOrder, "phone");
  }

  return [...matchesByDropiIndex.entries()]
    .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .map(([, match]) => match);
}

function getLatestKnownRegisteredAt(supabaseOrder: SupabaseActiveOrder) {
  const history = supabaseOrder.status_history;

  if (Array.isArray(history) && history.length > 0) {
    return history[0]?.registrado_en ?? null;
  }

  if (history && typeof history === "object" && !Array.isArray(history)) {
    return history.registrado_en ?? null;
  }

  return null;
}

function getHistoryEstado(historyEntry: DropiHistoryEntry) {
  return historyEntry?.status ?? historyEntry?.estado ?? null;
}

function getHistoryRegisteredAt(historyEntry: DropiHistoryEntry) {
  return (
    historyEntry?.created_at ??
    historyEntry?.registrado_en ??
    historyEntry?.updated_at ??
    null
  );
}

function getHistoryNovedad(
  historyEntry: DropiHistoryEntry,
  fallbackNovedad: string | null,
) {
  return (
    historyEntry?.novedad ??
    historyEntry?.observacion ??
    historyEntry?.observation ??
    historyEntry?.description ??
    historyEntry?.notes ??
    fallbackNovedad ??
    null
  );
}

function isStrictlyAfterKnownRegisteredAt(
  registradoEn: string | null,
  latestKnownRegisteredAt: string | null,
) {
  if (!latestKnownRegisteredAt) return true;
  if (!registradoEn) return false;

  const registeredTime = Date.parse(registradoEn);
  const latestKnownTime = Date.parse(latestKnownRegisteredAt);

  if (Number.isFinite(registeredTime) && Number.isFinite(latestKnownTime)) {
    return registeredTime > latestKnownTime;
  }

  return String(registradoEn) > String(latestKnownRegisteredAt);
}

function getMissingHistoryEntries(
  history: DropiHistoryEntry[] | null | undefined,
  latestKnownRegisteredAt: string | null,
  fallbackTransportadora: string | null,
  fallbackNovedad: string | null,
): OrderHistoryEntry[] {
  if (!Array.isArray(history)) return [];

  return history
    .map((historyEntry): OrderHistoryEntry | null => {
      const estado = getHistoryEstado(historyEntry);
      const registradoEn = getHistoryRegisteredAt(historyEntry);

      if (!estado || !registradoEn) {
        return null;
      }

      return {
        estado,
        transportadora:
          historyEntry?.transportadora ??
          historyEntry?.distribution_company?.name ??
          fallbackTransportadora ??
          null,
        novedad: getHistoryNovedad(historyEntry, fallbackNovedad),
        registrado_en: registradoEn,
      };
    })
    .filter((historyEntry): historyEntry is OrderHistoryEntry => Boolean(historyEntry))
    .filter((historyEntry) =>
      isStrictlyAfterKnownRegisteredAt(
        historyEntry.registrado_en,
        latestKnownRegisteredAt,
      ),
    );
}

function isClosedCategory(categoria: DecisionCategory) {
  return (
    categoria === "entregado" ||
    categoria === "cancelado" ||
    categoria === "devolucion"
  );
}

function getRiskLevel(dropiOrder: DropiOrderMX) {
  const totalPedidos = dropiOrder.client_total_orders || 0;
  const devoluciones = dropiOrder.client_total_orders_returneds || 0;
  let nivelRiesgo = "sin_datos";

  if (Number(totalPedidos) > 0) {
    const tasa = Number(devoluciones) / Number(totalPedidos);

    if (tasa >= 0.5) nivelRiesgo = "alto";
    else if (tasa >= 0.25) nivelRiesgo = "medio";
    else nivelRiesgo = "bajo";
  }

  return nivelRiesgo;
}

function getDropiAmount(value: number | string | null | undefined) {
  return Number.parseFloat(String(value || 0));
}

function getNullableDropiAmount(
  value: number | string | null | undefined,
) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const amount = Number(value);

  return Number.isFinite(amount) ? amount : null;
}

function getOrderLabel(order: SupabaseActiveOrder) {
  return order.numero_orden ?? String(order.id);
}

function getErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  return error instanceof Error ? error.message : "Unknown order sync error";
}

function recordOrderError(
  errors: string[],
  order: SupabaseActiveOrder,
  scope: string,
  error: unknown,
) {
  const message = getErrorMessage(error);

  console.error("Failed to reconcile Dropi order", {
    order_id: order.id,
    scope,
    error: message,
  });
  errors.push(`${getOrderLabel(order)} (${scope}): ${message}`);
}

async function loadActiveMXOrders() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ACTIVE_ORDERS_SELECT)
    .eq("activo", true)
    .eq("pais", "MX")
    .order("registrado_en", {
      referencedTable: "status_history",
      ascending: false,
    })
    .limit(1, { referencedTable: "status_history" });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as SupabaseActiveOrder[];
}

function getOrderForCategoryLookup(
  supabaseOrder: SupabaseActiveOrder,
  estadoDropi: string | null,
  transportadora: string | null,
) {
  return {
    ...supabaseOrder,
    estado_dropi: estadoDropi,
    transportadora,
  } as unknown as Order;
}

async function updateDenormalizedFields(
  supabaseOrder: SupabaseActiveOrder,
  dropiOrder: DropiOrderMX,
  estadoNuevo: string | null,
  registradoEn: string | null,
  transportadora: string | null,
) {
  const categoria = await lookupCategory(
    getOrderForCategoryLookup(supabaseOrder, estadoNuevo, transportadora),
  );
  const orderDetail = (dropiOrder.orderdetails || [])[0] || {};
  const supabase = createAdminClient();
  const orderUpdate: OrderUpdateWithExpectedProfit = {
    nivel_riesgo: getRiskLevel(dropiOrder),
    costo_producto: getDropiAmount(orderDetail.supplier_price),
    costo_envio: getDropiAmount(dropiOrder.shipping_amount),
    monto_a_ganar: getNullableDropiAmount(
      dropiOrder.dropshipper_amount_to_win,
    ),
    guia_envio: dropiOrder.shipping_guide ?? null,
    transportadora,
    fecha_entrega_real: estadoNuevo === "ENTREGADO" ? registradoEn : null,
    activo: !isClosedCategory(categoria),
  };
  const dropiOrderId = getDropiInteger(dropiOrder.id);
  const totalPedidos = getDropiInteger(dropiOrder.client_total_orders);
  const pedidosEntregados = getDropiInteger(
    dropiOrder.client_total_orders_delivered,
  );
  const pedidosDevueltos = getDropiInteger(
    dropiOrder.client_total_orders_returneds,
  );

  if (dropiOrderId !== null && dropiOrderId > 0) {
    orderUpdate.id_orden_dropi = dropiOrderId;
  }

  if (totalPedidos !== null) {
    orderUpdate.total_pedidos_cliente = totalPedidos;
  }

  if (pedidosEntregados !== null) {
    orderUpdate.pedidos_entregados_cliente = pedidosEntregados;
  }

  if (pedidosDevueltos !== null) {
    orderUpdate.pedidos_devueltos_cliente = pedidosDevueltos;
  }

  const { error } = await supabase
    .from("orders")
    .update(
      orderUpdate as Database["public"]["Tables"]["orders"]["Update"],
    )
    .eq("id", supabaseOrder.id);

  if (error) {
    throw error;
  }
}

async function updateCurrentDropiState(
  supabaseOrder: SupabaseActiveOrder,
  estadoDropi: string | null,
) {
  if (estadoDropi === null) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("orders")
    .update({ estado_dropi: estadoDropi })
    .eq("id", supabaseOrder.id);

  if (error) {
    throw error;
  }
}

export async function syncDropiOrdersMX(
  dropiOrders: DropiOrderMX[],
): Promise<SyncDropiOrdersMXResult> {
  const supabaseOrders = await loadActiveMXOrders();
  const orderMatches = matchDropiOrders(dropiOrders, supabaseOrders);
  const phoneFallbackMatches = orderMatches.filter(
    (match) => match.matchMethod === "phone",
  ).length;
  const orderUpdateErrors: string[] = [];
  let ordersWithMissingHistory = 0;

  if (phoneFallbackMatches > 0) {
    console.info("Selected Dropi orders by unique phone fallback", {
      country: "MX",
      orders_matched: phoneFallbackMatches,
    });
  }

  for (const { dropiOrder, supabaseOrder } of orderMatches) {
    try {
      const estadoNuevo = dropiOrder.status ?? null;
      const history = Array.isArray(dropiOrder.history)
        ? dropiOrder.history
        : [];
      const historyMatch = [...history]
        .reverse()
        .find((entry) => getHistoryEstado(entry) === estadoNuevo);
      const registradoEn = historyMatch
        ? getHistoryRegisteredAt(historyMatch)
        : (dropiOrder.updated_at ?? null);
      const novedad = dropiOrder.novedad_servientrega || null;
      const transportadora = dropiOrder.distribution_company?.name || null;
      const latestKnownRegisteredAt =
        getLatestKnownRegisteredAt(supabaseOrder);
      const missingHistory = getMissingHistoryEntries(
        history,
        latestKnownRegisteredAt,
        transportadora,
        novedad,
      );

      try {
        await updateDenormalizedFields(
          supabaseOrder,
          dropiOrder,
          estadoNuevo,
          registradoEn,
          transportadora,
        );
      } catch (error) {
        recordOrderError(
          orderUpdateErrors,
          supabaseOrder,
          "denormalized_fields",
          error,
        );
      }

      if (missingHistory.length > 0) {
        ordersWithMissingHistory += 1;
      }

      if (missingHistory.length > 0) {
        try {
          const historyResult = await processOrderHistory(
            supabaseOrder.id,
            missingHistory,
          );

          for (const error of historyResult.errors) {
            recordOrderError(
              orderUpdateErrors,
              supabaseOrder,
              "process_history",
              error,
            );
          }
        } catch (error) {
          recordOrderError(
            orderUpdateErrors,
            supabaseOrder,
            "process_history",
            error,
          );
        }
      }

      if (
        estadoNuevo !== null &&
        (missingHistory.length > 0 || supabaseOrder.estado_dropi !== estadoNuevo)
      ) {
        try {
          await updateCurrentDropiState(supabaseOrder, estadoNuevo);
        } catch (error) {
          recordOrderError(
            orderUpdateErrors,
            supabaseOrder,
            "current_state",
            error,
          );
        }
      }
    } catch (error) {
      recordOrderError(
        orderUpdateErrors,
        supabaseOrder,
        "reconciliation",
        error,
      );
    }
  }

  return {
    ordersFromDropi: dropiOrders.length,
    ordersMatched: orderMatches.length,
    ordersWithMissingHistory,
    orderUpdateErrors,
  };
}
