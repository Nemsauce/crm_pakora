# Migracion historica Dropi (pedidos + wallet)

`patch-dropi-migracion-historical.mjs` patches exactly these two n8n workflows:

- Dropi migracion (CO): `YrWPu8mLMLCalkFa`
- Dropi migracion MEX: `EBAU2dcasgMNFHDV`

This is a one-time maintenance script for the final historical load. It is not scheduled automation and should not be treated like the ongoing polling patch script.

## What it changes

The script updates `Dropi Consultar Historico` in both migration workflows so historical orders are fetched from `2026-03-01` through today's date, using n8n HTTP Request native pagination instead of only the first result page.

### Windowing and the dynamic last window

Dropi's API caps each historical query at 85 days, so the full `2026-03-01` -> today range is split into multiple `Ventana N` window nodes, each spanning at most `MAX_WINDOW_SPAN_DAYS` (85) days, chained in sequence.

Every window's `from`/`until` used to be static dates computed once, at the moment the patch script was run, then baked as literal query-param values into the n8n workflow. That is fine for every window except the *last* one: its `until` is meant to represent "today," but once frozen into the workflow it stays stuck on whatever day the script happened to run. If the actual migration execution in n8n happens on a later day than the patch, or the workflow is simply re-run again days later without re-patching first, that last window silently stops short of the current date and misses everything in between — this is exactly what happened when a run's last window ended at `2026-07-02` instead of picking up `2026-07-03`'s orders: not a date-math bug, just the expected behavior of a static value baked in at patch time.

The fix: only the **last** computed window's `until` is now a live n8n expression, evaluated at actual workflow-execution time instead of patch-script-run time:

```
{{ $now.setZone('America/Bogota').toFormat('yyyy-MM-dd') }}
```

Explicitly pinned to `America/Bogota` (matching the script's own `getTodayDateString()` used to compute window boundaries), independent of whatever timezone the n8n instance or workflow happens to be configured with. Every earlier window keeps its static `until` date, since those windows' end dates are fixed points in the past and never need to move. This means the migration workflows can be re-run on any future day and the last window will always pick up everything through that day, without needing to re-run this patch script first.

In the dry-run/`--confirm` output, the computed-windows summary marks the last window's `until` as "static reference only" and shows the dynamic expression that actually gets embedded in the node URL; the per-node URL printed below it shows the real, patched value.

### Fecha historica en hora local de Alejo

Dropi returns order `created_at` values as UTC timestamps with a `Z` suffix, for example `2026-07-04T01:44:45.000000Z`. Splitting that raw value at `T` stores the UTC calendar day, which can be one day ahead of Alejo's local Colombia date for late-night orders.

`Preparar datos historico` now normalizes `orders.fecha` to Alejo's local date reference for both countries by applying a fixed UTC-5 offset before extracting `YYYY-MM-DD`. This is intentional for both CO and MX: the CRM uses one consistent Colombia-local business date, not each customer's local timezone.

It also adds a new wallet historical branch that did not exist in these migration workflows:

```text
Dropi Consultar Wallet Historico
  -> Mapear movimientos wallet completo
  -> Insertar movimientos wallet
```

That branch runs in parallel with the existing historical orders branch. It does not add the CRM webhook node, because these one-time migration workflows only load historical data; task generation should happen through the normal reconciliation mechanism after the data exists in Supabase.

Wallet movements are mapped by `identification_code` and inserted into `wallet_movements` with `?on_conflict=pais,id_movimiento_dropi`, so re-running the migration workflow can safely ignore duplicate movements.

## Required env vars

- `N8N_BASE_URL`: your self-hosted n8n instance base URL.
- `N8N_API_KEY`: generated in n8n Settings -> n8n API.

`WEBHOOK_SHARED_SECRET` is not required for this script.

## Required Supabase wipe first

Before triggering these migration workflows in n8n, Alejo must first run the Supabase wipe SQL:

```sql
009_wipe_para_migracion_limpia.sql
```

Do not trigger the historical migration workflows before that wipe. Running them on top of existing partial/test data can create duplicate or conflicting historical state, especially around orders, status history, tasks, and wallet rows.

## Commands

Dry run first:

```bash
node --env-file=.env.local scripts/n8n/patch-dropi-migracion-historical.mjs
```

Apply after reviewing the dry-run summary:

```bash
node --env-file=.env.local scripts/n8n/patch-dropi-migracion-historical.mjs --confirm
```

After applying, inspect both workflows in n8n before running the actual migration executions. Confirm that `Dropi Consultar Historico` has pagination enabled and that the new wallet branch appears in parallel with the orders branch.
