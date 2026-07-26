import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

type Pais = "CO" | "MX";

type SheetConfig = {
  pais: Pais;
  sheetId: string;
  gid: string;
};

type GranularAddress = {
  numeroOrden: string;
  colonia?: string;
  numeroInterior?: string;
};

type ExistingOrder = {
  id: number;
  numero_orden: string | null;
  colonia: string | null;
  numero_interior: string | null;
};

type PendingUpdate = {
  order: ExistingOrder;
  patch: {
    colonia?: string;
    numero_interior?: string;
  };
};

export type DireccionGranularCountrySyncResult = {
  pais: Pais;
  status: "synchronized" | "noop_no_granular_columns";
  sourceRows: number;
  candidateRows: number;
  matchedOrders: number;
  updatedOrders: number;
  updatedColonia: number;
  updatedNumeroInterior: number;
  unchangedOrders: number;
  unmatchedOrderNumbers: number;
  skippedWithoutOrderNumber: number;
  skippedWithoutGranularAddress: number;
  duplicateRows: number;
};

export type DireccionGranularSyncResult = {
  synchronizedAt: string;
  totalUpdatedOrders: number;
  countries: DireccionGranularCountrySyncResult[];
};

const SHEETS: SheetConfig[] = [
  {
    pais: "MX",
    sheetId: "1pKW3AIjgMugB0Izv5l_FYFQMUV3GiraSwjTTUsQUFnY",
    gid: "0",
  },
  {
    pais: "CO",
    sheetId: "1FyHRh9ClLdjpjc9QlRLDEKwtJcm0BJf2uOZeTdrWHAU",
    gid: "0",
  },
];

const ORDER_NUMBER_HEADER = "Order #";
const COLONIA_HEADER = "Colonia";
const NUMERO_INTERIOR_HEADER = "Número Interior";
const MAX_CSV_SIZE = 10_000_000;
const SELECT_BATCH_SIZE = 100;
const UPDATE_BATCH_SIZE = 25;

function getOrdersClient() {
  // These order columns were migrated after the generated database types.
  // Keep the temporary untyped access contained in this server-only module.
  return createAdminClient() as unknown as SupabaseClient;
}

function cleanCell(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized && normalized !== "-" ? normalized : null;
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (inQuotes) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }

      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      field = "";

      if (row.some((value) => value.trim())) {
        rows.push(row);
      }

      row = [];

      if (character === "\r" && csv[index + 1] === "\n") {
        index += 1;
      }
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new Error("Google Sheets CSV contains an unterminated quoted field");
  }

  row.push(field);

  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  if (rows[0]?.[0]) {
    rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
  }

  return rows;
}

function getHeaderIndex(headers: string[], expectedHeader: string) {
  return headers.findIndex((header) => header.trim() === expectedHeader);
}

async function fetchSheet(config: SheetConfig) {
  const url = `https://docs.google.com/spreadsheets/d/${config.sheetId}/export?format=csv&gid=${config.gid}`;
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${config.pais} pedidos sheet: HTTP ${response.status}`,
    );
  }

  const csv = await response.text();

  if (csv.length > MAX_CSV_SIZE) {
    throw new Error(`${config.pais} pedidos sheet exceeds the CSV size limit`);
  }

  const [headers, ...sourceRows] = parseCsv(csv);

  if (!headers) {
    throw new Error(`${config.pais} pedidos sheet is empty`);
  }

  const orderNumberIndex = getHeaderIndex(headers, ORDER_NUMBER_HEADER);

  if (orderNumberIndex < 0) {
    throw new Error(
      `${config.pais} pedidos sheet is missing the ${ORDER_NUMBER_HEADER} column`,
    );
  }

  return { headers, orderNumberIndex, sourceRows };
}

function emptyCountryResult(
  pais: Pais,
  sourceRows: number,
): DireccionGranularCountrySyncResult {
  return {
    pais,
    status: "noop_no_granular_columns",
    sourceRows,
    candidateRows: 0,
    matchedOrders: 0,
    updatedOrders: 0,
    updatedColonia: 0,
    updatedNumeroInterior: 0,
    unchangedOrders: 0,
    unmatchedOrderNumbers: 0,
    skippedWithoutOrderNumber: 0,
    skippedWithoutGranularAddress: sourceRows,
    duplicateRows: 0,
  };
}

function mapMxRows(
  headers: string[],
  sourceRows: string[][],
  orderNumberIndex: number,
) {
  const coloniaIndex = getHeaderIndex(headers, COLONIA_HEADER);
  const numeroInteriorIndex = getHeaderIndex(headers, NUMERO_INTERIOR_HEADER);

  if (coloniaIndex < 0 || numeroInteriorIndex < 0) {
    throw new Error(
      `MX pedidos sheet is missing ${COLONIA_HEADER} or ${NUMERO_INTERIOR_HEADER}`,
    );
  }

  const addresses = new Map<string, GranularAddress>();
  let skippedWithoutOrderNumber = 0;
  let skippedWithoutGranularAddress = 0;
  let duplicateRows = 0;

  for (const row of sourceRows) {
    const numeroOrden = cleanCell(row[orderNumberIndex]);

    if (!numeroOrden) {
      skippedWithoutOrderNumber += 1;
      continue;
    }

    const colonia = cleanCell(row[coloniaIndex]);
    const numeroInterior = cleanCell(row[numeroInteriorIndex]);

    if (!colonia && !numeroInterior) {
      skippedWithoutGranularAddress += 1;
      continue;
    }

    const existing = addresses.get(numeroOrden);

    if (existing) {
      duplicateRows += 1;
    }

    addresses.set(numeroOrden, {
      numeroOrden,
      colonia: colonia ?? existing?.colonia,
      numeroInterior: numeroInterior ?? existing?.numeroInterior,
    });
  }

  return {
    addresses,
    skippedWithoutOrderNumber,
    skippedWithoutGranularAddress,
    duplicateRows,
  };
}

async function findExistingOrders(orderNumbers: string[]) {
  const supabase = getOrdersClient();
  const orders: ExistingOrder[] = [];

  for (let offset = 0; offset < orderNumbers.length; offset += SELECT_BATCH_SIZE) {
    const batch = orderNumbers.slice(offset, offset + SELECT_BATCH_SIZE);
    const { data, error } = await supabase
      .from("orders")
      .select("id,numero_orden,colonia,numero_interior")
      .eq("pais", "MX")
      .in("numero_orden", batch);

    if (error) {
      throw new Error(`Failed to find MX orders: ${error.message}`);
    }

    orders.push(...((data ?? []) as ExistingOrder[]));
  }

  return orders;
}

function getPendingUpdates(
  orders: ExistingOrder[],
  addresses: Map<string, GranularAddress>,
) {
  const updates: PendingUpdate[] = [];
  let unchangedOrders = 0;

  for (const order of orders) {
    if (!order.numero_orden) {
      continue;
    }

    const address = addresses.get(order.numero_orden);

    if (!address) {
      continue;
    }

    const patch: PendingUpdate["patch"] = {};

    if (address.colonia && cleanCell(order.colonia) !== address.colonia) {
      patch.colonia = address.colonia;
    }

    if (
      address.numeroInterior &&
      cleanCell(order.numero_interior) !== address.numeroInterior
    ) {
      patch.numero_interior = address.numeroInterior;
    }

    if (Object.keys(patch).length === 0) {
      unchangedOrders += 1;
    } else {
      updates.push({ order, patch });
    }
  }

  return { updates, unchangedOrders };
}

async function updateOrders(updates: PendingUpdate[]) {
  const supabase = getOrdersClient();
  let updatedOrders = 0;
  let updatedColonia = 0;
  let updatedNumeroInterior = 0;

  for (let offset = 0; offset < updates.length; offset += UPDATE_BATCH_SIZE) {
    const batch = updates.slice(offset, offset + UPDATE_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async ({ order, patch }) => {
        const { data, error } = await supabase
          .from("orders")
          .update(patch)
          .eq("id", order.id)
          .eq("pais", "MX")
          .eq("numero_orden", order.numero_orden)
          .select("id");

        if (error) {
          throw new Error(
            `Failed to update MX order ${order.numero_orden}: ${error.message}`,
          );
        }

        return {
          updatedRows: data?.length ?? 0,
          updatedColonia: Boolean(patch.colonia),
          updatedNumeroInterior: Boolean(patch.numero_interior),
        };
      }),
    );

    for (const result of results) {
      updatedOrders += result.updatedRows;

      if (result.updatedColonia) {
        updatedColonia += result.updatedRows;
      }

      if (result.updatedNumeroInterior) {
        updatedNumeroInterior += result.updatedRows;
      }
    }
  }

  return { updatedOrders, updatedColonia, updatedNumeroInterior };
}

async function syncCountry(
  config: SheetConfig,
): Promise<DireccionGranularCountrySyncResult> {
  const { headers, orderNumberIndex, sourceRows } = await fetchSheet(config);

  if (config.pais === "CO") {
    return emptyCountryResult(config.pais, sourceRows.length);
  }

  const {
    addresses,
    skippedWithoutOrderNumber,
    skippedWithoutGranularAddress,
    duplicateRows,
  } = mapMxRows(headers, sourceRows, orderNumberIndex);
  const orders = await findExistingOrders([...addresses.keys()]);
  const matchedOrderNumbers = new Set(
    orders
      .map((order) => order.numero_orden)
      .filter((numeroOrden): numeroOrden is string => Boolean(numeroOrden)),
  );
  const { updates, unchangedOrders } = getPendingUpdates(orders, addresses);
  const updateResult = await updateOrders(updates);

  return {
    pais: config.pais,
    status: "synchronized",
    sourceRows: sourceRows.length,
    candidateRows: addresses.size,
    matchedOrders: orders.length,
    ...updateResult,
    unchangedOrders,
    unmatchedOrderNumbers: [...addresses.keys()].filter(
      (numeroOrden) => !matchedOrderNumbers.has(numeroOrden),
    ).length,
    skippedWithoutOrderNumber,
    skippedWithoutGranularAddress,
    duplicateRows,
  };
}

export async function syncDireccionGranularReleasit(): Promise<DireccionGranularSyncResult> {
  const synchronizedAt = new Date().toISOString();
  const countries: DireccionGranularCountrySyncResult[] = [];

  for (const config of SHEETS) {
    countries.push(await syncCountry(config));
  }

  return {
    synchronizedAt,
    totalUpdatedOrders: countries.reduce(
      (total, country) => total + country.updatedOrders,
      0,
    ),
    countries,
  };
}
