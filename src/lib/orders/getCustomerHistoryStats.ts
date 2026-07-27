"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Database, Tables } from "@/lib/supabase/database.types";

type CustomerHistoryOrder = Pick<Tables<"orders">, "id" | "telefono">;
type CustomerHistoryOrderRow = Pick<
  Tables<"orders">,
  "estado_dropi" | "transportadora"
>;
type Categoria = Database["public"]["Enums"]["categoria_estado_enum"];

const CUSTOMER_HISTORY_PAGE_SIZE = 1_000;

export type CustomerHistoryStats = {
  totalOrders: number;
  deliveredOrders: number;
  canceledOrders: number;
  returnedOrders: number;
  inProgressOrders: number;
  hasHistory: boolean;
};

type CustomerHistoryStatsState = {
  error: string | null;
  key: string;
  stats: CustomerHistoryStats | null;
};

function getEmptyCustomerHistoryStats(): CustomerHistoryStats {
  return {
    totalOrders: 0,
    deliveredOrders: 0,
    canceledOrders: 0,
    returnedOrders: 0,
    inProgressOrders: 0,
    hasHistory: false,
  };
}

function getStatusKey(estado: string, transportadora: string | null) {
  return `${estado}\u0000${transportadora ?? ""}`;
}

async function getCustomerOrders(
  supabase: SupabaseClient<Database>,
  telefono: string,
) {
  const orders: CustomerHistoryOrderRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("orders")
      .select("estado_dropi,transportadora")
      .eq("telefono", telefono)
      .order("id", { ascending: false })
      .range(from, from + CUSTOMER_HISTORY_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `No se pudo cargar el historial del cliente: ${error.message}`,
      );
    }

    const page = data ?? [];
    orders.push(...page);

    if (page.length < CUSTOMER_HISTORY_PAGE_SIZE) {
      return orders;
    }

    from += CUSTOMER_HISTORY_PAGE_SIZE;
  }
}

export async function getCustomerHistoryStats(
  supabase: SupabaseClient<Database>,
  order: CustomerHistoryOrder,
): Promise<CustomerHistoryStats> {
  const telefono = order.telefono;

  if (!telefono?.trim()) {
    return getEmptyCustomerHistoryStats();
  }

  const orders = await getCustomerOrders(supabase, telefono);
  const dropiStates = Array.from(
    new Set(
      orders
        .map((customerOrder) => customerOrder.estado_dropi)
        .filter((estado): estado is string => Boolean(estado)),
    ),
  );
  const categoryByStatus = new Map<string, Categoria>();

  if (dropiStates.length > 0) {
    const { data: statuses, error: statusesError } = await supabase
      .from("status_catalog")
      .select("estado,transportadora,categoria")
      .in("estado", dropiStates);

    if (statusesError) {
      throw new Error(
        `No se pudo clasificar el historial del cliente: ${statusesError.message}`,
      );
    }

    for (const status of statuses ?? []) {
      categoryByStatus.set(
        getStatusKey(status.estado, status.transportadora),
        status.categoria,
      );
    }
  }

  const { deliveredOrders, canceledOrders, returnedOrders } = orders.reduce(
    (counts, customerOrder) => {
      const estado = customerOrder.estado_dropi;
      const categoria = estado
        ? customerOrder.transportadora
          ? (categoryByStatus.get(
              getStatusKey(estado, customerOrder.transportadora),
            ) ?? categoryByStatus.get(getStatusKey(estado, null)))
          : categoryByStatus.get(getStatusKey(estado, null))
        : "sin_clasificar";

      if (categoria === "entregado") {
        counts.deliveredOrders += 1;
      } else if (categoria === "cancelado") {
        counts.canceledOrders += 1;
      } else if (categoria === "devolucion") {
        counts.returnedOrders += 1;
      }

      return counts;
    },
    { deliveredOrders: 0, canceledOrders: 0, returnedOrders: 0 },
  );
  const totalOrders = orders.length;
  // The remaining categories are all active or unresolved states, including
  // sin_clasificar. Defining this as the residual keeps the buckets exhaustive.
  const inProgressOrders =
    totalOrders - deliveredOrders - canceledOrders - returnedOrders;

  return {
    totalOrders,
    deliveredOrders,
    canceledOrders,
    returnedOrders,
    inProgressOrders,
    hasHistory: totalOrders > 0,
  };
}

export function useCustomerHistoryStats(order: CustomerHistoryOrder) {
  const supabase = useMemo(() => createClient(), []);
  const orderId = order.id;
  const telefono = order.telefono;
  const requestKey = `${orderId}:${telefono ?? ""}`;
  const [state, setState] = useState<CustomerHistoryStatsState>({
    error: null,
    key: "",
    stats: null,
  });

  useEffect(() => {
    let isActive = true;

    async function loadStats() {
      try {
        const stats = await getCustomerHistoryStats(supabase, {
          id: orderId,
          telefono,
        });

        if (isActive) {
          setState({ error: null, key: requestKey, stats });
        }
      } catch {
        if (isActive) {
          setState({
            error: "No se pudo cargar el historial del cliente.",
            key: requestKey,
            stats: null,
          });
        }
      }
    }

    void loadStats();

    return () => {
      isActive = false;
    };
  }, [orderId, requestKey, supabase, telefono]);

  const isCurrentRequest = state.key === requestKey;

  return {
    error: isCurrentRequest ? state.error : null,
    isLoading: !isCurrentRequest,
    stats: isCurrentRequest ? state.stats : null,
  };
}
