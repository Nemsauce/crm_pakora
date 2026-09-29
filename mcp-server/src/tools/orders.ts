import { z } from "zod";
import type { ReadOnlyClient } from "../supabase.js";
import { allRows, category, country, keyFields, literalPattern, loadCatalog, paging, positiveId, resolveCategory, rows, text } from "./shared.js";

export const searchSchema = z.object({
  numero_orden: text.optional(), telefono: text.optional(), nombre: text.optional(),
  pais: country.optional(), ...paging,
}).refine((v) => v.numero_orden || v.telefono || v.nombre, "Indica numero_orden, telefono o nombre.");

export async function buscarPedido(db: ReadOnlyClient, input: z.infer<typeof searchSchema>) {
  let query = db.select("orders").order("id", { ascending: false });
  if (input.pais) query = query.eq("pais", input.pais);
  if (input.antes_de_id) query = query.lt("id", input.antes_de_id);
  if (input.numero_orden) query = query.eq("numero_orden", input.numero_orden);
  if (input.telefono) query = query.eq("telefono", input.telefono);
  if (input.nombre) {
    for (const token of input.nombre.split(/\s+/)) {
      const pattern = JSON.stringify(literalPattern(token));
      query = query.or(`nombre.ilike.${pattern},apellido.ilike.${pattern}`);
    }
  }
  const [orders, catalog] = await Promise.all([rows(query.limit(input.limite)), loadCatalog(db)]);
  return {
    pedidos: orders.map((o) => keyFields(o, resolveCategory(catalog, o.estado_dropi, o.transportadora))),
    // A final cursor may yield an empty page; this avoids silently truncating at the API's row cap.
    siguiente_antes_de_id: orders.at(-1)?.id ?? null,
  };
}

export const detailSchema = z.object({ id: positiveId.optional(), numero_orden: text.optional(), pais: country.optional() })
  .refine((v) => (v.id !== undefined) !== (v.numero_orden !== undefined), "Indica id o numero_orden, exactamente uno.");

export async function detallePedido(db: ReadOnlyClient, input: z.infer<typeof detailSchema>) {
  let query = db.select("orders");
  if (input.id !== undefined) query = query.eq("id", input.id);
  else query = query.eq("numero_orden", input.numero_orden!);
  if (input.pais) query = query.eq("pais", input.pais);
  // Read through API caps before deciding whether a number is ambiguous across countries.
  const matches = await allRows((offset, size) => query.order("id").range(offset, offset + size - 1));
  if (!matches.length) return { encontrado: false };
  if (matches.length > 1) throw new Error("Número de orden ambiguo. Usa el id obtenido con buscar_pedido.");
  const order = matches[0];
  const [history, tasks, catalog] = await Promise.all([
    allRows((offset, size) => db.select("status_history").eq("order_id", order.id)
      .order("registrado_en").order("created_at").order("id").range(offset, offset + size - 1)),
    allRows((offset, size) => db.select("tasks").eq("order_id", order.id)
      .order("created_at").order("id").range(offset, offset + size - 1)),
    loadCatalog(db),
  ]);
  return {
    encontrado: true, pedido: order,
    categoria: resolveCategory(catalog, order.estado_dropi, order.transportadora),
    status_history: history.map((h) => ({ ...h, categoria_resuelta: resolveCategory(catalog, h.estado, h.transportadora) })),
    tasks,
  };
}

export const stateSchema = z.object({ categoria: category, pais: country, ...paging });

export async function pedidosPorEstado(db: ReadOnlyClient, input: z.infer<typeof stateSchema>) {
  const catalog = await loadCatalog(db);
  const matches = [];
  let cursor = input.antes_de_id;
  // Filter after resolving carrier precedence; filtering raw status strings would misclassify orders.
  for (;;) {
    let query = db.select("orders").eq("pais", input.pais).order("id", { ascending: false }).limit(500);
    if (cursor !== undefined) query = query.lt("id", cursor);
    const batch = await rows(query);
    if (!batch.length) return { pedidos: matches, siguiente_antes_de_id: null };
    for (const order of batch) {
      const resolved = resolveCategory(catalog, order.estado_dropi, order.transportadora);
      if (resolved === input.categoria) {
        matches.push(keyFields(order, resolved));
        if (matches.length === input.limite) return { pedidos: matches, siguiente_antes_de_id: order.id };
      }
    }
    cursor = batch[batch.length - 1].id;
  }
}
