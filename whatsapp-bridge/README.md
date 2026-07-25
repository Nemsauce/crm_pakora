# Pakora WhatsApp Bridge

Standalone Node.js service that links one WhatsApp account per process and forwards its 1:1 messages to the CRM. It is not part of the Next.js/Vercel deployment.

## Security

This service intentionally pins the official package only:

- Package: `@whiskeysockets/baileys`
- Version: `7.0.0-rc13`

At the time this bridge was created, npm's `latest` tag points to that v7 release candidate. The official Baileys security policy marks 7.x as the supported line and marks all versions below 7 as unmaintained. Do **not** substitute similarly named packages, including `lotusbail`.

Each `auth_session/<account-label>/` folder is equivalent to a long-lived WhatsApp credential. The parent `auth_session/` folder is ignored by Git; never commit, share, or upload it.

## Prerequisites

- Node.js 20 or later (Node 22+ recommended).
- A real WhatsApp account on Alejo's phone for each bridge instance you run.
- The CRM's `WHATSAPP_BRIDGE_SECRET` value.

## Install and configure

```bash
cd whatsapp-bridge
cp .env.example .env
```

Set `WHATSAPP_BRIDGE_SECRET` in `.env` to the exact same value configured in the CRM. `WHATSAPP_ACCOUNT_LABEL` is required and must be unique per local instance (for example `CO` or `MX`). It controls only the local credential folder and log prefix; it is not sent to the CRM. Leave `CRM_WEBHOOK_URL` at its production default, or change it to a local webhook URL for testing.

```bash
npm install
npm run build
npm start
```

## Run CO and MX together

Run one process per WhatsApp account in separate terminals. Both use the same CRM webhook endpoints; only their local labels and credential folders differ.

With one shared `.env` for the secret/webhook URL, pass the label when starting each process (the shell value takes precedence over the `.env` default):

```bash
# Terminal 1: Colombia WhatsApp account
WHATSAPP_ACCOUNT_LABEL=CO npm start

# Terminal 2: Mexico WhatsApp account
WHATSAPP_ACCOUNT_LABEL=MX npm start
```

This creates and uses independent credentials at `auth_session/CO/` and `auth_session/MX/`. A single bridge remains supported: start just one process with one label, for example `WHATSAPP_ACCOUNT_LABEL=CO npm start`.

If you keep separate environment files for the accounts, export the corresponding `WHATSAPP_ACCOUNT_LABEL` before starting its terminal. The bridge always loads `.env` as a fallback, so the shell label is the simplest way to select an instance.

## Link WhatsApp with QR

On the first start for each account label, the service prints a QR code in that terminal. Scan the CO terminal's QR with the CO WhatsApp account and the MX terminal's QR with the MX WhatsApp account. On the corresponding phone:

1. Open WhatsApp.
2. Go to **Settings / Menu → Linked devices**.
3. Choose **Link a device**.
4. Scan the terminal QR code.

WhatsApp normally closes the first socket after the scan so it can reconnect with the saved credentials. The bridge handles that reconnect automatically. Once the log says the connection is open, it is listening.

Credentials are saved under `auth_session/<account-label>/`. Stop and restart that same labeled process with `npm start`; it should reconnect without another QR scan. Only delete the specific label folder if that WhatsApp session was deliberately logged out and you need to link it again; do not delete the other account's folder.

## What gets forwarded

All instances use the same CRM endpoints, regardless of their account label:

- Incoming live 1:1 messages go to `whatsapp-incoming` (`CRM_WEBHOOK_URL`).
- Outgoing live 1:1 messages sent by the linked account go to `whatsapp-outgoing`.
- WhatsApp history sync batches go to `whatsapp-history` without generating new drafts.

The label is deliberately not sent to the CRM because matching is based on the customer's phone number. For live messages, the bridge processes:

- Incoming and outgoing messages from a 1:1 chat.
- Never group, broadcast, status, or non-phone JIDs.
- Text messages, plus captions on supported image/video/document messages.
- Media-only messages are skipped and reported in the live console.

The bridge uses the same `x-webhook-secret` header for all CRM calls. It logs connection changes and forwarding outcomes without writing message content to files; logs are prefixed with the account label, for example `[whatsapp-bridge:CO]`.

## Keep it running

The bridge must run continuously to receive messages. For a temporary session, leave `npm start` running in a persistent terminal or `screen`/tmux session. For a managed process on Alejo's PC, PM2 is a practical option:

```bash
npm install --global pm2
pm2 start npm --name pakora-whatsapp-bridge -- run start
pm2 save
```

Check live activity with:

```bash
pm2 logs pakora-whatsapp-bridge
```
