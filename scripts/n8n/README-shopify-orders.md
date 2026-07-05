# Shopify Orders — `pais` and `fecha` fixes

## Bug 1: missing `pais`

Neither `Shopify Orders (CO)` (`R6yGZIKxVCWfJaq9`) nor `Shopify Orders MX` (`oYYHzqRXCjNfPGks`) ever included a `pais` field in the `jsonBody` of their `Insertar orden Supabase1` node. `orders.pais` is `NOT NULL` in the schema, so every insert attempted by these two workflows fails at that node with:

```
23502 — null value in column "pais" of relation "orders" violates not-null constraint
```

Because the webhook node responds to Shopify immediately on receipt (before the downstream Supabase insert runs), Shopify sees a successful delivery regardless of what happens afterward in the workflow — so from Shopify's side the webhook looks delivered while the order never reaches Supabase. This is a day-one bug: the `jsonBody` template for both workflows was built without a `pais` literal from the start, it predates this session's other Shopify-workflow fixes (webhook reactivation, notification wiring, etc.), and it likely went unnoticed because these workflows historically saw little real order traffic until now.

## Bug 2: UTC conversion in `fecha`

The `Mapear orden Shopify` node calculated `fecha` by parsing Shopify's `created_at` / `processed_at` value through `new Date(...)` and then extracting the date from `toISOString()`. Shopify already sends these timestamps with their local offset, for example `2026-06-15T22:46:46-05:00`; converting to UTC before splitting the date can move late-night local orders one day ahead.

The correct CRM `orders.fecha` for Shopify orders is the local calendar date carried by Shopify's raw ISO timestamp. The script now patches `Mapear orden Shopify` in both workflows to use the first 10 characters of the selected ISO string:

```js
fecha = String(fechaRaw).slice(0, 10);
```

The final fallback chain is `order.created_at`, then `order.processed_at`, then `new Date().toISOString()`. All three produce ISO-compatible strings where the first 10 characters are the intended `YYYY-MM-DD` date.

## The fix

`patch-shopify-orders-pais.mjs` patches exactly these two workflows' `Insertar orden Supabase1` node, adding the missing literal field immediately after the existing `"activo": true` field in the `jsonBody` JSON template string:

- CO: adds `"pais": "CO"`
- MX: adds `"pais": "MX"`

The same script also patches exactly these two workflows' `Mapear orden Shopify` node, replacing only the `fecha` calculation block so it extracts the local date directly from Shopify's raw ISO string instead of round-tripping through UTC. The matcher handles both current live variants: the CO block with the full fallback chain and the older MX block that only checked `order.created_at`.

No task-creation, comment-insertion, or unrelated mapping logic in either workflow is touched.

The script is idempotent: if `"pais":` is already present in the `jsonBody` with the expected value, it reports `confirmed` for that part. If the `fecha` calculation is already fixed, it reports `confirmed` / already patched for that part. If either field is present in an unexpected shape, the script stops with an error instead of silently overwriting it — that case needs manual review.

Before writing, the script validates the patched `jsonBody` string structurally (starts with the `={` expression prefix, ends with `}`, balanced brace count, no dangling trailing comma before the closing brace) to catch a bad splice before it ever reaches n8n.

Follows the same conventions as the other scripts in this directory: GET/PUT via the n8n REST API, `active` is never included in the PUT payload (n8n rejects it), and `workflow.settings` is filtered down to the same allow-listed key set before being sent back.

## Required env vars

- `N8N_BASE_URL`: your self-hosted n8n instance base URL.
- `N8N_API_KEY`: generated in n8n Settings → n8n API.

## Commands

Dry run first:

```bash
node scripts/n8n/patch-shopify-orders-pais.mjs
```

Apply after reviewing the dry-run summary:

```bash
node scripts/n8n/patch-shopify-orders-pais.mjs --confirm
```

After applying, manually trigger (or wait for) a real Shopify order in both CO and MX and confirm the resulting row lands in `orders` with the correct `pais` value.

## New order notifications

The same script also wires new-order notifications (in-app + Telegram) for both workflows, additively:

- **`Insertar orden Supabase1` Prefer header**: the script checks the node's current `Prefer` header. If it already includes `return=representation`, nothing changes (`confirmed`). Otherwise the script rewrites only the `return=` directive to `return=representation` — any other Prefer directive already present (e.g. `resolution=merge-duplicates`) is preserved — or appends `Prefer: return=representation` if the header was missing entirely. This is required so the node's response includes the newly inserted row's `id`, which the new notification node needs.
- **`Notificar pedido nuevo` node**: a new HTTP Request node (POST) is added, calling `https://crm.pakora.online/api/webhooks/orders/new-order` with header `x-webhook-secret` (from `WEBHOOK_SHARED_SECRET`) and JSON body `{ "order_id": <id from "Insertar orden Supabase1" response> }`, following the same header/body conventions already used for `Notificar backend CRM` in `patch-dropi-polling-webhook.mjs`.
- **Connection**: `Insertar orden Supabase1` → `Notificar pedido nuevo` is added in parallel with the existing `Insertar orden Supabase1` → `Crear tarea confirmacion` connection. Neither that connection nor the `Crear tarea confirmacion` / `Insertar comentario` nodes are touched.

The script is idempotent for this addition too: if `Notificar pedido nuevo` already exists with the expected parameters and the connection is already present, both report `confirmed`.

### Additional required env var

- `WEBHOOK_SHARED_SECRET`: same shared secret already used by the backend webhook routes (`x-webhook-secret` header), used here for the new `Notificar pedido nuevo` node.
- `NEW_ORDER_WEBHOOK_URL` (optional): overrides the default `https://crm.pakora.online/api/webhooks/orders/new-order` target.
