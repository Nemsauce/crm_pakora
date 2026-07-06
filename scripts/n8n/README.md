# n8n maintenance scripts

## Dropi Polling -> CRM webhook

`patch-dropi-polling-webhook.mjs` patches exactly these two n8n workflows:

- Dropi Polling (CO): `9p1gvbDxdYqugkMT`
- Dropi Polling MX: `BQ7G5rSntIoszmJ3`

The script adds or updates the `Notificar backend CRM` HTTP Request node after `Actualizar orden Supabase`, so n8n keeps extracting data while this backend owns the task decision logic described in `AGENTS.md`.

It also turns the existing Dropi polling cycle into the free-tier reconciliation mechanism while Vercel Cron is paused on the Hobby plan. The polling schedule remains unchanged (5x/day), but the script patches `Traer ordenes activas Supabase` to fetch `tarea_generada_para_estado` and patches `Comparar y filtrar cambios` so orders are re-notified when `tarea_generada_para_estado` is out of sync with the live Dropi status, even if the status did not newly change since the previous poll.

The script also patches the same polling workflows to catch fast status transitions that happen between polling cycles. `Traer ordenes activas Supabase` now embeds the latest `status_history.registrado_en` row for each active order using a single PostgREST request (`status_history(registrado_en)` ordered desc and limited to 1). `Comparar y filtrar cambios` compares Dropi's `history[]` against that timestamp and emits `historiaFaltante`, preserving the existing single-state output fields.

The full-history branch is additive and does not replace the existing single-state chain:

- Existing chain, kept connected: `Comparar y filtrar cambios` → `Actualizar orden Supabase` → `Notificar backend CRM`.
- New branch: `Comparar y filtrar cambios` → `Filtrar historial faltante` → `Procesar historial completo`.

`Filtrar historial faltante` drops items with no missing history entries so `Procesar historial completo` only calls `POST https://crm.pakora.online/api/webhooks/orders/process-history` when there is a non-empty sequence to replay. The request body is `{ order_id, history }`, where each history item is mapped to `{ estado, transportadora, novedad, registrado_en }`. The backend replays the sequence chronologically and closes any generated tasks if the sequence ends in a closing state.

It patches `Actualizar orden Supabase` to send its JSON body through `JSON.stringify(...)` instead of manual string interpolation. This avoids production failures when real Dropi values contain quotes, backslashes, line breaks, or other characters that would otherwise produce invalid JSON.

It also patches `Registrar historial` to use the same `JSON.stringify(...)` body pattern and to persist `novedad` from `Comparar y filtrar cambios`. The compare node already computes that field, but the history insert previously dropped it before Supabase, so status history rows could not surface the latest novelty detail in the app.

The script also adds a parallel wallet-capture branch from `Dropi Consultar Wallet`:

- `Mapear movimientos wallet completo`: maps every wallet movement in the Dropi wallet response `objects` array that has `order_id`.
- `Insertar movimientos wallet`: bulk inserts the mapped array into Supabase `wallet_movements` with `Prefer: resolution=ignore-duplicates,return=minimal` and `?on_conflict=pais,id_movimiento_dropi`.

This branch runs alongside the existing `Procesar movimientos wallet` → `Actualizar liquidacion` / `Actualizar devolucion` chain. It does not replace or modify that existing order-field update flow. `wallet_movements` classification happens through `identification_code` and `wallet_movement_catalog`, not by matching unstable `description` text.

The `on_conflict` query parameter is required because the idempotency target is the composite unique constraint `(pais, id_movimiento_dropi)`, not the primary key. Without it, PostgREST can still return duplicate-key `409` errors even when the `Prefer` header is present.

The script also adds one CO-only periodic stale-order check:

- `Chequear pedidos estancados`: HTTP GET to `https://crm.pakora.online/api/cron/check-stale-orders` with `Authorization: Bearer <CRON_SECRET>`.

This node is connected from `Dropi Login Final` in the CO polling workflow (`9p1gvbDxdYqugkMT`) and runs in parallel with the other branches. It does not depend on Dropi's live order payload; it only uses the polling schedule as a free-tier cron substitute. The endpoint scans all active orders across both countries, so adding the same node to MX would only double-fire the same idempotent check when both polling workflows run close together. For that reason, the script explicitly skips this node for `Dropi Polling MX` and reports `skipped-co-only` in dry-run output.

`/api/cron/reconcile-tasks` remains available in the backend and can be scheduled again later if the Vercel account moves to Pro.

The script also normalizes the live MX orders query date window for `Dropi Consultar Pedidos`. `Dropi Polling MX` previously had a frozen URL window (`from=2026-05-01&until=2026-06-27`), so orders created after June 27, 2026 were invisible to ongoing polling. The patch is MX-only and idempotent: it rewrites only `from`/`until` to match CO's working rolling 30-day n8n expression and ensures the URL starts with `=` so n8n evaluates the `{{ }}` expressions at execution time.

The script also enables native n8n pagination on the live `Dropi Consultar Pedidos` nodes for both CO and MX. Dropi's live endpoint is paged by `result_number`/`start`; without n8n pagination the polling workflows could only ever see the first 50 matching orders per run. The patch uses the same `updateAParameterInEachRequest` shape already verified in the historical migration workflow, increments `start` by `result_number`, stops when `objects.length < result_number`, caps live polling at 20 requests per country, and waits 500ms between requests. Because n8n pagination emits one item per fetched page, `Comparar y filtrar cambios` is also patched to read every item from `Dropi Consultar Pedidos` and flatten all `objects` arrays before matching against Supabase orders.

## Required env vars

- `N8N_BASE_URL`: your self-hosted n8n instance base URL.
- `N8N_API_KEY`: generated in n8n Settings → n8n API.
- `WEBHOOK_SHARED_SECRET`: the same secret already configured in Vercel or `.env.local` for the backend webhook.
- `CRON_SECRET`: the same secret already configured in Vercel or `.env.local` for protected cron endpoints.
- `BACKEND_WEBHOOK_URL`: optional override for preview/staging tests. Defaults to `https://crm.pakora.online/api/webhooks/orders/status-changed`.
- `PROCESS_HISTORY_WEBHOOK_URL`: optional override for preview/staging tests. Defaults to `https://crm.pakora.online/api/webhooks/orders/process-history`.

## Commands

Dry run first:

```bash
node scripts/n8n/patch-dropi-polling-webhook.mjs
```

Apply after reviewing the dry-run summary:

```bash
node scripts/n8n/patch-dropi-polling-webhook.mjs --confirm
```

This script is manual maintenance, not automatic or scheduled. Re-run it manually if the webhook URL, process-history webhook URL, shared secret, cron secret, reconciliation field, active-order history select, wallet capture mapping, Supabase wallet endpoint, stale-order cron endpoint, MX live-order date window, live Dropi orders pagination, `Registrar historial` history payload, or target node names ever change.

After applying, manually re-test both workflows in n8n with a manual execution. Confirm the new `Notificar backend CRM` node fires correctly, MX `Dropi Consultar Pedidos` evaluates the rolling 30-day date window instead of sending literal `{{ }}` text, both `Dropi Consultar Pedidos` nodes fetch beyond the first page when Dropi returns a full page, `Comparar y filtrar cambios` sees orders from all fetched pages, `Registrar historial` inserts `status_history.novedad` when Dropi provides it, `Procesar historial completo` calls the backend only for items with non-empty `historiaFaltante`, the new wallet branch inserts `wallet_movements` without duplicating rows on repeat runs, and the CO-only `Chequear pedidos estancados` node receives an authorized response from the backend cron endpoint.
