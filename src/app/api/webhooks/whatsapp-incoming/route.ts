import { timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  draftReplyWithAI,
  type WhatsAppStatusHistoryContext,
} from "@/lib/whatsapp/draftReplyWithAI";
import { createAdminClient } from "@/lib/supabase/admin";

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
  // whatsapp_mensajes_entrantes was migrated after the generated
  // database.types.ts file. Keep this cast local until those types are refreshed.
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

async function getStatusCategory(
  estadoDropi: string | null,
  transportadora: string | null,
) {
  if (!estadoDropi) {
    return "sin_clasificar";
  }

  const supabase = createAdminClient();

  if (transportadora) {
    const { data, error } = await supabase
      .from("status_catalog")
      .select("categoria")
      .eq("estado", estadoDropi)
      .eq("transportadora", transportadora)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to look up order status category: ${error.message}`,
      );
    }

    if (data) {
      return data.categoria;
    }
  }

  const { data, error } = await supabase
    .from("status_catalog")
    .select("categoria")
    .eq("estado", estadoDropi)
    .is("transportadora", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to look up order status category: ${error.message}`,
    );
  }

  return data?.categoria ?? "sin_clasificar";
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
  const supabase = createAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,nombre,nombre_producto,estado_dropi,transportadora")
    .eq("telefono", telefono)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    console.error(
      "Failed to match incoming WhatsApp message to an order",
      orderError,
    );
    return NextResponse.json(
      { error: "Failed to match incoming WhatsApp message" },
      { status: 500 },
    );
  }

  if (!order) {
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

  let categoriaEstado: string | null = "sin_clasificar";
  let statusHistory: WhatsAppStatusHistoryContext[] = [];

  try {
    const [categoria, historyResult] = await Promise.all([
      getStatusCategory(order.estado_dropi, order.transportadora),
      supabase
        .from("status_history")
        .select(
          "estado,transportadora,categoria,novedad,notas,registrado_en,created_at",
        )
        .eq("order_id", order.id)
        .order("registrado_en", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(2),
    ]);

    if (historyResult.error) {
      throw new Error(
        `Failed to fetch order status history: ${historyResult.error.message}`,
      );
    }

    categoriaEstado = categoria;
    statusHistory = historyResult.data ?? [];
  } catch (error) {
    console.error("Failed to fetch WhatsApp reply context", error);
  }

  let suggestion: string | null = null;

  try {
    suggestion = await draftReplyWithAI({
      mensajeCliente: mensaje,
      nombreCliente: order.nombre,
      nombreProducto: order.nombre_producto,
      estadoDropi: order.estado_dropi,
      categoriaEstado,
      statusHistory,
    });
  } catch (error) {
    console.error("Failed to draft WhatsApp reply", error);
  }

  try {
    await storeIncomingMessage({
      order_id: order.id,
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

  return NextResponse.json({ matched: true, orderId: order.id });
}
