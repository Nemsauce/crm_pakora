# Dropi Order Creation (CO) — source of truth

- Country: **Colombia (CO) only** — the MX equivalent has not been captured.
- Captured at: `2026-07-19` from a real customer order (COD / cash-on-delivery).
- Capture source: browser HAR of the Dropi web app (`https://app.dropi.co`) creating one real order.
- Endpoint: `POST https://api.dropi.co/api/orders/myorders` — **same URL as the read/list endpoint** documented in [`dropi-polling-source-of-truth.md`](./dropi-polling-source-of-truth.md); the two are differentiated **only by HTTP method** (`GET` lists, `POST` creates).

> This document was reverse-engineered from a single captured HAR. It describes exactly what was observed. Fields, endpoints, and behaviors that were **not** observed are marked `unknown, needs further capture` rather than guessed at.

## Redaction policy

The JWT session token that appears in the `x-authorization: Bearer <token>` header is redacted everywhere as `<REDACTED_SESSION_TOKEN>`. No other secrets appear in this document. All non-secret values (field names, endpoints, IDs from the capture, status strings, logic) are preserved verbatim.

## Key finding (the result of this research)

**`type: "FINAL_ORDER"` + `rate_type: "CON RECAUDO"` → the created order is assigned `status: "PENDIENTE CONFIRMACION"` automatically by Dropi.**

No separate call is needed to set that status. The creation response echoes it directly. This matters because the polling pipeline (`Comparar y filtrar cambios` in [`dropi-polling-source-of-truth.md`](./dropi-polling-source-of-truth.md)) treats `PENDIENTE CONFIRMACION` as the trigger for the `llamar_confirmacion` task and maps it to CRM `estado_crm = 'nuevo'`. Creating an order with this exact combination is therefore what produces a real, confirmable COD order that flows through the existing pipeline. `PENDIENTE CONFIRMACION` is a known value in the `status_catalog` table (`estado` column).

Two field values are **critical** and must not be changed for real customer orders:

- `type` must be `"FINAL_ORDER"`. `"SAMPLE_ORDER"` produces a different, non-COD flow (see [Discarded test case](#discarded-test-case)).
- `rate_type` must be `"CON RECAUDO"`. This is what makes it a COD order. `"SIN RECAUDO"` was observed producing a non-COD sample flow.

## Authentication

Same auth as every other Dropi call (see [`dropi-polling-source-of-truth.md`](./dropi-polling-source-of-truth.md) for the full login/2FA/TOTP flow that mints the session token):

- Header `x-authorization: Bearer <REDACTED_SESSION_TOKEN>`
- Header `x-captcha-token` — **present but empty/unused in this capture.**

> **Captcha risk (known gap).** The `x-captcha-token` header was empty in this capture, exactly as it is empty in all read calls. It is not confirmed that creation always works without a captcha token — creation may require a real captcha token under conditions not yet observed (e.g. rate limiting, new device, risk scoring). The `createDropiOrder` client **must treat a captcha-required response as an explicit, non-retryable error** and surface it, rather than retrying blindly.

## Required prior calls (in order, before creation)

The web app makes three preparatory calls before `POST /api/orders/myorders`. Each feeds a value into the final creation payload.

### a. `POST /api/orders/getOriginCityForCalculateShipping`

Returns the origin warehouse for the product.

Request body:

```json
{
  "id": "<product_id>",
  "destination": "<city>, <state>",
  "type": "SIMPLE"
}
```

- `id` — the product id.
- `destination` — `"<city>, <state>"` (destination city and state).
- `type` — `"SIMPLE"` or `"VARIABLE"` (product type).

Output used later: the origin warehouse — its city feeds `ciudad_remitente` in step b, and its id becomes `warehouses_selected_id` in the creation payload.

### b. `POST /api/orders/cotizaEnvioTransportadoraV2`

Returns an array of carrier quotes, each including `shipping_amount` for that carrier.

Request body includes:

- `peso`, `largo`, `ancho`, `alto` — package weight and dimensions.
- `ciudad_remitente` — the warehouse city from step a.
- `ciudad_destino` — the destination city.

> Exact/complete body shape for this call: `unknown, needs further capture` — only the fields above were confirmed present.

Output used later: the chosen carrier's `shipping_amount` becomes the top-level `shipping_amount`, and the chosen carrier becomes `distributionCompany` in the creation payload.

### c. `POST /api/orders/calculateEarnedAmound`

Returns the dropshipper earnings calculation. (Endpoint name is spelled `calculateEarnedAmound` verbatim as observed — not a typo in this doc.)

Request body includes:

- `total_order`
- `user_id`
- `supplier_id`
- `type`
- `rate_type`
- `products`
- the chosen `cotizaEnvioTransportadoraV2` result.

> Exact/complete body shape and the exact response fields for this call: `unknown, needs further capture`.

## Order creation payload

`POST https://api.dropi.co/api/orders/myorders` — full shape observed for a real COD (`FINAL_ORDER`) order:

```jsonc
{
  "total_order": 0,              // number — full sale price to be collected COD
  "notes": "",                   // string
  "name": "",                    // string
  "surname": "",                 // string
  "dir": "",                     // string — address
  "country": "COLOMBIA",         // string — e.g. "COLOMBIA"
  "state": "",                   // string
  "city": "",                    // string
  "phone": "573005113818",       // string — observed format: country code + number, no leading "+"
  "client_email": "",            // string
  "payment_method_id": 1,        // number — observed value: 1
  "user_id": 0,                  // number — the Dropi account's own user id
  "supplier_id": 0,              // number — product's supplier id
  "type": "FINAL_ORDER",         // CRITICAL: "SAMPLE_ORDER" produces a different, non-COD flow. Always FINAL_ORDER for real customer orders.
  "rate_type": "CON RECAUDO",    // CRITICAL: this is what makes it COD. "SIN RECAUDO" produced a non-COD sample flow.
  "products": [
    {
      "id": 0,                   // number — product id
      "name": "",                // string
      "weight": "",              // string
      "stock": null,             // number | null
      "variation_id": null,      // number | null — null for SIMPLE products, populated for VARIABLE
      "quantity": 1,             // number
      "price": 0,                // number
      "suggested_price": "",     // string
      "sale_price": "",          // string
      "variations": [],          // array — empty for SIMPLE products
      "type": "SIMPLE",          // "SIMPLE" | "VARIABLE"
      "user_id": 0               // number — supplier's user id, same as top-level supplier_id
    }
  ],
  "distributionCompany": {       // carrier chosen from cotizaEnvioTransportadoraV2 results
    "id": 0,                     // number
    "name": ""                   // string
  },
  "type_service": "normal",      // string — observed: "normal"
  "zip_code": null,              // null
  "colonia": "",                 // string
  "shop_id": null,               // UNKNOWN/UNCONFIRMED — see Known gaps
  "dni": "",                     // string
  "dni_type": "",                // string
  "insurance": false,            // boolean
  "shalom_data": null,           // null
  "warehouses_selected_id": 0,   // number — from getOriginCityForCalculateShipping result
  "shipping_amount": 0           // number — from cotizaEnvioTransportadoraV2 result for the chosen carrier
}
```

### Field notes

| Field | Type | Source / notes |
|---|---|---|
| `total_order` | number | Full sale price to be collected COD. |
| `notes` | string | Order notes. |
| `name` | string | Customer first name. |
| `surname` | string | Customer last name. |
| `dir` | string | Delivery address. |
| `country` | string | e.g. `"COLOMBIA"`. |
| `state` | string | Destination state. |
| `city` | string | Destination city. |
| `phone` | string | Observed format: country code + number, no leading `+` — e.g. `"573005113818"`. |
| `client_email` | string | Customer email. |
| `payment_method_id` | number | Observed value: `1`. |
| `user_id` | number | The Dropi account's own user id. |
| `supplier_id` | number | Product's supplier id. |
| `type` | string | **CRITICAL** — `"FINAL_ORDER"` for real orders. |
| `rate_type` | string | **CRITICAL** — `"CON RECAUDO"` for COD. |
| `products[].id` | number | Product id. |
| `products[].name` | string | Product name. |
| `products[].weight` | string | Product weight. |
| `products[].stock` | number \| null | Stock. |
| `products[].variation_id` | number \| null | `null` for SIMPLE, populated for VARIABLE. |
| `products[].quantity` | number | Quantity ordered. |
| `products[].price` | number | Unit price. |
| `products[].suggested_price` | string | Suggested price. |
| `products[].sale_price` | string | Sale price. |
| `products[].variations` | array | Empty for SIMPLE products. |
| `products[].type` | string | `"SIMPLE"` \| `"VARIABLE"`. |
| `products[].user_id` | number | Supplier's user id, same as top-level `supplier_id`. |
| `distributionCompany.id` | number | Chosen carrier id (from `cotizaEnvioTransportadoraV2`). |
| `distributionCompany.name` | string | Chosen carrier name. |
| `type_service` | string | Observed: `"normal"`. |
| `zip_code` | null | Observed `null`. |
| `colonia` | string | Neighborhood. |
| `shop_id` | null | **UNKNOWN/UNCONFIRMED** — see [Known gaps](#known-gaps--needs-further-verification). |
| `dni` | string | Customer national id number. |
| `dni_type` | string | Customer national id type. |
| `insurance` | boolean | Insurance flag. |
| `shalom_data` | null | Observed `null`. |
| `warehouses_selected_id` | number | From `getOriginCityForCalculateShipping` result. |
| `shipping_amount` | number | From `cotizaEnvioTransportadoraV2` result for the chosen carrier. |

## Response shape on success

```jsonc
{
  "isSuccess": true,
  "message": "El registro ha sido creado con exito!.",
  "status": 200,
  "objects": {
    "id": 0,                              // number — the new Dropi order id. STORE THIS as the Dropi order reference.
    "status": "PENDIENTE CONFIRMACION",   // CRITICAL: auto-assigned when type=FINAL_ORDER + rate_type=CON RECAUDO. No separate call needed.
    "created_from": "MANUAL",             // string
    "customer_id": 0,                     // number
    "dropshipper_amount_to_win": 0,       // number
    "discounted_amount": 0,               // number
    "is_validated": false,                // boolean
    "validation_description": "",         // string
    "created_at": ""                      // string
    // ...plus the full echoed order object (distribution_company, warehouse, orderdetails, etc.).
    // Full shape available in the raw HAR if needed later.
  }
}
```

- `objects.id` is the new Dropi order id — **this is what should be stored as the Dropi order reference** (matches `id_orden_dropi` in the CRM / Supabase `orders` table).
- `objects.status` is `"PENDIENTE CONFIRMACION"`, assigned automatically by Dropi for the `FINAL_ORDER` + `CON RECAUDO` combination — no follow-up call is required to set it.
- The `objects` object also echoes the full created order (`distribution_company`, `warehouse`, `orderdetails`, etc.); those additional fields were not exhaustively catalogued here — the raw HAR holds the complete shape.

## Discarded test case

A second capture was taken **only to confirm the status-assignment mechanism**, not as a usable flow:

- Payload: `type: "SAMPLE_ORDER"` + `rate_type: "SIN RECAUDO"`.
- Result: `status: "PENDIENTE"` (**not** `"PENDIENTE CONFIRMACION"`).
- `total_order: 0`.

This confirms that the status string is driven by the `type` + `rate_type` combination. **This combination must never be used for real customer orders** — it produces a non-COD sample order. It is documented here solely so a future engineer does not mistake it for the real flow. Nothing else about the sample flow is documented.

## Known gaps / needs further verification

- **`shop_id` real purpose is unconfirmed.** It was `null` in the capture. It is *likely* intended for linking to an external order id (e.g. a Shopify order id), but this is untested — it is not confirmed that populating it actually links the Dropi order to an external order. `unknown, needs further capture`.
- **Captcha behavior.** The behavior when `x-captcha-token` is required was not observed in either capture. It is unknown under what conditions Dropi demands a real captcha token for creation. `unknown, needs further capture`.
- **Multi-variation products.** Whether `variation_id` / the `products[]` shape differs for products with multiple variations selected together was not captured. Only a `SIMPLE` product (`variation_id: null`, `variations: []`) was observed. `unknown, needs further capture`.
- **MX equivalent.** This document is **CO-only**. The Mexico order-creation flow has not been captured. `unknown, needs further capture`.
