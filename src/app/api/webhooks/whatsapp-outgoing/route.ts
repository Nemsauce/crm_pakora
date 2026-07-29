import { timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type OutgoingWhatsAppMessage = {
  telefono: string;
  mensaje: string;
};

type WhatsAppOutgoingMessageInsert = {
  order_id: number | null;
  telefono_destino: string;
  mensaje_enviado: string;
};

type WhatsAppOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "id" | "telefono"
>;

const PHONE_SUFFIX_LENGTH = 10;
const PHONE_MATCH_PAGE_SIZE = 1_000;

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

function isOutgoingWhatsAppMessage(
  value: unknown,
): value is OutgoingWhatsAppMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const message = value as Record<string, unknown>;

  return (
    typeof message.telefono === "string" && typeof message.mensaje === "string"
  );
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
  const outgoingPhoneSuffix = getPhoneSuffix(telefono);

  if (!outgoingPhoneSuffix) {
    return null;
  }

  const phoneSearchPattern = getPhoneSearchPattern(outgoingPhoneSuffix);

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

    const candidates = data ?? [];
    const order = candidates.find(
      (candidate) =>
        getPhoneSuffix(candidate.telefono) === outgoingPhoneSuffix,
    );

    if (order) {
      return order;
    }

    if (candidates.length < PHONE_MATCH_PAGE_SIZE) {
      return null;
    }
  }
}

function getWhatsAppOutgoingMessagesClient() {
  return createAdminClient();
}

async function storeOutgoingMessage(message: WhatsAppOutgoingMessageInsert) {
  const { error } = await getWhatsAppOutgoingMessagesClient()
    .from("whatsapp_mensajes_salientes")
    .insert(message);

  if (error) {
    throw new Error(
      `Failed to store outgoing WhatsApp message: ${error.message}`,
    );
  }
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

  if (!isOutgoingWhatsAppMessage(body)) {
    return NextResponse.json(
      { error: "telefono and mensaje must be strings" },
      { status: 400 },
    );
  }

  const { telefono, mensaje } = body;
  const supabase = createAdminClient();
  let order: WhatsAppOrder | null = null;

  try {
    order = await findMatchingOrder(supabase, telefono);
  } catch (orderError) {
    console.error(
      "Failed to match outgoing WhatsApp message to an order",
      orderError,
    );
    return NextResponse.json(
      { error: "Failed to match outgoing WhatsApp message" },
      { status: 500 },
    );
  }

  try {
    await storeOutgoingMessage({
      order_id: order?.id ?? null,
      telefono_destino: telefono,
      mensaje_enviado: mensaje,
    });
  } catch (error) {
    console.error("Failed to store outgoing WhatsApp message", error);
    return NextResponse.json(
      { error: "Failed to store outgoing WhatsApp message" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    matched: Boolean(order),
    orderId: order?.id ?? null,
  });
}
