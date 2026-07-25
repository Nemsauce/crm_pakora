import { timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/supabase/database.types";
import {
  draftReplyWithAI,
  type WhatsAppOrderContext,
  type WhatsAppStatusHistoryContext,
  type WhatsAppTaskContext,
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

type WhatsAppOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "id"
  | "numero_orden"
  | "nombre"
  | "apellido"
  | "telefono"
  | "direccion"
  | "ciudad"
  | "departamento"
  | "barrio_referencia"
  | "nombre_producto"
  | "cantidad"
  | "precio"
  | "total"
  | "fecha"
  | "estado_dropi"
  | "guia_envio"
  | "transportadora"
  | "fecha_entrega_real"
  | "nivel_riesgo"
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
  const incomingPhoneSuffix = getPhoneSuffix(telefono);

  if (!incomingPhoneSuffix) {
    return null;
  }

  const phoneSearchPattern = getPhoneSearchPattern(incomingPhoneSuffix);

  for (let from = 0; ; from += PHONE_MATCH_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id,numero_orden,nombre,apellido,telefono,direccion,ciudad,departamento,barrio_referencia,nombre_producto,cantidad,precio,total,fecha,estado_dropi,guia_envio,transportadora,fecha_entrega_real,nivel_riesgo",
      )
      .ilike("telefono", phoneSearchPattern)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PHONE_MATCH_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const candidates = (data ?? []) as WhatsAppOrder[];
    const order = candidates.find(
      (candidate) => getPhoneSuffix(candidate.telefono) === incomingPhoneSuffix,
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
  // whatsapp_mensajes_entrantes was migrated after the generated
  // database.types.ts file. Keep this cast local until those types are refreshed.
  return createAdminClient() as unknown as SupabaseClient;
}

function getWhatsAppTasksClient() {
  // tasks.resultado was added after the generated database types.
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
  let order: WhatsAppOrder | null = null;

  try {
    order = await findMatchingOrder(supabase, telefono);
  } catch (orderError) {
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
  let tasks: WhatsAppTaskContext[] = [];

  try {
    const [categoria, historyResult, tasksResult] = await Promise.all([
      getStatusCategory(order.estado_dropi, order.transportadora),
      supabase
        .from("status_history")
        .select(
          "estado,transportadora,categoria,novedad,notas,registrado_en,created_at",
        )
        .eq("order_id", order.id)
        .order("registrado_en", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      getWhatsAppTasksClient()
        .from("tasks")
        .select("tipo,estado,resultado,notas_completado")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ]);

    if (historyResult.error) {
      throw new Error(
        `Failed to fetch order status history: ${historyResult.error.message}`,
      );
    }

    if (tasksResult.error) {
      throw new Error(
        `Failed to fetch order tasks: ${tasksResult.error.message}`,
      );
    }

    categoriaEstado = categoria;
    statusHistory = historyResult.data ?? [];
    tasks = (tasksResult.data ?? []) as WhatsAppTaskContext[];
  } catch (error) {
    console.error("Failed to fetch WhatsApp reply context", error);
  }

  let suggestion: string | null = null;

  try {
    suggestion = await draftReplyWithAI({
      mensajeCliente: mensaje,
      orderContext: {
        numero_orden: order.numero_orden,
        nombre: order.nombre,
        apellido: order.apellido,
        telefono: order.telefono,
        direccion: order.direccion,
        ciudad: order.ciudad,
        departamento: order.departamento,
        barrio_referencia: order.barrio_referencia,
        nombre_producto: order.nombre_producto,
        cantidad: order.cantidad,
        precio: order.precio,
        total: order.total,
        fecha: order.fecha,
        estado_dropi: order.estado_dropi,
        categoria: categoriaEstado,
        guia_envio: order.guia_envio,
        transportadora: order.transportadora,
        fecha_entrega_real: order.fecha_entrega_real,
        nivel_riesgo: order.nivel_riesgo,
      } satisfies WhatsAppOrderContext,
      statusHistory,
      tasks,
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
