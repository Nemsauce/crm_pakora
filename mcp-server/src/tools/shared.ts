import { z } from "zod";
import type { Category, Order, ReadOnlyClient } from "../supabase.js";

export const country = z.enum(["CO", "MX"]);
export const text = z.string().trim().min(1).max(200);
export const positiveId = z.number().int().positive().safe();
export const paging = { limite: z.number().int().min(1).max(100).default(25), antes_de_id: positiveId.optional() };
export const category = z.enum([
  "nuevo", "confirmado", "guia_generada", "en_ruta", "en_reparto", "recoger_oficina",
  "intento_fallido", "novedad", "proximo_a_llegar", "entregado", "cancelado", "devolucion", "sin_clasificar",
]);

export async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { code?: string } | null }>): Promise<T[]> {
  const result = await query;
  if (result.error) {
    // Avoid reflecting URLs, tokens or customer values from remote errors into MCP logs.
    throw new Error(`Consulta Supabase falló (${result.error.code ?? "sin código"}). Revisa permisos, JWT, RPC y conectividad.`);
  }
  return result.data ?? [];
}

/** Continue until empty, even when the server caps pages below the requested size. */
export async function allRows<T>(page: (offset: number, size: number) => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>) {
  const result: T[] = [];
  for (;;) {
    const batch = await rows(page(result.length, 500));
    if (!batch.length) return result;
    result.push(...batch);
  }
}

export async function loadCatalog(db: ReadOnlyClient) {
  const catalog = new Map<string, Map<string | null, Category>>();
  const data = await allRows((offset, size) => db.select("status_catalog").order("id").range(offset, offset + size - 1));
  for (const entry of data) {
    const carriers = catalog.get(entry.estado) ?? new Map();
    if (!carriers.has(entry.transportadora)) carriers.set(entry.transportadora, entry.categoria);
    catalog.set(entry.estado, carriers);
  }
  return catalog;
}

// processOrderEvent.lookupCategory / getCampaignRealResults: exact carrier then generic.
export function resolveCategory(catalog: Awaited<ReturnType<typeof loadCatalog>>, state: string | null, carrier: string | null): Category {
  const carriers = state ? catalog.get(state) : undefined;
  return (carrier ? carriers?.get(carrier) : undefined) ?? carriers?.get(null) ?? "sin_clasificar";
}

export function keyFields(order: Order, categoria: Category) {
  const { id, numero_orden, pais, nombre, apellido, telefono, fecha, nombre_producto,
    estado_dropi, estado_crm, transportadora, guia_envio, total, monto_a_ganar, nivel_riesgo } = order;
  return { id, numero_orden, pais, moneda: pais === "CO" ? "COP" : "MXN", nombre, apellido,
    telefono, fecha, nombre_producto, estado_dropi, estado_crm, transportadora,
    guia_envio, total, monto_a_ganar, nivel_riesgo, categoria };
}

export function literalPattern(value: string) {
  // Quote OR operands separately at the call site; never splice unquoted input into PostgREST grammar.
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

export function toNumber(value: number | string | null) {
  const n = value === null ? 0 : Number(value);
  return Number.isFinite(n) ? n : 0;
}
