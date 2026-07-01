# n8n maintenance scripts

## Dropi Polling -> CRM webhook

`patch-dropi-polling-webhook.mjs` patches exactly these two n8n workflows:

- Dropi Polling (CO): `9p1gvbDxdYqugkMT`
- Dropi Polling MX: `BQ7G5rSntIoszmJ3`

The script adds or updates the `Notificar backend CRM` HTTP Request node after `Actualizar orden Supabase`, so n8n keeps extracting data while this backend owns the task decision logic described in `AGENTS.md`.

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

This script is manual maintenance, not automatic or scheduled. Re-run it manually if the webhook URL, shared secret, or target node names ever change.

After applying, manually re-test both workflows in n8n with a manual execution and confirm the new `Notificar backend CRM` node fires correctly.
