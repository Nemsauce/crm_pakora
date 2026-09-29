import "server-only";

// Same restricted credential and HTTP guards as the desktop adapter, without dotenv/stdio.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type { Database };
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type Country = Order["pais"];
export type Category = Database["public"]["Enums"]["categoria_estado_enum"];
const TABLES = ["orders", "status_catalog", "status_history", "tasks"] as const;
const RPCS = ["product_order_summary", "dinero_en_la_calle", "wallet_summary", "wallet_daily_summary"] as const;
type ReadRpc = typeof RPCS[number];

function claims(token: string): Record<string, unknown> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error();
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("Credencial JWT inválida.");
  }
}

/** Local checks are fail-fast guards. Supabase verifies the signature and DB grants. */
export function validateCredentials(url: string, apiKey: string, token: string) {
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
      endpoint.pathname !== "/" || endpoint.search || endpoint.hash) {
    throw new Error("SUPABASE_URL debe ser el origen HTTPS del proyecto.");
  }
  if (!apiKey.startsWith("sb_publishable_") && claims(apiKey).role !== "anon") {
    throw new Error("SUPABASE_ANON_KEY debe ser publishable o anon; no se admiten claves privilegiadas.");
  }
  const payload = claims(token);
  if (payload.role !== "crm_mcp_reader" || typeof payload.exp !== "number" ||
      payload.exp <= Date.now() / 1000) {
    throw new Error("SUPABASE_READ_ONLY_TOKEN requiere rol crm_mcp_reader y expiración futura.");
  }
  return endpoint.origin;
}

/** Defense in depth: even a mistakenly added mutation cannot leave this process. */
export function readOnlyFetch(origin: string, transport: typeof fetch = fetch): typeof fetch {
  const paths = new Set([
    ...TABLES.map((table) => `/rest/v1/${table}`),
    ...RPCS.map((rpc) => `/rest/v1/rpc/${rpc}`),
  ]);
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (!["GET", "HEAD"].includes(request.method) || url.origin !== origin ||
        !paths.has(url.pathname) || url.username || url.password) {
      throw new Error("Solicitud bloqueada: solo SELECT y RPC GET autorizados.");
    }
    const headers = request.headers;
    if (["accept-profile", "content-profile"].some((h) => headers.has(h) && headers.get(h) !== "public")) {
      throw new Error("Solo se permite el schema public.");
    }
    return transport(new Request(request, {
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    }));
  };
}

export function createRemoteReadOnlyClient(env: NodeJS.ProcessEnv = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const token = env.SUPABASE_READ_ONLY_TOKEN ?? "";
  if (!url || !key || !token) throw new Error("Configura NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_READ_ONLY_TOKEN en el servidor.");
  const origin = validateCredentials(url, key, token);
  const client = createClient<Database>(origin, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: readOnlyFetch(origin) },
  });
  // Do not export the raw client, auth, storage, functions, or mutation builders.
  return {
    select<T extends typeof TABLES[number]>(table: T) {
      return client.from(table).select("*");
    },
    rpc<T extends ReadRpc>(name: T, args?: Database["public"]["Functions"][T]["Args"]) {
      return client.rpc(name, args, { get: true });
    },
  };
}

export type ReadOnlyClient = ReturnType<typeof createRemoteReadOnlyClient>;
