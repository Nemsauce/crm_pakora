import { z } from "zod";
import type { Database, ReadOnlyClient } from "../supabase.js";
import { allRows, country, text, toNumber } from "./shared.js";

export const productSchema = z.object({ nombre_producto: text, pais: country });

export async function resumenProducto(db: ReadOnlyClient, input: z.infer<typeof productSchema>) {
  // Preserve RPC grouping, historical confirmation semantics, null rates and denominators verbatim.
  const data = await allRows((offset, size) => db.rpc("product_order_summary")
    .eq("pais", input.pais).eq("nombre_producto", input.nombre_producto)
    .order("pais").order("nombre_producto").range(offset, offset + size - 1));
  return { pais: input.pais, alcance: "histórico completo, sin filtro de fechas", productos: data };
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "Fecha calendario inválida.");
export const financeSchema = z.object({ pais: country, fecha_desde: date, fecha_hasta: date })
  .refine((v) => v.fecha_desde <= v.fecha_hasta, "fecha_desde debe ser anterior o igual a fecha_hasta.");

type WalletRow = Database["public"]["Functions"]["wallet_summary"]["Returns"][number];
export function operationalTotals(data: WalletRow[]) {
  // Exact Finanzas.getCountryTotals: capital excluded, direction case-insensitive, numeric coercion.
  const totals = { entradasOperativas: 0, salidasOperativas: 0, recargas: 0, retiros: 0,
    hasOperationalMovements: false, hasCapitalMovements: false };
  for (const row of data) {
    const total = toNumber(row.total);
    if (row.categoria === "recarga") { totals.recargas += total; totals.hasCapitalMovements = true; continue; }
    if (row.categoria === "retiro") { totals.retiros += total; totals.hasCapitalMovements = true; continue; }
    if (row.tipo?.toUpperCase() === "ENTRADA") { totals.entradasOperativas += total; totals.hasOperationalMovements = true; }
    if (row.tipo?.toUpperCase() === "SALIDA") { totals.salidasOperativas += total; totals.hasOperationalMovements = true; }
  }
  return { ...totals, utilidad_operativa: totals.entradasOperativas - totals.salidasOperativas };
}

export async function resumenFinanciero(db: ReadOnlyClient, input: z.infer<typeof financeSchema>) {
  const args = { p_date_from: input.fecha_desde, p_date_to: input.fecha_hasta };
  const [wallet, daily, street] = await Promise.all([
    allRows((offset, size) => db.rpc("wallet_summary", args).eq("pais", input.pais)
      .order("pais").order("categoria").order("tipo").range(offset, offset + size - 1)),
    allRows((offset, size) => db.rpc("wallet_daily_summary", args).eq("pais", input.pais)
      .order("pais").order("dia").range(offset, offset + size - 1)),
    allRows((offset, size) => db.rpc("dinero_en_la_calle").eq("pais", input.pais)
      .order("pais").order("nombre_producto").range(offset, offset + size - 1)),
  ]);
  const byDate = new Map(daily.map((r) => [r.dia, toNumber(r.neto)]));
  const trend = [];
  for (let day = Date.parse(`${input.fecha_desde}T00:00:00Z`); day <= Date.parse(`${input.fecha_hasta}T00:00:00Z`); day += 86_400_000) {
    const dia = new Date(day).toISOString().slice(0, 10);
    trend.push({ dia, neto: byDate.get(dia) ?? 0 });
  }
  return {
    ...input, moneda: input.pais === "CO" ? "COP" : "MXN", ...operationalTotals(wallet),
    desglose: wallet, tendencia_diaria: trend,
    dinero_en_la_calle: {
      alcance: "snapshot actual; ignora fecha_desde y fecha_hasta",
      total: street.reduce((sum, r) => sum + toNumber(r.dinero_en_la_calle), 0),
      pedidos_por_entregar: street.reduce((sum, r) => sum + toNumber(r.pedidos_por_entregar), 0),
      productos: street,
    },
  };
}
