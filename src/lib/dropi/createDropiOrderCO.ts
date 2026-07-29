/**
 * createDropiOrderCO — standalone Dropi Colombia order-creation client.
 *
 * Implements the reverse-engineered CO order-creation flow documented in
 * docs/dropi-order-creation-source-of-truth.md. It creates a real COD order
 * ("FINAL_ORDER" + "CON RECAUDO"), which Dropi automatically assigns the
 * status "PENDIENTE CONFIRMACION".
 *
 * Design notes:
 * - CO-only. No MX code paths.
 * - This module is intentionally free of `import "server-only"` and of the
 *   `@/` path alias so its pure logic can be unit-tested with the built-in
 *   `node:test` runner (no bundler, no extra dev dependencies). All callers
 *   MUST still run server-side: the function requires a live Dropi session
 *   token, which is minted exclusively by the server-only getDropiSession
 *   module. The manual dry-run route wires those together.
 * - Auth is NOT implemented here. The caller passes a token obtained from the
 *   existing session cache (getDropiSession); this module never logs in.
 * - `fetchImpl` is injectable purely for testing; it defaults to global fetch.
 */

const DROPI_API_BASE_URL = "https://api.dropi.co/api";

/**
 * CRITICAL — do not change these two values. Per the source-of-truth doc, the
 * "FINAL_ORDER" + "CON RECAUDO" combination is exactly what produces a real,
 * confirmable COD order that Dropi auto-assigns "PENDIENTE CONFIRMACION".
 * "SAMPLE_ORDER" / "SIN RECAUDO" produce a different, non-COD sample flow.
 */
const ORDER_TYPE = "FINAL_ORDER" as const;
const RATE_TYPE = "CON RECAUDO" as const;

/** Status Dropi is expected to auto-assign for FINAL_ORDER + CON RECAUDO. */
export const EXPECTED_CREATED_STATUS = "PENDIENTE CONFIRMACION" as const;

const PAYMENT_METHOD_ID = 1;
const TYPE_SERVICE = "normal";

/**
 * Outbound browser headers. These intentionally mirror
 * `DROPI_BROWSER_HEADERS` from src/lib/dropi/dropiAuth.ts. They are duplicated
 * here (rather than imported) only because dropiAuth.ts pulls in
 * `import "server-only"`, which is not resolvable outside the Next bundler and
 * would make this module impossible to unit-test with `node:test`. dropiAuth.ts
 * remains the canonical source for the authentication flow itself.
 */
const DROPI_BROWSER_HEADERS: Record<string, string> = {
  accept: "application/json, text/plain, */*",
  "accept-language": "es-419,es;q=0.8",
  "content-type": "application/json",
  origin: "https://app.dropi.co",
  referer: "https://app.dropi.co/",
  "sec-ch-ua": '"Chromium";v="148", "Brave";v="148", "Not/A)Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Linux"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DropiProductType = "SIMPLE" | "VARIABLE";

/** Which step of the 4-call chain failed. */
export type CreateDropiOrderStep =
  | "origin-city"
  | "shipping-quote"
  | "earnings"
  | "create";

export type CreateDropiOrderCOProductInput = {
  /** Dropi product id. */
  id: number;
  /** Product name (echoed into the order payload). */
  name: string;
  /** Units ordered. */
  quantity: number;
  /** Unit price (number). */
  price: number;
  /**
   * Variation id. Required for VARIABLE products, must be null/undefined for
   * SIMPLE products. If provided and `productType` is omitted, the product is
   * treated as VARIABLE.
   */
  variationId?: number | null;
  /** Explicit product type. Inferred from `variationId` when omitted. */
  productType?: DropiProductType;
  /** Optional string prices as they appear in the payload. Defaulted from `price`. */
  suggestedPrice?: string;
  salePrice?: string;
};

export type CreateDropiOrderCOPackageInput = {
  /** Weight (used both as products[].weight and as the shipping-quote `peso`). */
  weight: number;
  /** Length -> shipping-quote `largo`. */
  length: number;
  /** Width -> shipping-quote `ancho`. */
  width: number;
  /** Height -> shipping-quote `alto`. */
  height: number;
};

export type CreateDropiOrderCOInput = {
  // --- Customer ---
  name: string;
  surname: string;
  /** Country code + number, no leading "+" (e.g. "573005113818"). */
  phone: string;
  /** Delivery address. */
  dir: string;
  /** e.g. "COLOMBIA". */
  country: string;
  state: string;
  city: string;
  colonia?: string;
  dni?: string;
  dniType?: string;
  clientEmail?: string;
  notes?: string;

  // --- Account / supplier ---
  /** The Dropi account's own user id. */
  userId: number;
  /** The product's supplier id (also used as products[].user_id per the doc). */
  supplierId: number;

  // --- Commercial ---
  /** Full sale price to be collected COD. */
  totalOrder: number;

  // --- Product & package ---
  product: CreateDropiOrderCOProductInput;
  package: CreateDropiOrderCOPackageInput;
};

/** Minimal structural fetch contract (satisfied by global fetch / Response). */
export type DropiFetchResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

export type DropiFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<DropiFetchResponse>;

export type DropiOrderLogger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

export type CreateDropiOrderCOParams = {
  /** Live Dropi CO session token (from getDropiSession("CO")). */
  token: string;
  input: CreateDropiOrderCOInput;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: DropiFetch;
  /** Injectable for tests. Defaults to console. */
  logger?: DropiOrderLogger;
};

export type NormalizedQuote = {
  id: number | null;
  name: string | null;
  shippingAmount: number;
  raw: Record<string, unknown>;
};

export type CreateDropiOrderCOResult = {
  /** The new Dropi order id (objects.id) — persist this as the Dropi reference. */
  orderId: number;
  /** The status Dropi assigned. */
  status: string | null;
  /** What we expected Dropi to assign for FINAL_ORDER + CON RECAUDO. */
  expectedStatus: typeof EXPECTED_CREATED_STATUS;
  /** True when Dropi returned the expected status. */
  statusMatchesExpected: boolean;
  /** Shipping amount for the selected (cheapest) carrier. */
  shippingAmount: number;
  /** The carrier chosen automatically (cheapest quote). */
  distributionCompany: { id: number; name: string | null };
  /** Dropshipper earnings if the informational call returned them, else null. */
  dropshipperAmountToWin: number | null;
  /** Full raw creation response for the caller to persist as needed. */
  response: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DropiOrderCreationError extends Error {
  readonly step: CreateDropiOrderStep;

  constructor(
    step: CreateDropiOrderStep,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DropiOrderCreationError";
    this.step = step;
  }
}

/**
 * Distinct error for captcha-required responses. Per the source-of-truth doc's
 * "captcha risk" note, creation may require an x-captcha-token under conditions
 * not yet observed. Callers must treat this as an explicit, non-retryable case
 * rather than blindly retrying.
 */
export class DropiCaptchaRequiredError extends DropiOrderCreationError {
  constructor(
    step: CreateDropiOrderStep,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(step, message, options);
    this.name = "DropiCaptchaRequiredError";
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extractDropiMessage(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim().slice(0, 1_000);
  }

  if (!isRecord(payload)) {
    return null;
  }

  for (const key of ["message", "errorMessage", "msg", "detail", "reason", "error"]) {
    const value = payload[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 1_000);
    }
  }

  return null;
}

function hasExplicitFailure(payload: unknown): boolean {
  if (!isRecord(payload)) {
    return false;
  }

  if (
    payload.isSuccess === false ||
    payload.success === false ||
    payload.ok === false ||
    payload.status === false
  ) {
    return true;
  }

  const error = payload.error;

  return Boolean(
    error === true ||
      (typeof error === "string" && error.trim()) ||
      (Array.isArray(error) && error.length > 0),
  );
}

const CAPTCHA_PATTERN = /captcha|recaptcha|hcaptcha/i;

/**
 * Best-effort captcha detection. The doc marks the exact manifestation as
 * "unknown, needs further capture", so this scans the most likely signals:
 * an HTTP 428 (Precondition Required), an explicit captcha flag, or the word
 * "captcha" anywhere in the response message.
 */
export function responseIndicatesCaptcha(status: number, payload: unknown): boolean {
  if (status === 428) {
    return true;
  }

  if (typeof payload === "string") {
    return CAPTCHA_PATTERN.test(payload);
  }

  if (!isRecord(payload)) {
    return false;
  }

  if (
    payload.captcha_required === true ||
    payload.captchaRequired === true ||
    payload.requires_captcha === true ||
    payload.needs_captcha === true
  ) {
    return true;
  }

  const message = [
    payload.message,
    payload.error,
    payload.errorMessage,
    payload.detail,
    payload.reason,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  return CAPTCHA_PATTERN.test(message);
}

function buildHeaders(token: string): Record<string, string> {
  return {
    ...DROPI_BROWSER_HEADERS,
    "x-authorization": `Bearer ${token}`,
    // Present but empty, matching every other Dropi call. If Dropi ever
    // requires a real value, the response is caught by responseIndicatesCaptcha
    // and surfaced as DropiCaptchaRequiredError.
    "x-captcha-token": "",
  };
}

/** Extract an array from common Dropi envelope shapes. */
function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload)) {
    if (Array.isArray(payload.objects)) {
      return payload.objects;
    }

    if (Array.isArray(payload.data)) {
      return payload.data;
    }

    if (isRecord(payload.data) && Array.isArray(payload.data.objects)) {
      return payload.data.objects;
    }
  }

  return [];
}

/** Pull the single warehouse record out of common envelope shapes. */
function extractWarehouseRecord(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) {
    return isRecord(payload) ? payload : null;
  }

  const { objects, data } = payload;

  if (isRecord(objects)) {
    return objects;
  }

  if (Array.isArray(objects) && isRecord(objects[0])) {
    return objects[0];
  }

  if (isRecord(data)) {
    return data;
  }

  if (Array.isArray(data) && isRecord(data[0])) {
    return data[0];
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Pure, exported building blocks (unit-tested directly)
// ---------------------------------------------------------------------------

export function resolveProductType(
  product: CreateDropiOrderCOProductInput,
): DropiProductType {
  if (product.productType) {
    return product.productType;
  }

  return product.variationId != null ? "VARIABLE" : "SIMPLE";
}

/**
 * Normalize a single carrier quote. Field names beyond `shipping_amount` were
 * not fully captured (doc gap), so several likely aliases are accepted.
 */
export function normalizeQuote(raw: unknown): NormalizedQuote | null {
  if (!isRecord(raw)) {
    return null;
  }

  const shippingAmount = toNumber(
    raw.shipping_amount ?? raw.rate ?? raw.value ?? raw.total,
  );

  if (shippingAmount == null) {
    return null;
  }

  const nestedCompany = isRecord(raw.distribution_company)
    ? raw.distribution_company
    : null;

  const id = toNumber(
    raw.id ??
      raw.company_id ??
      raw.distribution_company_id ??
      nestedCompany?.id,
  );

  const name = toStringOrNull(
    raw.name ??
      raw.company_name ??
      raw.carrier ??
      nestedCompany?.name,
  );

  return { id, name, shippingAmount, raw };
}

/**
 * Select the cheapest carrier quote by shipping_amount. Returns null when no
 * quote carries a usable shipping amount. Automatic — no manual selection.
 */
export function selectCheapestQuote(quotes: unknown[]): NormalizedQuote | null {
  let cheapest: NormalizedQuote | null = null;

  for (const quote of quotes) {
    const normalized = normalizeQuote(quote);

    if (!normalized) {
      continue;
    }

    if (!cheapest || normalized.shippingAmount < cheapest.shippingAmount) {
      cheapest = normalized;
    }
  }

  return cheapest;
}

export type DropiCreateOrderProductPayload = {
  id: number;
  name: string;
  weight: string;
  stock: number | null;
  variation_id: number | null;
  quantity: number;
  price: number;
  suggested_price: string;
  sale_price: string;
  variations: unknown[];
  type: DropiProductType;
  user_id: number;
};

export function buildProductPayload(
  input: CreateDropiOrderCOInput,
  productType: DropiProductType,
): DropiCreateOrderProductPayload {
  const { product } = input;
  const priceString = String(product.price);

  return {
    id: product.id,
    name: product.name,
    weight: String(input.package.weight),
    stock: null,
    variation_id:
      productType === "VARIABLE" ? product.variationId ?? null : null,
    quantity: product.quantity,
    price: product.price,
    suggested_price: product.suggestedPrice ?? priceString,
    sale_price: product.salePrice ?? priceString,
    variations: [],
    type: productType,
    // Per the doc, products[].user_id equals the top-level supplier_id.
    user_id: input.supplierId,
  };
}

export type DropiCreateOrderPayload = {
  total_order: number;
  notes: string;
  name: string;
  surname: string;
  dir: string;
  country: string;
  state: string;
  city: string;
  phone: string;
  client_email: string;
  payment_method_id: number;
  user_id: number;
  supplier_id: number;
  type: typeof ORDER_TYPE;
  rate_type: typeof RATE_TYPE;
  products: DropiCreateOrderProductPayload[];
  distributionCompany: { id: number; name: string };
  type_service: string;
  zip_code: null;
  colonia: string;
  shop_id: null;
  dni: string;
  dni_type: string;
  insurance: boolean;
  shalom_data: null;
  warehouses_selected_id: number;
  shipping_amount: number;
};

export function buildCreateOrderPayload(args: {
  input: CreateDropiOrderCOInput;
  warehouse: { id: number; city: string };
  quote: NormalizedQuote;
  productType: DropiProductType;
}): DropiCreateOrderPayload {
  const { input, warehouse, quote, productType } = args;

  return {
    total_order: input.totalOrder,
    notes: input.notes ?? "",
    name: input.name,
    surname: input.surname,
    dir: input.dir,
    country: input.country,
    state: input.state,
    city: input.city,
    phone: input.phone,
    client_email: input.clientEmail ?? "",
    payment_method_id: PAYMENT_METHOD_ID,
    user_id: input.userId,
    supplier_id: input.supplierId,
    // CRITICAL constants — always FINAL_ORDER + CON RECAUDO for real COD orders.
    type: ORDER_TYPE,
    rate_type: RATE_TYPE,
    products: [buildProductPayload(input, productType)],
    distributionCompany: {
      id: quote.id as number,
      name: quote.name ?? "",
    },
    type_service: TYPE_SERVICE,
    zip_code: null,
    colonia: input.colonia ?? "",
    // shop_id purpose is unconfirmed (doc open question). Left null as captured.
    shop_id: null,
    dni: input.dni ?? "",
    dni_type: input.dniType ?? "",
    insurance: false,
    shalom_data: null,
    warehouses_selected_id: warehouse.id,
    shipping_amount: quote.shippingAmount,
  };
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

async function postDropi(args: {
  fetchImpl: DropiFetch;
  token: string;
  path: string;
  body: unknown;
  step: CreateDropiOrderStep;
}): Promise<unknown> {
  const { fetchImpl, token, path, body, step } = args;

  let response: DropiFetchResponse;

  try {
    response = await fetchImpl(`${DROPI_API_BASE_URL}${path}`, {
      method: "POST",
      headers: buildHeaders(token),
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new DropiOrderCreationError(
      step,
      `Network error during "${step}": ${errorMessage(error)}`,
      { cause: error },
    );
  }

  const responseText = await response.text();
  let payload: unknown = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = responseText;
    }
  }

  // Captcha is checked before generic failure so callers get the distinct type
  // even when the status is 200 or a generic 4xx.
  if (responseIndicatesCaptcha(response.status, payload)) {
    throw new DropiCaptchaRequiredError(
      step,
      `Dropi required a captcha token during "${step}" (x-captcha-token was empty). ` +
        `This is the documented, unobserved captcha case — not retrying.`,
    );
  }

  if (!response.ok || hasExplicitFailure(payload)) {
    throw new DropiOrderCreationError(
      step,
      `Dropi "${step}" call failed (HTTP ${response.status}): ${
        extractDropiMessage(payload) ?? "unexpected error"
      }`,
    );
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Orchestrator — the single public async entry point
// ---------------------------------------------------------------------------

export async function createDropiOrderCO(
  params: CreateDropiOrderCOParams,
): Promise<CreateDropiOrderCOResult> {
  const { input, fetchImpl = defaultFetch, logger = console } = params;
  const token = params.token?.trim();

  if (!token) {
    throw new DropiOrderCreationError(
      "origin-city",
      "A Dropi CO session token is required (obtain it from getDropiSession).",
    );
  }

  const productType = resolveProductType(input.product);
  const destination = `${input.city}, ${input.state}`;

  // --- Step a: resolve origin warehouse ---
  const originBody = {
    id: input.product.id,
    destination,
    type: productType,
  };
  const originPayload = await postDropi({
    fetchImpl,
    token,
    path: "/orders/getOriginCityForCalculateShipping",
    body: originBody,
    step: "origin-city",
  });

  const warehouseRecord = extractWarehouseRecord(originPayload);
  const warehouseId = warehouseRecord
    ? toNumber(
        warehouseRecord.id ??
          warehouseRecord.warehouse_id ??
          warehouseRecord.warehouses_selected_id ??
          warehouseRecord.warehouseId,
      )
    : null;
  const warehouseCity = warehouseRecord
    ? toStringOrNull(
        warehouseRecord.city ??
          warehouseRecord.city_name ??
          warehouseRecord.ciudad ??
          warehouseRecord.name,
      )
    : null;

  if (warehouseId == null || warehouseCity == null) {
    throw new DropiOrderCreationError(
      "origin-city",
      "getOriginCityForCalculateShipping did not return a usable warehouse id and city.",
    );
  }

  // --- Step b: carrier quotes -> pick the cheapest ---
  const quoteBody = {
    peso: input.package.weight,
    largo: input.package.length,
    ancho: input.package.width,
    alto: input.package.height,
    ciudad_remitente: warehouseCity,
    ciudad_destino: input.city,
  };
  const quotePayload = await postDropi({
    fetchImpl,
    token,
    path: "/orders/cotizaEnvioTransportadoraV2",
    body: quoteBody,
    step: "shipping-quote",
  });

  const quotes = extractArray(quotePayload);

  if (quotes.length === 0) {
    throw new DropiOrderCreationError(
      "shipping-quote",
      "cotizaEnvioTransportadoraV2 returned no carrier quotes.",
    );
  }

  const cheapest = selectCheapestQuote(quotes);

  if (!cheapest || cheapest.id == null) {
    throw new DropiOrderCreationError(
      "shipping-quote",
      "cotizaEnvioTransportadoraV2 returned no quote with a usable shipping amount and carrier id.",
    );
  }

  // --- Step c: dropshipper earnings (informational) ---
  // Per the acceptance criteria, a failure here still aborts before creation
  // (fail-fast). "Informational" means we do not gate on the earnings VALUE:
  // a successful response with no parseable amount is tolerated (earnings null).
  const earningsBody = {
    total_order: input.totalOrder,
    user_id: input.userId,
    supplier_id: input.supplierId,
    type: ORDER_TYPE,
    rate_type: RATE_TYPE,
    products: [buildProductPayload(input, productType)],
    // Exact key for "the chosen cotiza result" is a doc gap; sending the raw
    // selected quote under this key is the documented best guess.
    cotizaEnvTransport: cheapest.raw,
  };
  const earningsPayload = await postDropi({
    fetchImpl,
    token,
    path: "/orders/calculateEarnedAmound",
    body: earningsBody,
    step: "earnings",
  });

  const dropshipperAmountToWin = extractDropshipperAmount(earningsPayload);

  // --- Step d: create the order ---
  const orderPayload = buildCreateOrderPayload({
    input,
    warehouse: { id: warehouseId, city: warehouseCity },
    quote: cheapest,
    productType,
  });
  const createPayload = await postDropi({
    fetchImpl,
    token,
    path: "/orders/myorders",
    body: orderPayload,
    step: "create",
  });

  if (!isRecord(createPayload)) {
    throw new DropiOrderCreationError(
      "create",
      "Order creation returned an unexpected (non-object) response.",
    );
  }

  const objects = createPayload.objects;

  if (!isRecord(objects)) {
    throw new DropiOrderCreationError(
      "create",
      "Order creation response did not include an `objects` payload.",
    );
  }

  const orderId = toNumber(objects.id);

  if (orderId == null) {
    throw new DropiOrderCreationError(
      "create",
      "Order creation response did not include a numeric `objects.id`.",
    );
  }

  const status = toStringOrNull(objects.status);
  const statusMatchesExpected = status === EXPECTED_CREATED_STATUS;

  if (!statusMatchesExpected) {
    // A wrong status here almost certainly means a payload mistake (e.g. the
    // wrong type/rate_type), since Dropi auto-assigns the status from those.
    logger.warn(
      `Dropi order ${orderId} was created with status "${status ?? "unknown"}" ` +
        `but "${EXPECTED_CREATED_STATUS}" was expected for FINAL_ORDER + CON RECAUDO. ` +
        `Verify the payload.`,
    );
  }

  return {
    orderId,
    status,
    expectedStatus: EXPECTED_CREATED_STATUS,
    statusMatchesExpected,
    shippingAmount: cheapest.shippingAmount,
    distributionCompany: { id: cheapest.id, name: cheapest.name },
    dropshipperAmountToWin,
    response: createPayload,
  };
}

function extractDropshipperAmount(payload: unknown): number | null {
  const candidates: unknown[] = [payload];

  if (isRecord(payload)) {
    candidates.push(payload.objects, payload.data);
  }

  for (const candidate of candidates) {
    if (!isRecord(candidate)) {
      continue;
    }

    const amount = toNumber(
      candidate.dropshipper_amount_to_win ??
        candidate.dropshipperAmountToWin ??
        candidate.earned_amount ??
        candidate.amount_to_win,
    );

    if (amount != null) {
      return amount;
    }
  }

  return null;
}

const defaultFetch: DropiFetch = (url, init) => fetch(url, init);
