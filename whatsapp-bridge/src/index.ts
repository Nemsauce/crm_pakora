import path from "node:path";
import { fileURLToPath } from "node:url";

import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  getContentType,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isLidUser,
  jidDecode,
  normalizeMessageContent,
  toNumber,
  useMultiFileAuthState,
  type BaileysEventMap,
  type WAMessage,
} from "@whiskeysockets/baileys";
import dotenv from "dotenv";
import pino from "pino";
import QRCode from "qrcode";

const DEFAULT_INCOMING_WEBHOOK_URL =
  "https://crm.pakora.online/api/webhooks/whatsapp-incoming";
const OUTGOING_WEBHOOK_PATH = "/api/webhooks/whatsapp-outgoing";
const HISTORY_WEBHOOK_PATH = "/api/webhooks/whatsapp-history";
const RECONNECT_DELAY_MS = 3_000;
const REQUEST_TIMEOUT_MS = 15_000;
const HISTORY_REQUEST_TIMEOUT_MS = 45_000;
const RECENT_MESSAGE_ID_CACHE_SIZE = 1_000;
const HISTORY_BACKFILL_BATCH_SIZE = 25;
const HISTORY_BACKFILL_MAX_ATTEMPTS = 3;
const HISTORY_BACKFILL_RETRY_DELAY_MS = 1_000;
const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(CURRENT_DIR, "..");
const AUTH_SESSION_DIR = path.join(PROJECT_DIR, "auth_session");

dotenv.config({ path: path.join(PROJECT_DIR, ".env") });

const bridgeSecret = process.env.WHATSAPP_BRIDGE_SECRET?.trim();
const incomingWebhookUrl = (
  process.env.CRM_WEBHOOK_URL ?? DEFAULT_INCOMING_WEBHOOK_URL
).trim();
let outgoingWebhookUrl = "";
let historyWebhookUrl = "";

if (!bridgeSecret) {
  console.error(
    "[whatsapp-bridge] WHATSAPP_BRIDGE_SECRET is required. Copy .env.example to .env and set it before starting.",
  );
  process.exit(1);
}

const webhookSecret = bridgeSecret;

function parseHttpWebhookUrl(webhookUrl: string) {
  const parsedWebhookUrl = new URL(webhookUrl);

  if (
    parsedWebhookUrl.protocol !== "https:" &&
    parsedWebhookUrl.protocol !== "http:"
  ) {
    throw new Error("unsupported protocol");
  }

  return parsedWebhookUrl;
}

try {
  const parsedIncomingWebhookUrl = parseHttpWebhookUrl(incomingWebhookUrl);
  const configuredOutgoingWebhookUrl =
    process.env.CRM_OUTGOING_WEBHOOK_URL?.trim();
  const configuredHistoryWebhookUrl =
    process.env.CRM_HISTORY_WEBHOOK_URL?.trim();

  outgoingWebhookUrl = configuredOutgoingWebhookUrl
    ? parseHttpWebhookUrl(configuredOutgoingWebhookUrl).toString()
    : new URL(OUTGOING_WEBHOOK_PATH, parsedIncomingWebhookUrl).toString();
  historyWebhookUrl = configuredHistoryWebhookUrl
    ? parseHttpWebhookUrl(configuredHistoryWebhookUrl).toString()
    : new URL(HISTORY_WEBHOOK_PATH, parsedIncomingWebhookUrl).toString();
} catch {
  console.error(
    "[whatsapp-bridge] CRM_WEBHOOK_URL, CRM_OUTGOING_WEBHOOK_URL and CRM_HISTORY_WEBHOOK_URL must be absolute HTTP(S) URLs.",
  );
  process.exit(1);
}

let reconnectTimer: NodeJS.Timeout | undefined;
let isConnecting = false;
let isStopping = false;
let isHistoryWebhookReady = false;
type WhatsAppSocket = ReturnType<typeof makeWASocket>;
type HistorySetEvent = BaileysEventMap["messaging-history.set"];
let activeSocket: WhatsAppSocket | undefined;
let historyBackfillQueue: Promise<void> = Promise.resolve();
const recentlyForwardedMessageIds = new Set<string>();
const historyBackfillTotals = {
  events: 0,
  chatsObserved: 0,
  messagesObserved: 0,
  eligible: 0,
  matched: 0,
  inserted: 0,
  duplicates: 0,
  unmatched: 0,
  failed: 0,
  oldestObservedAt: null as number | null,
  newestObservedAt: null as number | null,
};

function rememberForwardedMessageId(messageId: string) {
  recentlyForwardedMessageIds.add(messageId);

  if (recentlyForwardedMessageIds.size > RECENT_MESSAGE_ID_CACHE_SIZE) {
    const oldestMessageId = recentlyForwardedMessageIds.values().next().value;

    if (oldestMessageId) {
      recentlyForwardedMessageIds.delete(oldestMessageId);
    }
  }
}

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

function getConversationPhone(message: WAMessage) {
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

type MessageDirection = "entrante" | "saliente";

type HistoricalMessagePayload = {
  telefono: string;
  mensaje: string;
  direccion: MessageDirection;
  ocurrido_en: string;
  message_id?: string;
};

type HistoryBackfillResult = {
  found: number;
  matched: number;
  inserted: number;
  duplicates: number;
  unmatched: number;
  failed: number;
  errors: Array<{
    index: number;
    stage: "match" | "deduplicate" | "insert";
    error: string;
  }>;
};

type HistoryBackfillOutcome = Pick<
  HistoryBackfillResult,
  "matched" | "inserted" | "duplicates" | "unmatched" | "failed"
>;

function getHistorySyncTypeName(syncType: number | null | undefined) {
  const syncTypeNames: Record<number, string> = {
    0: "INITIAL_BOOTSTRAP",
    1: "INITIAL_STATUS_V3",
    2: "FULL",
    3: "RECENT",
    4: "PUSH_NAME",
    5: "NON_BLOCKING_DATA",
    6: "ON_DEMAND",
  };

  return syncType === null || syncType === undefined
    ? "desconocido"
    : (syncTypeNames[syncType] ?? String(syncType));
}

function getMessageTimestamp(message: WAMessage) {
  const timestampSeconds = toNumber(message.messageTimestamp);

  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
    return null;
  }

  const timestamp = new Date(timestampSeconds * 1_000);

  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function isUnsupportedHistoryJid(jid: string | null | undefined) {
  return Boolean(
    jid &&
      (isJidGroup(jid) || isJidBroadcast(jid) || isJidNewsletter(jid)),
  );
}

async function getHistoricalConversationPhone(
  socket: WhatsAppSocket,
  message: WAMessage,
  history: HistorySetEvent,
) {
  const candidateJids = [
    message.key.remoteJidAlt,
    message.key.remoteJid,
  ].filter((jid): jid is string => Boolean(jid));

  if (
    candidateJids.length === 0 ||
    candidateJids.some(isUnsupportedHistoryJid)
  ) {
    return null;
  }

  for (const jid of candidateJids) {
    const phone = getPhoneFromJid(jid);

    if (phone) {
      return phone;
    }
  }

  for (const jid of candidateJids) {
    const mapping = history.lidPnMappings?.find(
      ({ lid }) => lid === jid,
    );
    const mappedPhone = getPhoneFromJid(mapping?.pn);

    if (mappedPhone) {
      return mappedPhone;
    }

    const contact = history.contacts.find(
      ({ id, lid }) => id === jid || lid === jid,
    );
    const contactPhone =
      getPhoneFromJid(contact?.phoneNumber) ??
      getPhoneFromJid(contact?.id);

    if (contactPhone) {
      return contactPhone;
    }
  }

  for (const jid of candidateJids) {
    if (!isLidUser(jid)) {
      continue;
    }

    try {
      const mappedJid =
        await socket.signalRepository.lidMapping.getPNForLID(jid);
      const mappedPhone = getPhoneFromJid(mappedJid);

      if (mappedPhone) {
        return mappedPhone;
      }
    } catch (error) {
      logError("No se pudo resolver un LID histórico a teléfono", error);
    }
  }

  return null;
}

function isHistoryBackfillResult(
  value: unknown,
  expectedFound: number,
): value is HistoryBackfillResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const result = value as Record<string, unknown>;

  const hasValidCounts = [
    "found",
    "matched",
    "inserted",
    "duplicates",
    "unmatched",
    "failed",
  ].every(
    (field) =>
      typeof result[field] === "number" &&
      Number.isInteger(result[field]) &&
      result[field] >= 0,
  );

  if (
    !hasValidCounts ||
    result.found !== expectedFound ||
    !Array.isArray(result.errors)
  ) {
    return false;
  }

  const seenErrorIndexes = new Set<number>();

  const hasValidErrors = result.errors.every((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const error = value as Record<string, unknown>;
    const isValidIndex =
      typeof error.index === "number" &&
      Number.isInteger(error.index) &&
      error.index >= 0 &&
      error.index < expectedFound &&
      !seenErrorIndexes.has(error.index);

    if (isValidIndex) {
      seenErrorIndexes.add(error.index as number);
    }

    return (
      isValidIndex &&
      (error.stage === "match" ||
        error.stage === "deduplicate" ||
        error.stage === "insert") &&
      typeof error.error === "string"
    );
  });
  const validatedResult = result as unknown as HistoryBackfillResult;

  if (
    !hasValidErrors ||
    validatedResult.failed !== validatedResult.errors.length ||
    validatedResult.inserted +
      validatedResult.duplicates +
      validatedResult.unmatched +
      validatedResult.failed !==
      expectedFound
  ) {
    return false;
  }

  const matchedFailures = validatedResult.errors.filter(
    (error) => error.stage !== "match",
  ).length;

  return (
    validatedResult.matched ===
    validatedResult.inserted +
      validatedResult.duplicates +
      matchedFailures
  );
}

async function forwardMessage(
  destinationWebhookUrl: string,
  telefono: string,
  mensaje: string,
  direction: MessageDirection,
) {
  try {
    const response = await fetch(destinationWebhookUrl, {
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
        `No se pudo reenviar mensaje ${direction} de ${redactPhone(telefono)}: CRM respondió HTTP ${response.status}.`,
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
      `Mensaje ${direction} de ${redactPhone(telefono)} reenviado al CRM${matched === null ? "" : ` (pedido coincidente: ${matched ? "sí" : "no"})`}.`,
    );
  } catch (error) {
    logError(
      `Error al reenviar mensaje ${direction} de ${redactPhone(telefono)} al CRM`,
      error,
    );
  }
}

async function backfillHistoricalMessages(
  messages: HistoricalMessagePayload[],
) {
  const response = await fetch(historyWebhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-secret": webhookSecret,
    },
    body: JSON.stringify({ messages }),
    signal: AbortSignal.timeout(HISTORY_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`CRM respondió HTTP ${response.status}`);
  }

  const result: unknown = await response.json().catch(() => null);

  if (!isHistoryBackfillResult(result, messages.length)) {
    throw new Error("el CRM devolvió una respuesta de backfill inválida");
  }

  return result;
}

function waitForHistoryRetry(attempt: number) {
  return new Promise<void>((resolve) => {
    setTimeout(
      resolve,
      HISTORY_BACKFILL_RETRY_DELAY_MS * attempt,
    );
  });
}

async function backfillHistoricalMessagesWithRetry(
  messages: HistoricalMessagePayload[],
): Promise<HistoryBackfillOutcome> {
  let pendingMessages = messages;
  const outcome: HistoryBackfillOutcome = {
    matched: 0,
    inserted: 0,
    duplicates: 0,
    unmatched: 0,
    failed: 0,
  };

  for (
    let attempt = 1;
    attempt <= HISTORY_BACKFILL_MAX_ATTEMPTS;
    attempt += 1
  ) {
    let result: HistoryBackfillResult;

    try {
      result = await backfillHistoricalMessages(pendingMessages);
    } catch (error) {
      if (attempt === HISTORY_BACKFILL_MAX_ATTEMPTS) {
        outcome.failed += pendingMessages.length;
        logError(
          `El lote histórico agotó ${HISTORY_BACKFILL_MAX_ATTEMPTS} intentos`,
          error,
        );
        return outcome;
      }

      logError(
        `Intento ${attempt}/${HISTORY_BACKFILL_MAX_ATTEMPTS} del lote histórico falló; se reintentará`,
        error,
      );
      await waitForHistoryRetry(attempt);
      continue;
    }

    outcome.inserted += result.inserted;
    outcome.duplicates += result.duplicates;
    outcome.unmatched += result.unmatched;
    outcome.matched += result.inserted + result.duplicates;

    if (result.failed === 0) {
      return outcome;
    }

    const failedMessages = result.errors.map(
      ({ index }) => pendingMessages[index],
    );

    if (attempt === HISTORY_BACKFILL_MAX_ATTEMPTS) {
      outcome.failed += failedMessages.length;
      outcome.matched += result.errors.filter(
        ({ stage }) => stage !== "match",
      ).length;
      return outcome;
    }

    log(
      `El CRM reportó ${failedMessages.length} mensajes fallidos en el intento ${attempt}/${HISTORY_BACKFILL_MAX_ATTEMPTS}; se reintentará solo ese subconjunto.`,
    );
    pendingMessages = failedMessages;
    await waitForHistoryRetry(attempt);
  }

  return outcome;
}

async function handleHistorySet(
  socket: WhatsAppSocket,
  history: HistorySetEvent,
) {
  const {
    chats,
    messages,
    syncType,
    progress,
    chunkOrder,
    isLatest,
  } = history;
  const observedTimestamps = messages
    .map(getMessageTimestamp)
    .filter((timestamp): timestamp is Date => timestamp !== null)
    .sort((left, right) => left.getTime() - right.getTime());
  const oldestObserved = observedTimestamps.at(0);
  const newestObserved = observedTimestamps.at(-1);
  const syncDescription = [
    `tipo=${getHistorySyncTypeName(syncType)}`,
    `chunk=${chunkOrder ?? "n/d"}`,
    `progreso=${progress ?? "n/d"}`,
    `último=${isLatest === undefined ? "n/d" : isLatest ? "sí" : "no"}`,
  ].join(", ");

  historyBackfillTotals.events += 1;
  historyBackfillTotals.chatsObserved += chats.length;
  historyBackfillTotals.messagesObserved += messages.length;

  if (
    oldestObserved &&
    (historyBackfillTotals.oldestObservedAt === null ||
      oldestObserved.getTime() < historyBackfillTotals.oldestObservedAt)
  ) {
    historyBackfillTotals.oldestObservedAt = oldestObserved.getTime();
  }

  if (
    newestObserved &&
    (historyBackfillTotals.newestObservedAt === null ||
      newestObserved.getTime() > historyBackfillTotals.newestObservedAt)
  ) {
    historyBackfillTotals.newestObservedAt = newestObserved.getTime();
  }

  log(
    `messaging-history.set recibido (${syncDescription}): ${chats.length} chats y ${messages.length} mensajes; rango observado ${oldestObserved?.toISOString() ?? "sin fecha válida"} — ${newestObserved?.toISOString() ?? "sin fecha válida"}.`,
  );

  const eventMessageIds = new Set<string>();
  const eligibleMessages: Array<{
    deduplicationId: string;
    payload: HistoricalMessagePayload;
  }> = [];
  let skippedWithoutText = 0;
  let skippedWithoutTimestamp = 0;
  let skippedWithoutDirection = 0;
  let skippedWithoutPhone = 0;
  let skippedDuplicateInEvent = 0;

  for (const message of messages) {
    const { text } = getMessageText(message);

    if (!text) {
      skippedWithoutText += 1;
      continue;
    }

    const timestamp = getMessageTimestamp(message);

    if (!timestamp) {
      skippedWithoutTimestamp += 1;
      continue;
    }

    if (typeof message.key.fromMe !== "boolean") {
      skippedWithoutDirection += 1;
      continue;
    }

    const telefono = await getHistoricalConversationPhone(
      socket,
      message,
      history,
    );

    if (!telefono) {
      skippedWithoutPhone += 1;
      continue;
    }

    const direccion: MessageDirection = message.key.fromMe
      ? "saliente"
      : "entrante";
    const messageId = message.key.id?.trim() || undefined;
    const deduplicationId = messageId
      ? `${direccion}:${telefono}:${messageId}`
      : `${direccion}:${telefono}:${timestamp.toISOString()}:${text}`;

    if (eventMessageIds.has(deduplicationId)) {
      skippedDuplicateInEvent += 1;
      continue;
    }

    eventMessageIds.add(deduplicationId);
    eligibleMessages.push({
      deduplicationId,
      payload: {
        telefono,
        mensaje: text,
        direccion,
        ocurrido_en: timestamp.toISOString(),
        ...(messageId ? { message_id: messageId } : {}),
      },
    });
  }

  eligibleMessages.sort(
    (left, right) =>
      Date.parse(left.payload.ocurrido_en) -
      Date.parse(right.payload.ocurrido_en),
  );
  historyBackfillTotals.eligible += eligibleMessages.length;

  let matched = 0;
  let inserted = 0;
  let duplicates = 0;
  let unmatched = 0;
  let failed = 0;

  for (
    let offset = 0;
    offset < eligibleMessages.length;
    offset += HISTORY_BACKFILL_BATCH_SIZE
  ) {
    const batch = eligibleMessages.slice(
      offset,
      offset + HISTORY_BACKFILL_BATCH_SIZE,
    );

    try {
      const result = await backfillHistoricalMessagesWithRetry(
        batch.map(({ payload }) => payload),
      );

      matched += result.matched;
      inserted += result.inserted;
      duplicates += result.duplicates;
      unmatched += result.unmatched;
      failed += result.failed;
    } catch (error) {
      failed += batch.length;
      logError(
        `No se pudo procesar el lote histórico ${Math.floor(offset / HISTORY_BACKFILL_BATCH_SIZE) + 1}`,
        error,
      );
    }
  }

  historyBackfillTotals.matched += matched;
  historyBackfillTotals.inserted += inserted;
  historyBackfillTotals.duplicates += duplicates;
  historyBackfillTotals.unmatched += unmatched;
  historyBackfillTotals.failed += failed;

  log(
    `Backfill del evento terminado: encontrados=${messages.length}, elegibles=${eligibleMessages.length}, coincidentes_con_pedido=${matched}, insertados=${inserted}, duplicados=${duplicates}, sin_pedido=${unmatched}, fallidos=${failed}, omitidos_sin_texto=${skippedWithoutText}, omitidos_sin_fecha=${skippedWithoutTimestamp}, omitidos_sin_dirección=${skippedWithoutDirection}, omitidos_sin_teléfono_1a1=${skippedWithoutPhone}, duplicados_en_el_evento=${skippedDuplicateInEvent}.`,
  );
  log(
    `Backfill acumulado: eventos=${historyBackfillTotals.events}, chats_observados=${historyBackfillTotals.chatsObserved}, mensajes_observados=${historyBackfillTotals.messagesObserved}, rango_observado=${historyBackfillTotals.oldestObservedAt === null ? "sin fecha válida" : new Date(historyBackfillTotals.oldestObservedAt).toISOString()} — ${historyBackfillTotals.newestObservedAt === null ? "sin fecha válida" : new Date(historyBackfillTotals.newestObservedAt).toISOString()}, elegibles=${historyBackfillTotals.eligible}, coincidentes_con_pedido=${historyBackfillTotals.matched}, insertados=${historyBackfillTotals.inserted}, duplicados=${historyBackfillTotals.duplicates}, sin_pedido=${historyBackfillTotals.unmatched}, fallidos=${historyBackfillTotals.failed}.`,
  );
}

async function handleMessage(message: WAMessage, upsertType: string) {
  if (upsertType !== "notify") {
    log("Mensaje omitido: pertenece a historial/sincronización, no a una notificación nueva.");
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

  const telefono = getConversationPhone(message);

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

  const direction: MessageDirection = message.key.fromMe
    ? "saliente"
    : "entrante";
  const messageId = message.key.id;
  const deduplicationId = messageId ? `${direction}:${messageId}` : null;

  if (!deduplicationId) {
    log(
      `Mensaje de ${redactPhone(telefono)} no incluye un ID único; se reenviará sin deduplicación.`,
    );
  } else if (recentlyForwardedMessageIds.has(deduplicationId)) {
    log(
      `Mensaje ${direction} duplicado de ${redactPhone(telefono)} omitido (ID: ${messageId}).`,
    );
    return;
  } else {
    // Baileys puede reemitir una notificación durante reenvíos o sincronizaciones.
    // Marcarla antes de esperar el POST evita dos envíos concurrentes del mismo mensaje.
    rememberForwardedMessageId(deduplicationId);
  }

  log(
    `Mensaje ${direction} de ${redactPhone(telefono)} recibido; reenviando al CRM.`,
  );
  await forwardMessage(
    direction === "saliente" ? outgoingWebhookUrl : incomingWebhookUrl,
    telefono,
    text,
    direction,
  );
}

async function connectToWhatsApp() {
  if (isConnecting || isStopping) {
    return;
  }

  isConnecting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_SESSION_DIR);

    if (!isHistoryWebhookReady) {
      await backfillHistoricalMessages([]);
      isHistoryWebhookReady = true;
      log(
        "Webhook de historial verificado antes de abrir la conexión de WhatsApp.",
      );
    }

    const { version, isLatest } = await fetchLatestBaileysVersion();
    const socket = makeWASocket({
      auth: state,
      version,
      browser: Browsers.macOS("Desktop"),
      logger: pino({ level: "silent" }),
      markOnlineOnConnect: false,
      syncFullHistory: true,
      // Baileys 7.0.0-rc13 excludes FULL chunks by default even when the
      // linked device requests them. Accept every processable history phase.
      shouldSyncHistoryMessage: () => true,
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
        log(
          "Estado de conexión: abierta. Escuchando mensajes 1:1 y sincronizaciones de historial.",
        );
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
        void handleMessage(message, type).catch((error) => {
          logError("Error al procesar un mensaje de WhatsApp", error);
        });
      }
    });

    socket.ev.on("messaging-history.set", (history) => {
      // Los chunks pueden llegar muy seguidos. Serializarlos evita carreras
      // entre consultas de deduplicación e inserciones del mismo historial.
      historyBackfillQueue = historyBackfillQueue
        .then(() => handleHistorySet(socket, history))
        .catch((error) => {
          logError(
            "Error al procesar messaging-history.set",
            error,
          );
        });
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
