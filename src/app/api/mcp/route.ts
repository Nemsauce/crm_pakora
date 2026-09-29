import { createHash, timingSafeEqual } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createRemoteMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function errorResponse(status: number, message: string, headers?: HeadersInit) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message }, id: null },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

async function handleRequest(request: Request) {
  const token = process.env.MCP_BEARER_TOKEN;
  if (!token) return errorResponse(503, "MCP no está configurado.");

  const supplied = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!supplied || !timingSafeEqual(
    createHash("sha256").update(supplied).digest(),
    createHash("sha256").update(token).digest(),
  )) {
    return errorResponse(401, "Bearer token requerido o inválido.", {
      "WWW-Authenticate": 'Bearer realm="pakora-mcp"',
    });
  }

  // Server-to-server clients omit Origin; browsers must use this exact origin.
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    return errorResponse(403, "Origin no permitido.");
  }

  // This stateless endpoint has no persistent SSE stream or session to delete.
  if (request.method !== "POST") {
    return errorResponse(405, "Método no permitido.", { Allow: "POST" });
  }

  let server: ReturnType<typeof createRemoteMcpServer> | undefined;
  try {
    server = createRemoteMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    // JSON mode resolves after the tool finishes; closing here cannot cut off SSE.
    const response = await transport.handleRequest(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    // Do not reflect credentials, Supabase URLs or customer data in HTTP errors.
    return errorResponse(503, "MCP no disponible. Revisa la credencial de solo lectura y la configuración del servidor.");
  } finally {
    await server?.close();
  }
}

export { handleRequest as POST, handleRequest as GET, handleRequest as DELETE,
  handleRequest as PUT, handleRequest as PATCH, handleRequest as OPTIONS,
  handleRequest as HEAD };
