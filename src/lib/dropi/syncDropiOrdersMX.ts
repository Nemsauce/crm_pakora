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
  "id,numero_orden,id_orden_shopify,id_orden_dropi,estado_dropi,tarea_generada_para_estado,status_history(registrado_en)";

type LatestStatusHistory = {
  registrado_en: string | null;
};

type SupabaseActiveOrder = {
  id: number;
  numero_orden: string | null;
  id_orden_shopify: string | null;
  id_orden_dropi: number | null;
  estado_dropi: string | null;
  tarea_generada_para_estado: string | null;
  status_history: LatestStatusHistory[] | LatestStatusHistory | null;
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

export async function syncDropiOrdersMX(
  dropiOrders: DropiOrderMX[],
): Promise<SyncDropiOrdersMXResult> {
  const supabaseOrders = await loadActiveMXOrders();
  const orderUpdateErrors: string[] = [];
  let ordersMatched = 0;
  let ordersWithMissingHistory = 0;

  for (const dropiOrder of dropiOrders) {
    const dropiShopOrderId = normalizeId(dropiOrder.shop_order_id);
    const dropiId = normalizeId(dropiOrder.id);
    const supabaseOrder = supabaseOrders.find(
      (candidate) =>
        (dropiShopOrderId &&
          normalizeId(candidate.id_orden_shopify) === dropiShopOrderId) ||
        (dropiId && normalizeId(candidate.id_orden_dropi) === dropiId),
    );

    if (!supabaseOrder) {
      continue;
    }

    ordersMatched += 1;

    try {
      const estadoNuevo = dropiOrder.status ?? null;
      const yaProcesado =
        supabaseOrder.tarea_generada_para_estado === estadoNuevo;
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
      const debeActualizarEstado = !(
        supabaseOrder.estado_dropi === estadoNuevo && yaProcesado
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

      if (!debeActualizarEstado && missingHistory.length === 0) {
        continue;
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
    ordersMatched,
    ordersWithMissingHistory,
    orderUpdateErrors,
  };
}
