# Pakora WhatsApp Bridge

Standalone Node.js service that links Alejo's WhatsApp account and forwards new 1:1 text messages to the CRM webhook. It is not part of the Next.js/Vercel deployment.

## Security

This service intentionally pins the official package only:

- Package: `@whiskeysockets/baileys`
- Version: `7.0.0-rc13`

At the time this bridge was created, npm's `latest` tag points to that v7 release candidate. The official Baileys security policy marks 7.x as the supported line and marks all versions below 7 as unmaintained. Do **not** substitute similarly named packages, including `lotusbail`.

The `auth_session/` folder is equivalent to a long-lived WhatsApp credential. It is ignored by Git; never commit, share, or upload it.

## Prerequisites

- Node.js 20 or later (Node 22+ recommended).
- A real WhatsApp account on Alejo's phone.
- The CRM's `WHATSAPP_BRIDGE_SECRET` value.

## Install and configure

```bash
cd whatsapp-bridge
cp .env.example .env
```

Set `WHATSAPP_BRIDGE_SECRET` in `.env` to the exact same value configured in the CRM. Leave `CRM_WEBHOOK_URL` at its production default, or change it to a local webhook URL for testing.

```bash
npm install
npm run build
npm start
```

## Link WhatsApp with QR

On first start, the service prints a QR code in the terminal. On Alejo's phone:

1. Open WhatsApp.
2. Go to **Settings / Menu → Linked devices**.
3. Choose **Link a device**.
4. Scan the terminal QR code.

WhatsApp normally closes the first socket after the scan so it can reconnect with the saved credentials. The bridge handles that reconnect automatically. Once the log says the connection is open, it is listening.

Credentials are saved under `auth_session/`. Stop and restart the service with `npm start`; it should reconnect without another QR scan. Only delete that directory if the WhatsApp session was deliberately logged out and you need to link it again.

## What gets forwarded

Only live incoming 1:1 messages are processed:

- Never messages sent by the linked account.
- Never group, broadcast, status, or non-phone JIDs.
- Text messages, plus captions on supported image/video/document messages.
- Media-only messages are skipped and reported in the live console.

The bridge posts `{ telefono, mensaje }` to `CRM_WEBHOOK_URL` with the `x-webhook-secret` header. It logs connection changes and forwarding outcomes without writing message content to files.

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
