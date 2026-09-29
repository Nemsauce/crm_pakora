import { z } from "zod";
import type { ReadOnlyClient } from "../supabase.js";
import { allRows, country, loadCatalog, resolveCategory, rows, text } from "./shared.js";

export const customerSchema = z.object({ telefono: text, pais: country.optional() });

export async function perfilCliente(db: ReadOnlyClient, input: z.infer<typeof customerSchema>) {
  // Same exact phone/country identity and latest-order ordering as clientes/[telefono]/page.tsx.
  const latestQuery = () => db.select("orders").eq("telefono", input.telefono)
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  const pais = input.pais ?? (await rows(latestQuery().limit(1)))[0]?.pais;
  if (!pais) return { encontrado: false };
  const [orders, catalog] = await Promise.all([
    allRows((offset, size) => latestQuery().eq("pais", pais).range(offset, offset + size - 1)),
    loadCatalog(db),
  ]);
  const latest = orders[0];
  if (!latest) return { encontrado: false, pais };
  const history = orders.map((o) => ({ ...o, categoria: resolveCategory(catalog, o.estado_dropi, o.transportadora) }));
  // Mirror getCustomerHistoryStats, including null vs zero and no clamping of otherOrders.
  const hasHistory = latest.total_pedidos_cliente !== null;
  const totalOrders = latest.total_pedidos_cliente ?? 0;
  const deliveredOrders = hasHistory ? latest.pedidos_entregados_cliente ?? 0 : 0;
  const returnedOrders = hasHistory ? latest.pedidos_devueltos_cliente ?? 0 : 0;
  return {
    encontrado: true, telefono: input.telefono, pais,
    nombre: latest.nombre, apellido: latest.apellido, direccion: latest.direccion,
    nivel_riesgo: ["alto", "medio", "bajo"].includes(latest.nivel_riesgo ?? "") ? latest.nivel_riesgo : "sin_datos",
    red_dropi: {
      fuente: "snapshot del pedido más reciente; toda la red Dropi, no solo Pakora",
      actualizado_en: latest.updated_at,
      total_pedidos_cliente: latest.total_pedidos_cliente,
      pedidos_entregados_cliente: latest.pedidos_entregados_cliente,
      pedidos_devueltos_cliente: latest.pedidos_devueltos_cliente,
      hasHistory, totalOrders, deliveredOrders, returnedOrders,
      otherOrders: totalOrders - deliveredOrders - returnedOrders,
    },
    pakora: {
      total: history.length,
      entregados: history.filter((o) => o.categoria === "entregado").length,
      cancelados: history.filter((o) => o.categoria === "cancelado").length,
      devueltos: history.filter((o) => o.categoria === "devolucion").length,
    },
    pedidos: history,
  };
}
