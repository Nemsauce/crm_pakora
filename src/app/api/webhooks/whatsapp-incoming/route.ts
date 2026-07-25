import { timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getFullOrderContext } from "@/lib/orders/getFullOrderContext";
import { createAdminClient } from "@/lib/supabase/admin";
import { draftReplyWithAI } from "@/lib/whatsapp/draftReplyWithAI";

export const runtime = "nodejs";

type IncomingWhatsAppMessage = {
  telefono: string;
  mensaje: string;
};

type WhatsAppIncomingMessageInsert = {
  order_id: number | null;
  telefono_origen: string;
  mensaje_cliente: string;
  sugerencia_ia: string | null;
};

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

function isIncomingWhatsAppMessage(
  value: unknown,
): value is IncomingWhatsAppMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const message = value as Record<string, unknown>;

  return (
    typeof message.telefono === "string" && typeof message.mensaje === "string"
  );
}

function getWhatsAppMessagesClient() {
  // WhatsApp message tables were migrated after the generated database types.
  // Keep this cast local until those types are refreshed.
  return createAdminClient() as unknown as SupabaseClient;
}

async function storeIncomingMessage(message: WhatsAppIncomingMessageInsert) {
  const { error } = await getWhatsAppMessagesClient()
    .from("whatsapp_mensajes_entrantes")
    .insert(message);

  if (error) {
    throw new Error(
      `Failed to store incoming WhatsApp message: ${error.message}`,
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

  if (!isIncomingWhatsAppMessage(body)) {
    return NextResponse.json(
      { error: "telefono and mensaje must be strings" },
      { status: 400 },
    );
  }

  const { telefono, mensaje } = body;
  let fullOrderContext;

  try {
    fullOrderContext = await getFullOrderContext({
      telefono,
      conversationPhone: telefono,
      currentCustomerMessage: mensaje,
    });
  } catch (error) {
    console.error(
      "Failed to fetch full context for incoming WhatsApp message",
      error,
    );
    return NextResponse.json(
      { error: "Failed to match incoming WhatsApp message" },
      { status: 500 },
    );
  }

  if (!fullOrderContext) {
    try {
      await storeIncomingMessage({
        order_id: null,
        telefono_origen: telefono,
        mensaje_cliente: mensaje,
        sugerencia_ia: null,
      });
    } catch (error) {
      console.error("Failed to store unmatched WhatsApp message", error);
      return NextResponse.json(
        { error: "Failed to store incoming WhatsApp message" },
        { status: 500 },
      );
    }

    return NextResponse.json({ matched: false, orderId: null });
  }

  let suggestion: string | null = null;

  try {
    suggestion = await draftReplyWithAI({
      mensajeCliente: mensaje,
      orderContext: fullOrderContext.orderContext,
      statusHistory: fullOrderContext.statusHistory,
      tasks: fullOrderContext.tasks,
      conversation: fullOrderContext.conversation,
    });
  } catch (error) {
    console.error("Failed to draft WhatsApp reply", error);
  }

  try {
    await storeIncomingMessage({
      order_id: fullOrderContext.orderId,
      telefono_origen: telefono,
      mensaje_cliente: mensaje,
      sugerencia_ia: suggestion,
    });
  } catch (error) {
    console.error("Failed to store matched WhatsApp message", error);
    return NextResponse.json(
      { error: "Failed to store incoming WhatsApp message" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    matched: true,
    orderId: fullOrderContext.orderId,
  });
}
