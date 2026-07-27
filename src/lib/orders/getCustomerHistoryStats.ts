import type { Tables } from "@/lib/supabase/database.types";

type CustomerHistoryOrder = Pick<
  Tables<"orders">,
  | "total_pedidos_cliente"
  | "pedidos_entregados_cliente"
  | "pedidos_devueltos_cliente"
>;

export type CustomerHistoryStats = {
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  hasHistory: boolean;
};

export function getCustomerHistoryStats(
  order: CustomerHistoryOrder,
): CustomerHistoryStats {
  const totalOrders = order.total_pedidos_cliente ?? 0;
  const deliveredOrders = order.pedidos_entregados_cliente ?? 0;
  const returnedOrders = order.pedidos_devueltos_cliente ?? 0;

  return {
    totalOrders,
    deliveredOrders,
    returnedOrders,
    hasHistory: totalOrders > 0,
  };
}
