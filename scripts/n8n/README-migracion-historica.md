# Migracion historica Dropi (pedidos + wallet)

`patch-dropi-migracion-historical.mjs` patches exactly these two n8n workflows:

- Dropi migracion (CO): `YrWPu8mLMLCalkFa`
- Dropi migracion MEX: `EBAU2dcasgMNFHDV`

This is a one-time maintenance script for the final historical load. It is not scheduled automation and should not be treated like the ongoing polling patch script.

## What it changes

The script updates `Dropi Consultar Historico` in both migration workflows so historical orders are fetched from `2026-03-01` through today's date, using n8n HTTP Request native pagination instead of only the first result page.

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
