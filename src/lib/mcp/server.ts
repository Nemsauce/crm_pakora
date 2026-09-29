import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRemoteReadOnlyClient } from "./supabase";
import type { ReadOnlyClient } from "../../../mcp-server/src/supabase";
import { buscarPedido, detallePedido, pedidosPorEstado, searchSchema, detailSchema, stateSchema } from "../../../mcp-server/src/tools/orders";
import { perfilCliente, customerSchema } from "../../../mcp-server/src/tools/customer";
import { resumenProducto, resumenFinanciero, productSchema, financeSchema } from "../../../mcp-server/src/tools/summaries";

// The desktop implementations remain the single source of tool queries and calculations.
export function createRemoteMcpServer() {
  // The two packages can install different Supabase versions with nominal builder
  // types. Both adapters expose exactly the same select/rpc runtime interface.
  const db = createRemoteReadOnlyClient() as unknown as ReadOnlyClient;
  const server = new McpServer({ name: "pakora-crm-read-only", version: "0.1.0" });
  function register<S extends z.AnyZodObject | z.ZodEffects<z.AnyZodObject>>(
    name: string, description: string, schema: S,
    handler: (db: ReadOnlyClient, input: z.infer<S>) => Promise<object>,
  ) {
    // Expose all fields to MCP clients; re-parse full schema for cross-field validation.
    const objectSchema: z.AnyZodObject = "innerType" in schema ? schema.innerType() : schema as z.AnyZodObject;
    server.registerTool(name, {
      description, inputSchema: objectSchema.shape,
      outputSchema: { resultado: z.record(z.unknown()) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (input: Record<string, unknown>) => {
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        return { isError: true, content: [{ type: "text" as const,
          text: parsed.error.issues.map((issue) => issue.message).join("; ") }] };
      }
      try {
        const resultado = await handler(db, parsed.data);
        const output = { resultado: resultado as Record<string, unknown> };
        return { content: [{ type: "text" as const, text: JSON.stringify(output) }], structuredContent: output };
      } catch (error) {
        const message = error instanceof z.ZodError ? error.issues.map((i) => i.message).join("; ")
          : error instanceof Error ? error.message : "No se pudo consultar el CRM.";
        return { isError: true, content: [{ type: "text" as const, text: message }] };
      }
    });
  }
  register("buscar_pedido", "Busca pedidos por numero_orden exacto, teléfono exacto o palabras del nombre/apellido. Filtros combinados con AND; país opcional. Devuelve campos clave y cursor antes_de_id; continúa hasta cursor null/página vacía.", searchSchema, buscarPedido);
  register("detalle_pedido", "Consulta todos los campos, status_history completo, tasks y categoría resuelta de un pedido. Usa exactamente id o numero_orden; si el número es ambiguo, busca primero el id. No modifica tareas.", detailSchema, detallePedido);
  register("pedidos_por_estado", "Lista pedidos de un país por categoría actual del status_catalog. Para pendientes de confirmación usa nuevo. confirmado es categoría actual, no confirmados históricos. Paginación por antes_de_id.", stateSchema, pedidosPorEstado);
  register("resumen_producto", "Resumen histórico por nombre base exacto de producto y país, usando product_order_summary como Métricas. Devuelve conteos, confirmados actuales/alguna vez y porcentajes originales; no admite fechas ni recalcula tasas.", productSchema, resumenProducto);
  register("perfil_cliente", "Historial completo por teléfono exacto y país, métricas Pakora y snapshot de la red Dropi del pedido más reciente. Si omites país, usa el del pedido más reciente, igual que Clientes. No consulta Dropi en vivo.", customerSchema, perfilCliente);
  register("resumen_financiero", "Utilidad operativa por país y fechas inclusivas YYYY-MM-DD con wallet_summary/wallet_daily_summary. Excluye recargas y retiros de utilidad. Dinero en la calle usa su RPC sin rango de fechas. CO en COP, MX en MXN; sin mezclar monedas.", financeSchema, resumenFinanciero);
  return server;
}
