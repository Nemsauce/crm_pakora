import "server-only";

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
  departamento?: string;
  puntoReferencia?: string;
};

type ExistingOrder = {
  id: number;
  numero_orden: string | null;
  colonia: string | null;
  numero_interior: string | null;
  departamento: string | null;
  punto_referencia: string | null;
};

type MatchedOrder = ExistingOrder & {
  numero_orden: string;
};

type PendingUpdate = {
  order: MatchedOrder;
  patch: {
    colonia?: string;
    numero_interior?: string;
    departamento?: string;
    punto_referencia?: string;
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
  updatedDepartamento: number;
  updatedPuntoReferencia: number;
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
const PUNTO_REFERENCIA_HEADER = "Punto de Referencia";
const PROVINCE_HEADER = "Province";
const ALL_DETAILS_HEADER = "All Details";
const MX_STATE_NAMES = new Set([
  "AGUASCALIENTES",
  "BAJA CALIFORNIA",
  "BAJA CALIFORNIA SUR",
  "CAMPECHE",
  "CHIAPAS",
  "CHIHUAHUA",
  "CIUDAD DE MEXICO",
  "COAHUILA",
  "COAHUILA DE ZARAGOZA",
  "COLIMA",
  "DURANGO",
  "ESTADO DE MEXICO",
  "GUANAJUATO",
  "GUERRERO",
  "HIDALGO",
  "JALISCO",
  "MEX",
  "MICHOACAN",
  "MICHOACAN DE OCAMPO",
  "MORELOS",
  "NAYARIT",
  "NUEVO LEON",
  "OAXACA",
  "PUEBLA",
  "QUERETARO",
  "QUINTANA ROO",
  "SAN LUIS POTOSI",
  "SINALOA",
  "SON",
  "SONORA",
  "TABASCO",
  "TAMAULIPAS",
  "TAMPS",
  "TLAXCALA",
  "VERACRUZ",
  "VERACRUZ DE IGNACIO DE LA LLAVE",
  "YUCATAN",
  "ZACATECAS",
]);
const MAX_CSV_SIZE = 10_000_000;
const SELECT_BATCH_SIZE = 100;
const UPDATE_BATCH_SIZE = 25;

function getOrdersClient() {
  return createAdminClient();
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

function getOptionalCell(row: string[], index: number) {
  return index >= 0 ? cleanCell(row[index]) : null;
}

function getValidMxState(value: string | null | undefined) {
  const state = cleanCell(value);

  if (!state) {
    return null;
  }

  const normalizedState = state
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  return MX_STATE_NAMES.has(normalizedState) ? state : null;
}

function getMxDepartamento(
  allDetails: string | null,
  province: string | null,
) {
  // The MX export currently misaligns Province with other address fields.
  // All Details keeps the canonical Estado value for the same Releasit row.
  const estado = allDetails?.match(
    /(?:^|\r?\n)\s*Estado\s*:\s*([^\r\n]+)/i,
  )?.[1];

  return getValidMxState(estado) ?? getValidMxState(province);
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
    updatedDepartamento: 0,
    updatedPuntoReferencia: 0,
    unchangedOrders: 0,
    unmatchedOrderNumbers: 0,
    skippedWithoutOrderNumber: 0,
    skippedWithoutGranularAddress: sourceRows,
    duplicateRows: 0,
  };
}

function mapRows(
  config: SheetConfig,
  headers: string[],
  sourceRows: string[][],
  orderNumberIndex: number,
) {
  const coloniaIndex = getHeaderIndex(headers, COLONIA_HEADER);
  const numeroInteriorIndex = getHeaderIndex(headers, NUMERO_INTERIOR_HEADER);
  const puntoReferenciaIndex = getHeaderIndex(
    headers,
    PUNTO_REFERENCIA_HEADER,
  );
  const provinceIndex = getHeaderIndex(headers, PROVINCE_HEADER);
  const allDetailsIndex = getHeaderIndex(headers, ALL_DETAILS_HEADER);
  const missingMxHeaders = [
    { header: COLONIA_HEADER, index: coloniaIndex },
    { header: NUMERO_INTERIOR_HEADER, index: numeroInteriorIndex },
    { header: PUNTO_REFERENCIA_HEADER, index: puntoReferenciaIndex },
    { header: PROVINCE_HEADER, index: provinceIndex },
  ]
    .filter(({ index }) => index < 0)
    .map(({ header }) => header);

  if (config.pais === "MX" && missingMxHeaders.length > 0) {
    throw new Error(
      `MX pedidos sheet is missing address columns: ${missingMxHeaders.join(", ")}`,
    );
  }

  const hasAddressColumns = [
    coloniaIndex,
    numeroInteriorIndex,
    puntoReferenciaIndex,
    provinceIndex,
  ].some((index) => index >= 0);

  if (!hasAddressColumns) {
    return null;
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

    const colonia = getOptionalCell(row, coloniaIndex);
    const numeroInterior = getOptionalCell(row, numeroInteriorIndex);
    const puntoReferencia = getOptionalCell(row, puntoReferenciaIndex);
    const province = getOptionalCell(row, provinceIndex);
    const departamento =
      config.pais === "MX"
        ? getMxDepartamento(getOptionalCell(row, allDetailsIndex), province)
        : province;

    if (!colonia && !numeroInterior && !departamento && !puntoReferencia) {
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
      departamento: departamento ?? existing?.departamento,
      puntoReferencia: puntoReferencia ?? existing?.puntoReferencia,
    });
  }

  return {
    addresses,
    skippedWithoutOrderNumber,
    skippedWithoutGranularAddress,
    duplicateRows,
  };
}

async function findExistingOrders(pais: Pais, orderNumbers: string[]) {
  const supabase = getOrdersClient();
  const orders: ExistingOrder[] = [];

  for (let offset = 0; offset < orderNumbers.length; offset += SELECT_BATCH_SIZE) {
    const batch = orderNumbers.slice(offset, offset + SELECT_BATCH_SIZE);
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id,numero_orden,colonia,numero_interior,departamento,punto_referencia",
      )
      .eq("pais", pais)
      .in("numero_orden", batch);

    if (error) {
      throw new Error(`Failed to find ${pais} orders: ${error.message}`);
    }

    orders.push(...(data ?? []));
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

    const matchedOrder: MatchedOrder = {
      ...order,
      numero_orden: order.numero_orden,
    };
    const address = addresses.get(matchedOrder.numero_orden);

    if (!address) {
      continue;
    }

    const patch: PendingUpdate["patch"] = {};

    if (
      address.colonia &&
      cleanCell(matchedOrder.colonia) !== address.colonia
    ) {
      patch.colonia = address.colonia;
    }

    if (
      address.numeroInterior &&
      cleanCell(matchedOrder.numero_interior) !== address.numeroInterior
    ) {
      patch.numero_interior = address.numeroInterior;
    }

    if (address.departamento && !cleanCell(matchedOrder.departamento)) {
      patch.departamento = address.departamento;
    }

    if (
      address.puntoReferencia &&
      cleanCell(matchedOrder.punto_referencia) !== address.puntoReferencia
    ) {
      patch.punto_referencia = address.puntoReferencia;
    }

    if (Object.keys(patch).length === 0) {
      unchangedOrders += 1;
    } else {
      updates.push({ order: matchedOrder, patch });
    }
  }

  return { updates, unchangedOrders };
}

async function updateOrders(pais: Pais, updates: PendingUpdate[]) {
  const supabase = getOrdersClient();
  let updatedOrders = 0;
  let updatedColonia = 0;
  let updatedNumeroInterior = 0;
  let updatedDepartamento = 0;
  let updatedPuntoReferencia = 0;

  for (let offset = 0; offset < updates.length; offset += UPDATE_BATCH_SIZE) {
    const batch = updates.slice(offset, offset + UPDATE_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async ({ order, patch }) => {
        let updateQuery = supabase
          .from("orders")
          .update(patch)
          .eq("id", order.id)
          .eq("pais", pais)
          .eq("numero_orden", order.numero_orden);

        if (patch.departamento) {
          updateQuery =
            order.departamento === null
              ? updateQuery.is("departamento", null)
              : updateQuery.eq("departamento", order.departamento);
        }

        const { data, error } = await updateQuery.select("id");

        if (error) {
          throw new Error(
            `Failed to update ${pais} order ${order.numero_orden}: ${error.message}`,
          );
        }

        return {
          updatedRows: data?.length ?? 0,
          updatedColonia: Boolean(patch.colonia),
          updatedNumeroInterior: Boolean(patch.numero_interior),
          updatedDepartamento: Boolean(patch.departamento),
          updatedPuntoReferencia: Boolean(patch.punto_referencia),
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

      if (result.updatedDepartamento) {
        updatedDepartamento += result.updatedRows;
      }

      if (result.updatedPuntoReferencia) {
        updatedPuntoReferencia += result.updatedRows;
      }
    }
  }

  return {
    updatedOrders,
    updatedColonia,
    updatedNumeroInterior,
    updatedDepartamento,
    updatedPuntoReferencia,
  };
}

async function syncCountry(
  config: SheetConfig,
): Promise<DireccionGranularCountrySyncResult> {
  const { headers, orderNumberIndex, sourceRows } = await fetchSheet(config);

  const mappedRows = mapRows(config, headers, sourceRows, orderNumberIndex);

  if (!mappedRows) {
    return emptyCountryResult(config.pais, sourceRows.length);
  }

  const {
    addresses,
    skippedWithoutOrderNumber,
    skippedWithoutGranularAddress,
    duplicateRows,
  } = mappedRows;
  const orders = await findExistingOrders(config.pais, [...addresses.keys()]);
  const matchedOrderNumbers = new Set(
    orders
      .map((order) => order.numero_orden)
      .filter((numeroOrden): numeroOrden is string => Boolean(numeroOrden)),
  );
  const { updates, unchangedOrders } = getPendingUpdates(orders, addresses);
  const updateResult = await updateOrders(config.pais, updates);

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
