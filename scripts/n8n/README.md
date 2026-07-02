# n8n maintenance scripts

## Dropi Polling -> CRM webhook

`patch-dropi-polling-webhook.mjs` patches exactly these two n8n workflows:

- Dropi Polling (CO): `9p1gvbDxdYqugkMT`
- Dropi Polling MX: `BQ7G5rSntIoszmJ3`

The script adds or updates the `Notificar backend CRM` HTTP Request node after `Actualizar orden Supabase`, so n8n keeps extracting data while this backend owns the task decision logic described in `AGENTS.md`.

It also turns the existing Dropi polling cycle into the free-tier reconciliation mechanism while Vercel Cron is paused on the Hobby plan. The polling schedule remains unchanged (5x/day), but the script patches `Traer ordenes activas Supabase` to fetch `tarea_generada_para_estado` and patches `Comparar y filtrar cambios` so orders are re-notified when `tarea_generada_para_estado` is out of sync with the live Dropi status, even if the status did not newly change since the previous poll.

The script also adds a parallel wallet-capture branch from `Dropi Consultar Wallet`:

- `Mapear movimientos wallet completo`: maps every wallet movement in the Dropi wallet response `objects` array that has `order_id`.
- `Insertar movimientos wallet`: bulk inserts the mapped array into Supabase `wallet_movements` with `Prefer: resolution=ignore-duplicates,return=minimal`.

This branch runs alongside the existing `Procesar movimientos wallet` → `Actualizar liquidacion` / `Actualizar devolucion` chain. It does not replace or modify that existing order-field update flow. `wallet_movements` classification happens through `identification_code` and `wallet_movement_catalog`, not by matching unstable `description` text.

`/api/cron/reconcile-tasks` remains available in the backend and can be scheduled again later if the Vercel account moves to Pro.

## Required env vars

- `N8N_BASE_URL`: your self-hosted n8n instance base URL.
- `N8N_API_KEY`: generated in n8n Settings → n8n API.
- `WEBHOOK_SHARED_SECRET`: the same secret already configured in Vercel or `.env.local` for the backend webhook.
- `BACKEND_WEBHOOK_URL`: optional override for preview/staging tests. Defaults to `https://crm.pakora.online/api/webhooks/orders/status-changed`.

## Commands

Dry run first:

```bash
node scripts/n8n/patch-dropi-polling-webhook.mjs
```

Apply after reviewing the dry-run summary:

```bash
node scripts/n8n/patch-dropi-polling-webhook.mjs --confirm
```

This script is manual maintenance, not automatic or scheduled. Re-run it manually if the webhook URL, shared secret, reconciliation field, wallet capture mapping, Supabase wallet endpoint, or target node names ever change.

After applying, manually re-test both workflows in n8n with a manual execution and confirm the new `Notificar backend CRM` node fires correctly and the new wallet branch inserts `wallet_movements` without duplicating rows on repeat runs.
