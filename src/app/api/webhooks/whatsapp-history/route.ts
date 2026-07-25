import { timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 60;

type HistoricalMessageDirection = "entrante" | "saliente";

type HistoricalWhatsAppMessage = {
  telefono: string;
  mensaje: string;
  direccion: HistoricalMessageDirection;
  ocurrido_en: string;
  message_id?: string;
};

type NormalizedHistoricalWhatsAppMessage = HistoricalWhatsAppMessage & {
  ocurrido_en: string;
};

type WhatsAppOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "id" | "telefono"
>;

type BackfillError = {
  index: number;
  stage: "match" | "deduplicate" | "insert";
  error: string;
};

const PHONE_SUFFIX_LENGTH = 10;
const PHONE_MATCH_PAGE_SIZE = 1_000;
const DEDUPLICATION_WINDOW_MS = 10_000;

function isValidSecret(receivedSecret: string | null) {
  const expectedSecret = process.env.WHATSAPP_BRIDGE_SECRET;

  if (!receivedSecret || !expectedSecret) {
    return false;
  }

  const received = Buffer.from(receivedSecret);
  const expected = Buffer.from(expectedSecret);
  const maxLength = Math.max(received.length, expected.length);

  if (received.length !== expected.length) {
    const paddedReceived = Buffer.alloc(maxLength);
    const paddedExpected = Buffer.alloc(maxLength);

    received.copy(paddedReceived);
    expected.copy(paddedExpected);
    timingSafeEqual(paddedReceived, paddedExpected);

    return false;
  }

  return timingSafeEqual(received, expected);
}

function isHistoricalMessageDirection(
  value: unknown,
): value is HistoricalMessageDirection {
  return value === "entrante" || value === "saliente";
}

function normalizeHistoricalMessage(
  value: unknown,
): NormalizedHistoricalWhatsAppMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const message = value as Record<string, unknown>;

  if (
    typeof message.telefono !== "string" ||
    typeof message.mensaje !== "string" ||
    !isHistoricalMessageDirection(message.direccion) ||
    typeof message.ocurrido_en !== "string" ||
    (message.message_id !== undefined &&
      typeof message.message_id !== "string")
  ) {
    return null;
  }

  const telefono = message.telefono.trim();
  const mensaje = message.mensaje.trim();
  const messageId = message.message_id?.trim();
  const timestamp = Date.parse(message.ocurrido_en);

  if (!telefono || !mensaje || Number.isNaN(timestamp)) {
    return null;
  }

  return {
    telefono,
    mensaje,
    direccion: message.direccion,
    ocurrido_en: new Date(timestamp).toISOString(),
    ...(messageId ? { message_id: messageId } : {}),
  };
}

function normalizeHistoricalMessages(
  value: unknown,
):
  | { messages: NormalizedHistoricalWhatsAppMessage[] }
  | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Body must be an object with a messages array" };
  }

  const messages = (value as Record<string, unknown>).messages;

  if (!Array.isArray(messages)) {
    return { error: "messages must be an array" };
  }

  const normalizedMessages: NormalizedHistoricalWhatsAppMessage[] = [];

  for (const [index, message] of messages.entries()) {
    const normalizedMessage = normalizeHistoricalMessage(message);

    if (!normalizedMessage) {
      return {
        error:
          `messages[${index}] must include non-empty telefono and mensaje, ` +
          "direccion ('entrante' or 'saliente'), a valid ocurrido_en timestamp, " +
          "and an optional string message_id",
      };
    }

    normalizedMessages.push(normalizedMessage);
  }

  return { messages: normalizedMessages };
}

function getPhoneSuffix(telefono: string | null) {
  const digits = telefono?.replace(/\D/g, "") ?? "";

  return digits.length >= PHONE_SUFFIX_LENGTH
    ? digits.slice(-PHONE_SUFFIX_LENGTH)
    : null;
}

function getPhoneSearchPattern(phoneSuffix: string) {
  return `%${phoneSuffix.split("").join("%")}%`;
}

async function findMatchingOrder(
  supabase: SupabaseClient<Database>,
  telefono: string,
): Promise<WhatsAppOrder | null> {
  const phoneSuffix = getPhoneSuffix(telefono);

  if (!phoneSuffix) {
    return null;
  }

  const phoneSearchPattern = getPhoneSearchPattern(phoneSuffix);

  for (let from = 0; ; from += PHONE_MATCH_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("orders")
      .select("id,telefono")
      .ilike("telefono", phoneSearchPattern)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PHONE_MATCH_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const candidates = (data ?? []) as WhatsAppOrder[];
    const order = candidates.find(
      (candidate) => getPhoneSuffix(candidate.telefono) === phoneSuffix,
    );

    if (order) {
      return order;
    }

    if (candidates.length < PHONE_MATCH_PAGE_SIZE) {
      return null;
    }
  }
}

function getWhatsAppMessagesClient() {
  // WhatsApp message tables were migrated after the generated database types.
  // Keep this cast local until those types are refreshed.
  return createAdminClient() as unknown as SupabaseClient;
}

function getTimestampWindow(ocurridoEn: string) {
  const timestamp = Date.parse(ocurridoEn);

  return {
    from: new Date(timestamp - DEDUPLICATION_WINDOW_MS).toISOString(),
    to: new Date(timestamp + DEDUPLICATION_WINDOW_MS).toISOString(),
  };
}

async function historicalMessageExists(
  supabase: SupabaseClient,
  message: NormalizedHistoricalWhatsAppMessage,
) {
  const phoneSuffix = getPhoneSuffix(message.telefono);

  if (!phoneSuffix) {
    return false;
  }

  const phoneSearchPattern = getPhoneSearchPattern(phoneSuffix);
  const { from, to } = getTimestampWindow(message.ocurrido_en);

  if (message.direccion === "entrante") {
    const { data, error } = await supabase
      .from("whatsapp_mensajes_entrantes")
      .select("id,telefono_origen")
      .ilike("telefono_origen", phoneSearchPattern)
      .eq("mensaje_cliente", message.mensaje)
      .gte("recibido_en", from)
      .lte("recibido_en", to);

    if (error) {
      throw error;
    }

    return Boolean(
      data?.some(
        (candidate) =>
          getPhoneSuffix(candidate.telefono_origen) === phoneSuffix,
      ),
    );
  }

  const { data, error } = await supabase
    .from("whatsapp_mensajes_salientes")
    .select("id,telefono_destino")
    .ilike("telefono_destino", phoneSearchPattern)
    .eq("mensaje_enviado", message.mensaje)
    .gte("enviado_en", from)
    .lte("enviado_en", to);

  if (error) {
    throw error;
  }

  return Boolean(
    data?.some(
      (candidate) =>
        getPhoneSuffix(candidate.telefono_destino) === phoneSuffix,
    ),
  );
}

async function storeHistoricalMessage(
  supabase: SupabaseClient,
  orderId: number,
  message: NormalizedHistoricalWhatsAppMessage,
) {
  if (message.direccion === "entrante") {
    const { error } = await supabase
      .from("whatsapp_mensajes_entrantes")
      .insert({
        order_id: orderId,
        telefono_origen: message.telefono,
        mensaje_cliente: message.mensaje,
        sugerencia_ia: null,
        recibido_en: message.ocurrido_en,
      });

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from("whatsapp_mensajes_salientes")
    .insert({
      order_id: orderId,
      telefono_destino: message.telefono,
      mensaje_enviado: message.mensaje,
      enviado_en: message.ocurrido_en,
    });

  if (error) {
    throw error;
  }
}

function getBatchDeduplicationKey(
  message: NormalizedHistoricalWhatsAppMessage,
) {
  return JSON.stringify([
    message.direccion,
    message.telefono,
    message.mensaje,
  ]);
}

function getBatchMessageIdKey(
  message: NormalizedHistoricalWhatsAppMessage,
) {
  return message.message_id
    ? JSON.stringify([
        message.direccion,
        message.telefono,
        message.message_id,
      ])
    : null;
}

function isDuplicateWithinBatch(
  message: NormalizedHistoricalWhatsAppMessage,
  timestampsByKey: Map<string, number[]>,
  messageIds: Set<string>,
) {
  const messageIdKey = getBatchMessageIdKey(message);

  if (messageIdKey && messageIds.has(messageIdKey)) {
    return true;
  }

  const timestamps =
    timestampsByKey.get(getBatchDeduplicationKey(message)) ?? [];
  const timestamp = Date.parse(message.ocurrido_en);

  return timestamps.some(
    (existingTimestamp) =>
      Math.abs(existingTimestamp - timestamp) <= DEDUPLICATION_WINDOW_MS,
  );
}

function rememberBatchMessage(
  message: NormalizedHistoricalWhatsAppMessage,
  timestampsByKey: Map<string, number[]>,
  messageIds: Set<string>,
) {
  const deduplicationKey = getBatchDeduplicationKey(message);
  const timestamps = timestampsByKey.get(deduplicationKey) ?? [];

  timestamps.push(Date.parse(message.ocurrido_en));
  timestampsByKey.set(deduplicationKey, timestamps);

  const messageIdKey = getBatchMessageIdKey(message);

  if (messageIdKey) {
    messageIds.add(messageIdKey);
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: NextRequest) {
  if (!isValidSecret(request.headers.get("x-webhook-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = normalizeHistoricalMessages(body);

  if ("error" in parsedBody) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 });
  }

  const supabase = createAdminClient();
  const messagesClient = getWhatsAppMessagesClient();
  const orderCache = new Map<string, WhatsAppOrder | null>();
  const timestampsByBatchKey = new Map<string, number[]>();
  const batchMessageIds = new Set<string>();
  const errors: BackfillError[] = [];
  let matched = 0;
  let inserted = 0;
  let duplicates = 0;
  let unmatched = 0;

  for (const [index, message] of parsedBody.messages.entries()) {
    const phoneSuffix = getPhoneSuffix(message.telefono);
    const orderCacheKey = phoneSuffix ?? `invalid:${message.telefono}`;
    let order = orderCache.get(orderCacheKey);

    try {
      if (order === undefined) {
        order = await findMatchingOrder(supabase, message.telefono);
        orderCache.set(orderCacheKey, order);
      }
    } catch (error) {
      errors.push({
        index,
        stage: "match",
        error: getErrorMessage(error),
      });
      continue;
    }

    if (!order) {
      unmatched += 1;
      continue;
    }

    matched += 1;

    if (
      isDuplicateWithinBatch(
        message,
        timestampsByBatchKey,
        batchMessageIds,
      )
    ) {
      duplicates += 1;
      continue;
    }

    try {
      if (await historicalMessageExists(messagesClient, message)) {
        duplicates += 1;
        rememberBatchMessage(
          message,
          timestampsByBatchKey,
          batchMessageIds,
        );
        continue;
      }
    } catch (error) {
      errors.push({
        index,
        stage: "deduplicate",
        error: getErrorMessage(error),
      });
      continue;
    }

    try {
      await storeHistoricalMessage(messagesClient, order.id, message);
      inserted += 1;
      rememberBatchMessage(
        message,
        timestampsByBatchKey,
        batchMessageIds,
      );
    } catch (error) {
      errors.push({
        index,
        stage: "insert",
        error: getErrorMessage(error),
      });
    }
  }

  return NextResponse.json(
    {
      found: parsedBody.messages.length,
      matched,
      inserted,
      duplicates,
      unmatched,
      failed: errors.length,
      errors,
    },
    { status: errors.length > 0 ? 207 : 200 },
  );
}
