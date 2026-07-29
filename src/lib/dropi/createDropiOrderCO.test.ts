/**
 * Unit tests for createDropiOrderCO.
 *
 * Runner: Node's built-in test runner (no extra dependencies). Node v22.6+
 * strips TypeScript types natively, so this runs with:
 *
 *   node --test src/lib/dropi/createDropiOrderCO.test.ts
 *
 * These tests NEVER hit the live Dropi API — every HTTP call is mocked via the
 * injectable `fetchImpl`. The module under test is imported by relative path
 * (it is intentionally free of the `@/` alias and `server-only`).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// Node's test runner requires the explicit ".ts" extension to resolve the
// module. The project's tsconfig has no allowImportingTsExtensions, so tsc
// would raise TS5097 on this single line — suppressed here (single-line import
// so the directive lands on the specifier). Types below are still fully checked.
// prettier-ignore
// @ts-expect-error -- explicit .ts extension is required by `node --test`
import { buildCreateOrderPayload, createDropiOrderCO, DropiCaptchaRequiredError, DropiOrderCreationError, EXPECTED_CREATED_STATUS, resolveProductType, responseIndicatesCaptcha, selectCheapestQuote, type CreateDropiOrderCOInput, type DropiFetch, type DropiFetchResponse } from "./createDropiOrderCO.ts";

// ---------------------------------------------------------------------------
// Test fixtures & helpers
// ---------------------------------------------------------------------------

function baseInput(
  overrides: Partial<CreateDropiOrderCOInput> = {},
): CreateDropiOrderCOInput {
  return {
    name: "Ada",
    surname: "Lovelace",
    phone: "573005113818",
    dir: "Calle 123 #45-67",
    country: "COLOMBIA",
    state: "Cundinamarca",
    city: "Bogota",
    colonia: "Chapinero",
    dni: "1234567890",
    dniType: "CC",
    clientEmail: "ada@example.com",
    notes: "Leave at the door",
    userId: 824352,
    supplierId: 9001,
    totalOrder: 120000,
    product: {
      id: 555,
      name: "Widget",
      quantity: 2,
      price: 50000,
    },
    package: { weight: 1.5, length: 20, width: 15, height: 10 },
    ...overrides,
  };
}

type MockResponseSpec = {
  ok?: boolean;
  status?: number;
  body: unknown;
};

function jsonResponse(spec: MockResponseSpec): DropiFetchResponse {
  const status = spec.status ?? 200;
  const ok = spec.ok ?? (status >= 200 && status < 300);
  const text =
    typeof spec.body === "string" ? spec.body : JSON.stringify(spec.body);

  return {
    ok,
    status,
    text: async () => text,
  };
}

type RecordedCall = { url: string; method: string; body: unknown };

/**
 * Build a mock fetch that routes by endpoint substring. Records every call so
 * tests can assert which steps ran and inspect the create payload.
 */
function mockFetch(routes: {
  origin?: MockResponseSpec;
  quote?: MockResponseSpec;
  earnings?: MockResponseSpec;
  create?: MockResponseSpec;
}): { fetchImpl: DropiFetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];

  const fetchImpl: DropiFetch = async (url, init) => {
    let parsedBody: unknown = null;
    try {
      parsedBody = JSON.parse(init.body);
    } catch {
      parsedBody = init.body;
    }
    calls.push({ url, method: init.method, body: parsedBody });

    if (url.includes("getOriginCityForCalculateShipping")) {
      if (!routes.origin) throw new Error("unexpected origin call");
      return jsonResponse(routes.origin);
    }
    if (url.includes("cotizaEnvioTransportadoraV2")) {
      if (!routes.quote) throw new Error("unexpected quote call");
      return jsonResponse(routes.quote);
    }
    if (url.includes("calculateEarnedAmound")) {
      if (!routes.earnings) throw new Error("unexpected earnings call");
      return jsonResponse(routes.earnings);
    }
    if (url.includes("myorders")) {
      if (!routes.create) throw new Error("unexpected create call");
      return jsonResponse(routes.create);
    }
    throw new Error(`unrouted url: ${url}`);
  };

  return { fetchImpl, calls };
}

const OK_ORIGIN: MockResponseSpec = {
  body: { objects: { id: 42, city: "Medellin" } },
};
const OK_QUOTE_MULTI: MockResponseSpec = {
  body: {
    objects: [
      { id: 1, name: "CarrierExpensive", shipping_amount: 18000 },
      { id: 2, name: "CarrierCheap", shipping_amount: 9000 },
      { id: 3, name: "CarrierMid", shipping_amount: 12000 },
    ],
  },
};
const OK_EARNINGS: MockResponseSpec = {
  body: { objects: { dropshipper_amount_to_win: 33000 } },
};
const OK_CREATE: MockResponseSpec = {
  body: {
    isSuccess: true,
    message: "El registro ha sido creado con exito!.",
    status: 200,
    objects: { id: 987654, status: "PENDIENTE CONFIRMACION" },
  },
};

const silentLogger = { info: () => {}, warn: () => {} };

// ---------------------------------------------------------------------------
// Pure building-block tests
// ---------------------------------------------------------------------------

test("buildCreateOrderPayload always sets FINAL_ORDER + CON RECAUDO", () => {
  const payload = buildCreateOrderPayload({
    input: baseInput(),
    warehouse: { id: 42, city: "Medellin" },
    quote: { id: 2, name: "CarrierCheap", shippingAmount: 9000, raw: {} },
    productType: "SIMPLE",
  });

  assert.equal(payload.type, "FINAL_ORDER");
  assert.equal(payload.rate_type, "CON RECAUDO");
  assert.equal(payload.warehouses_selected_id, 42);
  assert.equal(payload.shipping_amount, 9000);
  assert.deepEqual(payload.distributionCompany, { id: 2, name: "CarrierCheap" });
  assert.equal(payload.products[0].type, "SIMPLE");
  assert.equal(payload.products[0].variation_id, null);
  // products[].user_id mirrors the top-level supplier_id per the doc.
  assert.equal(payload.products[0].user_id, payload.supplier_id);
});

test("buildCreateOrderPayload keeps variation_id for VARIABLE products", () => {
  const payload = buildCreateOrderPayload({
    input: baseInput({
      product: {
        id: 555,
        name: "Widget",
        quantity: 1,
        price: 50000,
        variationId: 777,
        productType: "VARIABLE",
      },
    }),
    warehouse: { id: 42, city: "Medellin" },
    quote: { id: 2, name: "CarrierCheap", shippingAmount: 9000, raw: {} },
    productType: "VARIABLE",
  });

  assert.equal(payload.products[0].type, "VARIABLE");
  assert.equal(payload.products[0].variation_id, 777);
});

test("resolveProductType infers VARIABLE from variationId", () => {
  assert.equal(resolveProductType({ id: 1, name: "x", quantity: 1, price: 1 }), "SIMPLE");
  assert.equal(
    resolveProductType({ id: 1, name: "x", quantity: 1, price: 1, variationId: 9 }),
    "VARIABLE",
  );
});

test("selectCheapestQuote picks the minimum shipping_amount", () => {
  const cheapest = selectCheapestQuote([
    { id: 1, name: "A", shipping_amount: 18000 },
    { id: 2, name: "B", shipping_amount: 9000 },
    { id: 3, name: "C", shipping_amount: 12000 },
  ]);

  assert.equal(cheapest?.id, 2);
  assert.equal(cheapest?.shippingAmount, 9000);
});

test("selectCheapestQuote ignores quotes without a usable amount", () => {
  const cheapest = selectCheapestQuote([
    { id: 1, name: "A" },
    { id: 2, name: "B", shipping_amount: "7000" },
  ]);

  assert.equal(cheapest?.id, 2);
  assert.equal(cheapest?.shippingAmount, 7000);
});

test("responseIndicatesCaptcha detects flags, messages, and 428", () => {
  assert.equal(responseIndicatesCaptcha(200, { captcha_required: true }), true);
  assert.equal(responseIndicatesCaptcha(403, { message: "Please solve the reCAPTCHA" }), true);
  assert.equal(responseIndicatesCaptcha(428, {}), true);
  assert.equal(responseIndicatesCaptcha(200, { message: "all good" }), false);
});

// ---------------------------------------------------------------------------
// Orchestration: happy path
// ---------------------------------------------------------------------------

test("createDropiOrderCO happy path: cheapest carrier, correct payload, order id", async () => {
  const { fetchImpl, calls } = mockFetch({
    origin: OK_ORIGIN,
    quote: OK_QUOTE_MULTI,
    earnings: OK_EARNINGS,
    create: OK_CREATE,
  });

  const result = await createDropiOrderCO({
    token: "test-token",
    input: baseInput(),
    fetchImpl,
    logger: silentLogger,
  });

  // Result surface.
  assert.equal(result.orderId, 987654);
  assert.equal(result.status, "PENDIENTE CONFIRMACION");
  assert.equal(result.statusMatchesExpected, true);
  assert.equal(result.expectedStatus, EXPECTED_CREATED_STATUS);
  assert.equal(result.dropshipperAmountToWin, 33000);

  // Cheapest carrier auto-selected (9000, id 2).
  assert.equal(result.shippingAmount, 9000);
  assert.deepEqual(result.distributionCompany, { id: 2, name: "CarrierCheap" });

  // Exactly 4 calls, in order.
  assert.equal(calls.length, 4);
  assert.match(calls[0].url, /getOriginCityForCalculateShipping/);
  assert.match(calls[1].url, /cotizaEnvioTransportadoraV2/);
  assert.match(calls[2].url, /calculateEarnedAmound/);
  assert.match(calls[3].url, /myorders/);

  // Create payload carries the critical constants and the cheapest carrier.
  const createBody = calls[3].body as Record<string, unknown>;
  assert.equal(createBody.type, "FINAL_ORDER");
  assert.equal(createBody.rate_type, "CON RECAUDO");
  assert.equal(createBody.shipping_amount, 9000);
  assert.deepEqual(createBody.distributionCompany, { id: 2, name: "CarrierCheap" });
  assert.equal(createBody.warehouses_selected_id, 42);

  // Step a used destination "city, state"; step b used the warehouse city.
  const originBody = calls[0].body as Record<string, unknown>;
  assert.equal(originBody.destination, "Bogota, Cundinamarca");
  const quoteBody = calls[1].body as Record<string, unknown>;
  assert.equal(quoteBody.ciudad_remitente, "Medellin");
  assert.equal(quoteBody.ciudad_destino, "Bogota");
});

test("createDropiOrderCO warns but succeeds on unexpected status", async () => {
  const warnings: string[] = [];
  const { fetchImpl } = mockFetch({
    origin: OK_ORIGIN,
    quote: OK_QUOTE_MULTI,
    earnings: OK_EARNINGS,
    create: {
      body: {
        isSuccess: true,
        objects: { id: 111, status: "PENDIENTE" },
      },
    },
  });

  const result = await createDropiOrderCO({
    token: "test-token",
    input: baseInput(),
    fetchImpl,
    logger: { info: () => {}, warn: (...a) => warnings.push(a.join(" ")) },
  });

  assert.equal(result.orderId, 111);
  assert.equal(result.status, "PENDIENTE");
  assert.equal(result.statusMatchesExpected, false);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /PENDIENTE CONFIRMACION/);
});

// ---------------------------------------------------------------------------
// Orchestration: fail-fast per step
// ---------------------------------------------------------------------------

test("failure in step a (origin-city) stops the chain before creation", async () => {
  const { fetchImpl, calls } = mockFetch({
    origin: { ok: false, status: 500, body: { message: "boom" } },
  });

  await assert.rejects(
    () => createDropiOrderCO({ token: "t", input: baseInput(), fetchImpl, logger: silentLogger }),
    (error: unknown) => {
      assert.ok(error instanceof DropiOrderCreationError);
      assert.equal(error.step, "origin-city");
      return true;
    },
  );

  assert.equal(calls.length, 1);
});

test("failure in step b (shipping-quote) stops the chain before creation", async () => {
  const { fetchImpl, calls } = mockFetch({
    origin: OK_ORIGIN,
    quote: { ok: false, status: 502, body: { message: "carrier down" } },
  });

  await assert.rejects(
    () => createDropiOrderCO({ token: "t", input: baseInput(), fetchImpl, logger: silentLogger }),
    (error: unknown) => {
      assert.ok(error instanceof DropiOrderCreationError);
      assert.equal(error.step, "shipping-quote");
      return true;
    },
  );

  // origin + quote ran; earnings and create did not.
  assert.equal(calls.length, 2);
});

test("empty carrier quote list is a clear shipping-quote failure", async () => {
  const { fetchImpl } = mockFetch({
    origin: OK_ORIGIN,
    quote: { body: { objects: [] } },
  });

  await assert.rejects(
    () => createDropiOrderCO({ token: "t", input: baseInput(), fetchImpl, logger: silentLogger }),
    (error: unknown) => {
      assert.ok(error instanceof DropiOrderCreationError);
      assert.equal(error.step, "shipping-quote");
      return true;
    },
  );
});

test("failure in step c (earnings) stops the chain before creation", async () => {
  const { fetchImpl, calls } = mockFetch({
    origin: OK_ORIGIN,
    quote: OK_QUOTE_MULTI,
    earnings: { ok: false, status: 500, body: { message: "calc failed" } },
  });

  await assert.rejects(
    () => createDropiOrderCO({ token: "t", input: baseInput(), fetchImpl, logger: silentLogger }),
    (error: unknown) => {
      assert.ok(error instanceof DropiOrderCreationError);
      assert.equal(error.step, "earnings");
      return true;
    },
  );

  // No create call was made.
  assert.equal(calls.length, 3);
  assert.ok(!calls.some((c) => c.url.includes("myorders")));
});

test("failure in step d (create) surfaces a clear create error", async () => {
  const { fetchImpl } = mockFetch({
    origin: OK_ORIGIN,
    quote: OK_QUOTE_MULTI,
    earnings: OK_EARNINGS,
    create: { ok: false, status: 400, body: { message: "invalid order" } },
  });

  await assert.rejects(
    () => createDropiOrderCO({ token: "t", input: baseInput(), fetchImpl, logger: silentLogger }),
    (error: unknown) => {
      assert.ok(error instanceof DropiOrderCreationError);
      assert.equal(error.step, "create");
      return true;
    },
  );
});

test("create response without objects.id is a clear create error", async () => {
  const { fetchImpl } = mockFetch({
    origin: OK_ORIGIN,
    quote: OK_QUOTE_MULTI,
    earnings: OK_EARNINGS,
    create: { body: { isSuccess: true, objects: { status: "PENDIENTE CONFIRMACION" } } },
  });

  await assert.rejects(
    () => createDropiOrderCO({ token: "t", input: baseInput(), fetchImpl, logger: silentLogger }),
    (error: unknown) => {
      assert.ok(error instanceof DropiOrderCreationError);
      assert.equal(error.step, "create");
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Orchestration: captcha handling
// ---------------------------------------------------------------------------

test("captcha-required response throws the distinct DropiCaptchaRequiredError", async () => {
  const { fetchImpl } = mockFetch({
    origin: OK_ORIGIN,
    quote: OK_QUOTE_MULTI,
    earnings: OK_EARNINGS,
    create: { ok: false, status: 403, body: { message: "captcha token required" } },
  });

  await assert.rejects(
    () => createDropiOrderCO({ token: "t", input: baseInput(), fetchImpl, logger: silentLogger }),
    (error: unknown) => {
      assert.ok(error instanceof DropiCaptchaRequiredError);
      assert.ok(error instanceof DropiOrderCreationError); // still a subclass
      assert.equal(error.step, "create");
      return true;
    },
  );
});

test("network error is wrapped with the step that failed", async () => {
  const fetchImpl: DropiFetch = async () => {
    throw new Error("ECONNRESET");
  };

  await assert.rejects(
    () => createDropiOrderCO({ token: "t", input: baseInput(), fetchImpl, logger: silentLogger }),
    (error: unknown) => {
      assert.ok(error instanceof DropiOrderCreationError);
      assert.equal(error.step, "origin-city");
      assert.match(error.message, /ECONNRESET/);
      return true;
    },
  );
});

test("missing token fails fast without any HTTP call", async () => {
  let called = false;
  const fetchImpl: DropiFetch = async () => {
    called = true;
    return jsonResponse({ body: {} });
  };

  await assert.rejects(
    () => createDropiOrderCO({ token: "  ", input: baseInput(), fetchImpl, logger: silentLogger }),
    (error: unknown) => error instanceof DropiOrderCreationError,
  );

  assert.equal(called, false);
});
