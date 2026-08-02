import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type CustomerDirectoryCountry =
  Database["public"]["Enums"]["pais_enum"];

export type CustomerDirectoryRow = {
  pais: CustomerDirectoryCountry;
  telefono: string;
  nombre: string | null;
  apellido: string | null;
  ultimo_pedido_fecha: string | null;
  pedidos_pakora: number;
  nivel_riesgo: string | null;
  total_pedidos_cliente: number | null;
  pedidos_entregados_cliente: number | null;
  pedidos_devueltos_cliente: number | null;
};

export type CustomerDirectoryResult = {
  customers: CustomerDirectoryRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type GetCustomerDirectoryInput = {
  query?: string | null;
  country?: CustomerDirectoryCountry | null;
  page?: number;
  pageSize?: number;
};

type CustomerDirectoryRpcArgs = {
  p_query: string | null;
  p_pais: CustomerDirectoryCountry | null;
  p_limit: number;
  p_offset: number;
};

type CustomerDirectoryRpcClient = {
  rpc: (
    functionName: "customer_directory_v1",
    args: CustomerDirectoryRpcArgs,
  ) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

type ParsedRpcRow = CustomerDirectoryRow & {
  total_count: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;
const MAX_QUERY_LENGTH = 200;

export class CustomerDirectoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerDirectoryError";
  }
}

function normalizePage(value: number | undefined) {
  if (value === undefined) {
    return DEFAULT_PAGE;
  }

  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CustomerDirectoryError(
      "La página del directorio debe ser un entero mayor o igual a 1.",
    );
  }

  return value;
}

function normalizePageSize(value: number | undefined) {
  if (value === undefined) {
    return DEFAULT_PAGE_SIZE;
  }

  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PAGE_SIZE) {
    throw new CustomerDirectoryError(
      `El tamaño de página debe ser un entero entre 1 y ${MAX_PAGE_SIZE}.`,
    );
  }

  return value;
}

function normalizeQuery(value: string | null | undefined) {
  const query = value?.trim() ?? "";

  if (!query) {
    return null;
  }

  if (query.length > MAX_QUERY_LENGTH) {
    throw new CustomerDirectoryError(
      `La búsqueda no puede superar ${MAX_QUERY_LENGTH} caracteres.`,
    );
  }

  return query.replace(/[\\%_]/g, "\\$&");
}

function normalizeCountry(
  value: CustomerDirectoryCountry | null | undefined,
): CustomerDirectoryCountry | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (value !== "CO" && value !== "MX") {
    throw new CustomerDirectoryError(
      "El país del directorio debe ser CO o MX.",
    );
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNullableString(
  value: unknown,
  fieldName: string,
  rowIndex: number,
) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throwInvalidRow(fieldName, rowIndex);
  }

  return value;
}

function parseNonNegativeInteger(
  value: unknown,
  fieldName: string,
  rowIndex: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throwInvalidRow(fieldName, rowIndex);
  }

  return value;
}

function parseNullableNonNegativeInteger(
  value: unknown,
  fieldName: string,
  rowIndex: number,
) {
  return value === null
    ? null
    : parseNonNegativeInteger(value, fieldName, rowIndex);
}

function throwInvalidRow(fieldName: string, rowIndex: number): never {
  throw new CustomerDirectoryError(
    `El RPC customer_directory_v1 devolvió un valor inválido en ${fieldName} (fila ${rowIndex + 1}).`,
  );
}

function parseRpcRow(value: unknown, rowIndex: number): ParsedRpcRow {
  if (!isRecord(value)) {
    throw new CustomerDirectoryError(
      `El RPC customer_directory_v1 devolvió una fila inválida en la posición ${rowIndex + 1}.`,
    );
  }

  if (value.pais !== "CO" && value.pais !== "MX") {
    throwInvalidRow("pais", rowIndex);
  }

  if (typeof value.telefono !== "string" || value.telefono.length === 0) {
    throwInvalidRow("telefono", rowIndex);
  }

  return {
    pais: value.pais,
    telefono: value.telefono,
    nombre: parseNullableString(value.nombre, "nombre", rowIndex),
    apellido: parseNullableString(value.apellido, "apellido", rowIndex),
    ultimo_pedido_fecha: parseNullableString(
      value.ultimo_pedido_fecha,
      "ultimo_pedido_fecha",
      rowIndex,
    ),
    pedidos_pakora: parseNonNegativeInteger(
      value.pedidos_pakora,
      "pedidos_pakora",
      rowIndex,
    ),
    nivel_riesgo: parseNullableString(
      value.nivel_riesgo,
      "nivel_riesgo",
      rowIndex,
    ),
    total_pedidos_cliente: parseNullableNonNegativeInteger(
      value.total_pedidos_cliente,
      "total_pedidos_cliente",
      rowIndex,
    ),
    pedidos_entregados_cliente: parseNullableNonNegativeInteger(
      value.pedidos_entregados_cliente,
      "pedidos_entregados_cliente",
      rowIndex,
    ),
    pedidos_devueltos_cliente: parseNullableNonNegativeInteger(
      value.pedidos_devueltos_cliente,
      "pedidos_devueltos_cliente",
      rowIndex,
    ),
    total_count: parseNonNegativeInteger(
      value.total_count,
      "total_count",
      rowIndex,
    ),
  };
}

async function runDirectoryRpc(
  client: CustomerDirectoryRpcClient,
  args: CustomerDirectoryRpcArgs,
) {
  const { data, error } = await client.rpc("customer_directory_v1", args);

  if (error) {
    throw new CustomerDirectoryError(
      `No se pudo cargar el directorio de clientes: ${error.message}`,
    );
  }

  if (!Array.isArray(data)) {
    throw new CustomerDirectoryError(
      "El RPC customer_directory_v1 devolvió una respuesta inesperada.",
    );
  }

  const rows = data.map(parseRpcRow);
  const totalCounts = new Set(rows.map((row) => row.total_count));

  if (totalCounts.size > 1) {
    throw new CustomerDirectoryError(
      "El RPC customer_directory_v1 devolvió conteos totales inconsistentes.",
    );
  }

  return rows;
}

function toCustomers(rows: ParsedRpcRow[]): CustomerDirectoryRow[] {
  return rows.map((row) => ({
    pais: row.pais,
    telefono: row.telefono,
    nombre: row.nombre,
    apellido: row.apellido,
    ultimo_pedido_fecha: row.ultimo_pedido_fecha,
    pedidos_pakora: row.pedidos_pakora,
    nivel_riesgo: row.nivel_riesgo,
    total_pedidos_cliente: row.total_pedidos_cliente,
    pedidos_entregados_cliente: row.pedidos_entregados_cliente,
    pedidos_devueltos_cliente: row.pedidos_devueltos_cliente,
  }));
}

export async function getCustomerDirectory({
  query,
  country,
  page: requestedPage,
  pageSize: requestedPageSize,
}: GetCustomerDirectoryInput = {}): Promise<CustomerDirectoryResult> {
  const page = normalizePage(requestedPage);
  const pageSize = normalizePageSize(requestedPageSize);
  const normalizedQuery = normalizeQuery(query);
  const normalizedCountry = normalizeCountry(country);
  const offset = (page - 1) * pageSize;

  if (!Number.isSafeInteger(offset)) {
    throw new CustomerDirectoryError(
      "La página solicitada excede el rango permitido.",
    );
  }

  const supabase = await createClient();
  const client = supabase as unknown as CustomerDirectoryRpcClient;
  const baseArgs = {
    p_query: normalizedQuery,
    p_pais: normalizedCountry,
  };
  const rows = await runDirectoryRpc(client, {
    ...baseArgs,
    p_limit: pageSize,
    p_offset: offset,
  });

  if (rows.length > 0) {
    const totalCount = rows[0].total_count;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return {
      customers: toCustomers(rows),
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }

  if (page === 1) {
    return {
      customers: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 1,
    };
  }

  const probeRows = await runDirectoryRpc(client, {
    ...baseArgs,
    p_limit: 1,
    p_offset: 0,
  });

  if (probeRows.length === 0) {
    return {
      customers: [],
      totalCount: 0,
      page: 1,
      pageSize,
      totalPages: 1,
    };
  }

  const totalCount = probeRows[0].total_count;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const lastPageRows = await runDirectoryRpc(client, {
    ...baseArgs,
    p_limit: pageSize,
    p_offset: (totalPages - 1) * pageSize,
  });

  if (lastPageRows.length === 0) {
    throw new CustomerDirectoryError(
      "El directorio cambió mientras se ajustaba la paginación. Intenta recargar la página.",
    );
  }

  return {
    customers: toCustomers(lastPageRows),
    totalCount,
    page: totalPages,
    pageSize,
    totalPages,
  };
}
