import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

type Pais = "CO" | "MX";

type SheetConfig = {
  pais: Pais;
  sheetId: string;
  gid: string;
  minimumColumns: number;
  expectedHeaders: string[];
  mapRow: (row: string[], sincronizadoEn: string) => AbandonadoUpsertRow | null;
};

type AbandonadoUpsertRow = {
  pais: Pais;
  codigo_externo: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  nombre_producto: string | null;
  precio: number | null;
  fecha_abandono: string | null;
  sincronizado_en: string;
};

export type AbandonadosCountrySyncResult = {
  pais: Pais;
  sourceRows: number;
  validRows: number;
  upsertedRows: number;
  skippedWithoutPhone: number;
  skippedWithoutCode: number;
  duplicateRows: number;
};

export type AbandonadosSyncResult = {
  synchronizedAt: string;
  totalUpsertedRows: number;
  countries: AbandonadosCountrySyncResult[];
};

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_IN_MS = 24 * 60 * 60 * 1_000;
const MAX_CSV_SIZE = 10_000_000;
const UPSERT_BATCH_SIZE = 500;

function getAbandonadosClient() {
  // The live abandonados table was added after the generated database types.
  // Keep the temporary untyped access contained in this server-only module.
  return createAdminClient() as unknown as SupabaseClient;
}

function cleanCell(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized && normalized !== "-" ? normalized : null;
}

function normalizePhone(value: string | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

function joinUniqueAddressParts(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const value of values) {
    const part = cleanCell(value);

    if (!part) {
      continue;
    }

    const comparisonKey = part.toLocaleLowerCase("es");

    if (!seen.has(comparisonKey)) {
      seen.add(comparisonKey);
      parts.push(part);
    }
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

function parsePrice(value: string | undefined) {
  const normalized = cleanCell(value)?.replace(/[^\d.-]/g, "") ?? "";

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIsoDate(value: string | undefined) {
  const normalized = cleanCell(value);
  const datePart = normalized?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];

  if (!datePart) {
    return null;
  }

  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === datePart
    ? datePart
    : null;
}

function parseExcelSerialDate(value: string | undefined) {
  const serial = Number(cleanCell(value));

  if (!Number.isFinite(serial) || serial <= 0) {
    return null;
  }

  const parsed = new Date(EXCEL_EPOCH_UTC + Math.floor(serial) * DAY_IN_MS);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function productNameFromRecoveryUrl(allDetails: string | undefined) {
  const details = cleanCell(allDetails);

  if (!details) {
    return null;
  }

  const recoveryUrl = details.match(/Recovery URL:\s*(https?:\/\/\S+)/i)?.[1];

  if (!recoveryUrl) {
    return null;
  }

  try {
    const slug = new URL(recoveryUrl).pathname.match(/\/products\/([^/]+)/i)?.[1];

    if (!slug) {
      return null;
    }

    return decodeURIComponent(slug)
      .split("-")
      .filter(Boolean)
      .map((word) => `${word.charAt(0).toLocaleUpperCase("es")}${word.slice(1).toLocaleLowerCase("es")}`)
      .join(" ") || null;
  } catch {
    return null;
  }
}

function mapMxRow(row: string[], sincronizadoEn: string) {
  const telefono = normalizePhone(row[5]);
  const codigoExterno = cleanCell(row[0]);

  if (!telefono || !codigoExterno) {
    return null;
  }

  return {
    pais: "MX" as const,
    codigo_externo: codigoExterno,
    nombre: cleanCell(row[3]),
    apellido: cleanCell(row[4]),
    telefono,
    direccion: joinUniqueAddressParts([
      row[11],
      row[8],
      row[9],
      row[7],
      row[10],
    ]),
    ciudad: cleanCell(row[6]),
    departamento: cleanCell(row[15]),
    nombre_producto: productNameFromRecoveryUrl(row[17]),
    precio: null,
    fecha_abandono: parseIsoDate(row[2]),
    sincronizado_en: sincronizadoEn,
  };
}

function mapCoRow(row: string[], sincronizadoEn: string) {
  const telefono = normalizePhone(row[6]);
  const codigoExterno = cleanCell(row[0]);

  if (!telefono || !codigoExterno) {
    return null;
  }

  return {
    pais: "CO" as const,
    codigo_externo: codigoExterno,
    nombre: cleanCell(row[3]),
    apellido: cleanCell(row[4]),
    telefono,
    direccion: joinUniqueAddressParts([row[7], row[8]]),
    ciudad: cleanCell(row[9]),
    departamento: cleanCell(row[10]),
    nombre_producto: cleanCell(row[11]),
    precio: parsePrice(row[14]) ?? parsePrice(row[13]),
    fecha_abandono: parseExcelSerialDate(row[2]),
    sincronizado_en: sincronizadoEn,
  };
}

const SHEETS: SheetConfig[] = [
  {
    pais: "MX",
    sheetId: "1pKW3AIjgMugB0Izv5l_FYFQMUV3GiraSwjTTUsQUFnY",
    gid: "1055350682",
    minimumColumns: 18,
    expectedHeaders: [
      "Order #",
      "Order ID",
      "Date",
      "First Name",
      "Last Name",
      "Phone",
      "City",
      "Colonia",
      "Calle y Número Exterior",
      "Número Interior",
      "Punto de Referencia",
      "Address",
      "Note",
      "Zip Code",
      "Country",
      "Province",
      "Municipio / Alcaldía",
      "All Details",
    ],
    mapRow: mapMxRow,
  },
  {
    pais: "CO",
    sheetId: "1FyHRh9ClLdjpjc9QlRLDEKwtJcm0BJf2uOZeTdrWHAU",
    gid: "1055350682",
    minimumColumns: 19,
    expectedHeaders: [
      "Order #",
      "Order ID",
      "Date",
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Address",
      "Address 2",
      "City",
      "Province",
      "Product Name",
      "Qty",
      "Price",
      "Total",
      "Currency",
      "Shipping",
      "Discounts",
      "Note",
    ],
    mapRow: mapCoRow,
  },
];

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

function assertExpectedHeaders(config: SheetConfig, headers: string[]) {
  if (headers.length < config.minimumColumns) {
    throw new Error(
      `${config.pais} abandonados sheet has ${headers.length} columns; expected at least ${config.minimumColumns}`,
    );
  }

  const hasExpectedHeaders = config.expectedHeaders.every(
    (header, index) => headers[index]?.trim() === header,
  );

  if (!hasExpectedHeaders) {
    throw new Error(`${config.pais} abandonados sheet headers changed unexpectedly`);
  }
}

async function fetchAndMapSheet(
  config: SheetConfig,
  sincronizadoEn: string,
) {
  const url = `https://docs.google.com/spreadsheets/d/${config.sheetId}/export?format=csv&gid=${config.gid}`;
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${config.pais} abandonados sheet: HTTP ${response.status}`,
    );
  }

  const csv = await response.text();

  if (csv.length > MAX_CSV_SIZE) {
    throw new Error(`${config.pais} abandonados sheet exceeds the CSV size limit`);
  }

  const [headers, ...sourceRows] = parseCsv(csv);

  if (!headers) {
    throw new Error(`${config.pais} abandonados sheet is empty`);
  }

  assertExpectedHeaders(config, headers);

  const deduplicatedRows = new Map<string, AbandonadoUpsertRow>();
  let skippedWithoutPhone = 0;
  let skippedWithoutCode = 0;
  let duplicateRows = 0;

  for (const row of sourceRows) {
    const telefono = normalizePhone(row[config.pais === "MX" ? 5 : 6]);
    const codigoExterno = cleanCell(row[0]);

    if (!telefono) {
      skippedWithoutPhone += 1;
      continue;
    }

    if (!codigoExterno) {
      skippedWithoutCode += 1;
      continue;
    }

    const mappedRow = config.mapRow(row, sincronizadoEn);

    if (!mappedRow) {
      continue;
    }

    if (deduplicatedRows.has(mappedRow.codigo_externo)) {
      duplicateRows += 1;
    }

    deduplicatedRows.set(mappedRow.codigo_externo, mappedRow);
  }

  const rows = [...deduplicatedRows.values()];

  return {
    rows,
    result: {
      pais: config.pais,
      sourceRows: sourceRows.length,
      validRows: rows.length,
      upsertedRows: 0,
      skippedWithoutPhone,
      skippedWithoutCode,
      duplicateRows,
    } satisfies AbandonadosCountrySyncResult,
  };
}

async function upsertRows(rows: AbandonadoUpsertRow[]) {
  const supabase = getAbandonadosClient();

  for (let offset = 0; offset < rows.length; offset += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + UPSERT_BATCH_SIZE);
    const { error } = await supabase.from("abandonados").upsert(batch, {
      onConflict: "pais,codigo_externo",
      ignoreDuplicates: false,
    });

    if (error) {
      throw new Error(`Failed to upsert abandonados: ${error.message}`);
    }
  }
}

export async function syncAbandonados(): Promise<AbandonadosSyncResult> {
  const synchronizedAt = new Date().toISOString();
  const sheetResults = await Promise.all(
    SHEETS.map((config) => fetchAndMapSheet(config, synchronizedAt)),
  );

  for (const sheetResult of sheetResults) {
    await upsertRows(sheetResult.rows);
    sheetResult.result.upsertedRows = sheetResult.rows.length;
  }

  const countries = sheetResults.map(({ result }) => result);

  return {
    synchronizedAt,
    totalUpsertedRows: countries.reduce(
      (total, country) => total + country.upsertedRows,
      0,
    ),
    countries,
  };
}
