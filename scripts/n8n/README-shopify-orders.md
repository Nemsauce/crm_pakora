# Shopify Orders — missing `pais` fix

## The bug

Neither `Shopify Orders (CO)` (`R6yGZIKxVCWfJaq9`) nor `Shopify Orders MX` (`oYYHzqRXCjNfPGks`) ever included a `pais` field in the `jsonBody` of their `Insertar orden Supabase1` node. `orders.pais` is `NOT NULL` in the schema, so every insert attempted by these two workflows fails at that node with:

```
23502 — null value in column "pais" of relation "orders" violates not-null constraint
```

Because the webhook node responds to Shopify immediately on receipt (before the downstream Supabase insert runs), Shopify sees a successful delivery regardless of what happens afterward in the workflow — so from Shopify's side the webhook looks delivered while the order never reaches Supabase. This is a day-one bug: the `jsonBody` template for both workflows was built without a `pais` literal from the start, it predates this session's other Shopify-workflow fixes (webhook reactivation, notification wiring, etc.), and it likely went unnoticed because these workflows historically saw little real order traffic until now.

## The fix

`patch-shopify-orders-pais.mjs` patches exactly these two workflows' `Insertar orden Supabase1` node, adding the missing literal field immediately after the existing `"activo": true` field in the `jsonBody` JSON template string:

- CO: adds `"pais": "CO"`
- MX: adds `"pais": "MX"`

No other node, mapping, task-creation, or comment-insertion logic in either workflow is touched.

The script is idempotent: if `"pais":` is already present in the `jsonBody` with the expected value, it reports `confirmed` and makes no change. If it's present with an unexpected value, the script stops with an error instead of silently overwriting it — that case needs manual review.

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
