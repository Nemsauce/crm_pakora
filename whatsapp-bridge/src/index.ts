import path from "node:path";
import { fileURLToPath } from "node:url";

import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  getContentType,
  isJidGroup,
  jidDecode,
  normalizeMessageContent,
  useMultiFileAuthState,
  type WAMessage,
} from "@whiskeysockets/baileys";
import dotenv from "dotenv";
import pino from "pino";
import QRCode from "qrcode";

const DEFAULT_WEBHOOK_URL =
  "https://crm.pakora.online/api/webhooks/whatsapp-incoming";
const RECONNECT_DELAY_MS = 3_000;
const REQUEST_TIMEOUT_MS = 15_000;
const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(CURRENT_DIR, "..");
const AUTH_SESSION_DIR = path.join(PROJECT_DIR, "auth_session");

dotenv.config({ path: path.join(PROJECT_DIR, ".env") });

const bridgeSecret = process.env.WHATSAPP_BRIDGE_SECRET?.trim();
const webhookUrl = (process.env.CRM_WEBHOOK_URL ?? DEFAULT_WEBHOOK_URL).trim();

if (!bridgeSecret) {
  console.error(
    "[whatsapp-bridge] WHATSAPP_BRIDGE_SECRET is required. Copy .env.example to .env and set it before starting.",
  );
  process.exit(1);
}

const webhookSecret = bridgeSecret;

try {
  const parsedWebhookUrl = new URL(webhookUrl);

  if (
    parsedWebhookUrl.protocol !== "https:" &&
    parsedWebhookUrl.protocol !== "http:"
  ) {
    throw new Error("unsupported protocol");
  }
} catch {
  console.error(
    "[whatsapp-bridge] CRM_WEBHOOK_URL must be an absolute HTTP(S) URL.",
  );
  process.exit(1);
}

let reconnectTimer: NodeJS.Timeout | undefined;
let isConnecting = false;
let isStopping = false;
let activeSocket: ReturnType<typeof makeWASocket> | undefined;

function log(message: string) {
  console.log(
    `[whatsapp-bridge] ${new Date().toISOString()} ${message}`,
  );
}

function logError(context: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[whatsapp-bridge] ${context}: ${detail}`);
}

function redactPhone(phone: string) {
  if (phone.length <= 4) {
    return "****";
  }

  return `***${phone.slice(-4)}`;
}

function getDisconnectStatusCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const output = (error as { output?: unknown }).output;

  if (!output || typeof output !== "object") {
    return null;
  }

  const statusCode = (output as { statusCode?: unknown }).statusCode;

  return typeof statusCode === "number" ? statusCode : null;
}

function getPhoneFromJid(jid: string | null | undefined) {
  if (!jid?.endsWith("@s.whatsapp.net")) {
    return null;
  }

  const decoded = jidDecode(jid);

  if (decoded?.user) {
    return decoded.user;
  }

  return jid.slice(0, -"@s.whatsapp.net".length).split(":")[0] || null;
}

function getSenderPhone(message: WAMessage) {
  return (
    getPhoneFromJid(message.key.remoteJid) ??
    getPhoneFromJid(message.key.remoteJidAlt)
  );
}

function getMessageText(message: WAMessage) {
  const content = normalizeMessageContent(message.message);

  if (!content) {
    return { text: null, type: "sin contenido" };
  }

  const text = [
    content.conversation,
    content.extendedTextMessage?.text,
    content.imageMessage?.caption,
    content.videoMessage?.caption,
    content.documentMessage?.caption,
    content.buttonsResponseMessage?.selectedDisplayText,
    content.listResponseMessage?.title,
  ].find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );

  return {
    text: text?.trim() ?? null,
    type: getContentType(content) ?? "tipo desconocido",
  };
}

function scheduleReconnect(reason: string) {
  if (isStopping || reconnectTimer) {
    return;
  }

  log(
    `Reconectando en ${RECONNECT_DELAY_MS / 1_000}s (${reason}).`,
  );
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    void connectToWhatsApp();
  }, RECONNECT_DELAY_MS);
}

async function renderQrCode(qr: string) {
  try {
    const terminalQr = await QRCode.toString(qr, {
      type: "terminal",
      small: true,
    });

    console.log(terminalQr);
    log(
      "Código QR listo. En el teléfono: WhatsApp > Dispositivos vinculados > Vincular un dispositivo.",
    );
  } catch (error) {
    logError("No se pudo renderizar el código QR", error);
  }
}

async function forwardMessage(telefono: string, mensaje: string) {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": webhookSecret,
      },
      body: JSON.stringify({ telefono, mensaje }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      log(
        `No se pudo reenviar mensaje de ${redactPhone(telefono)}: CRM respondió HTTP ${response.status}.`,
      );
      return;
    }

    const result: unknown = await response.json().catch(() => null);
    const matched =
      result &&
      typeof result === "object" &&
      "matched" in result &&
      typeof result.matched === "boolean"
        ? result.matched
        : null;

    log(
      `Mensaje de ${redactPhone(telefono)} reenviado al CRM${matched === null ? "" : ` (pedido coincidente: ${matched ? "sí" : "no"})`}.`,
    );
  } catch (error) {
    logError(
      `Error al reenviar mensaje de ${redactPhone(telefono)} al CRM`,
      error,
    );
  }
}

async function handleIncomingMessage(message: WAMessage, upsertType: string) {
  if (upsertType !== "notify") {
    log("Mensaje omitido: pertenece a historial/sincronización, no a una notificación nueva.");
    return;
  }

  if (message.key.fromMe) {
    log("Mensaje omitido: fue enviado desde la cuenta vinculada.");
    return;
  }

  const remoteJid = message.key.remoteJid;

  if (!remoteJid) {
    log("Mensaje omitido: no incluye un chat de origen.");
    return;
  }

  if (isJidGroup(remoteJid)) {
    log("Mensaje omitido: proviene de un grupo.");
    return;
  }

  const telefono = getSenderPhone(message);

  if (!telefono) {
    log("Mensaje omitido: el chat directo no expone un JID de teléfono.");
    return;
  }

  const { text, type } = getMessageText(message);

  if (!text) {
    log(
      `Mensaje de ${redactPhone(telefono)} omitido: ${type} sin texto ni pie de foto.`,
    );
    return;
  }

  log(
    `Mensaje entrante de ${redactPhone(telefono)} recibido; reenviando al CRM.`,
  );
  await forwardMessage(telefono, text);
}

async function connectToWhatsApp() {
  if (isConnecting || isStopping) {
    return;
  }

  isConnecting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_SESSION_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    const socket = makeWASocket({
      auth: state,
      version,
      browser: Browsers.ubuntu("Pakora WhatsApp Bridge"),
      logger: pino({ level: "silent" }),
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

    activeSocket = socket;
    log(
      `Conectando con el protocolo de WhatsApp Web ${version.join(".")}${isLatest ? "" : " (se detectó una versión de protocolo más reciente)"}.`,
    );

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        void renderQrCode(qr);
      }

      if (connection === "connecting") {
        log("Estado de conexión: conectando.");
        return;
      }

      if (connection === "open") {
        log("Estado de conexión: abierta. Escuchando mensajes 1:1.");
        return;
      }

      if (connection !== "close" || activeSocket !== socket) {
        return;
      }

      activeSocket = undefined;
      const statusCode = getDisconnectStatusCode(lastDisconnect?.error);

      if (statusCode === DisconnectReason.loggedOut) {
        log(
          "La sesión fue cerrada deliberadamente en WhatsApp. No se reconectará; borra auth_session/ y vuelve a escanear el QR para vincularla de nuevo.",
        );
        return;
      }

      log(
        `Estado de conexión: cerrada${statusCode === null ? "" : ` (código ${statusCode})`}.`,
      );
      scheduleReconnect("desconexión no deliberada");
    });

    socket.ev.on("messages.upsert", ({ messages, type }) => {
      for (const message of messages) {
        void handleIncomingMessage(message, type).catch((error) => {
          logError("Error al procesar un mensaje entrante", error);
        });
      }
    });
  } catch (error) {
    logError("No se pudo iniciar la conexión con WhatsApp", error);
    scheduleReconnect("fallo al inicializar");
  } finally {
    isConnecting = false;
  }
}

function stopBridge(signal: string) {
  if (isStopping) {
    return;
  }

  isStopping = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  log(`Señal ${signal} recibida. Deteniendo el bridge.`);
  process.exit(0);
}

process.once("SIGINT", () => stopBridge("SIGINT"));
process.once("SIGTERM", () => stopBridge("SIGTERM"));

void connectToWhatsApp();
