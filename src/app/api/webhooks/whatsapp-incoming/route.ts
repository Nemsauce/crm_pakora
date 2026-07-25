import { timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/supabase/database.types";
import {
  draftReplyWithAI,
  type WhatsAppConversationMessageContext,
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

type WhatsAppIncomingConversationRow = {
  id: number;
  telefono_origen: string;
  mensaje_cliente: string;
  recibido_en: string;
};

type WhatsAppOutgoingConversationRow = {
  id: number;
  telefono_destino: string;
  mensaje_enviado: string;
  enviado_en: string;
};

type WhatsAppConversationMessageWithSort =
  WhatsAppConversationMessageContext & {
    id: number;
    source: "incoming" | "outgoing" | "current";
  };

const PHONE_SUFFIX_LENGTH = 10;
const PHONE_MATCH_PAGE_SIZE = 1_000;
const MAX_CONVERSATION_MESSAGES = 20;

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
  // WhatsApp message tables were migrated after the generated database types.
  // Keep this cast local until those types are refreshed.
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

async function getIncomingConversationMessages(phoneSuffix: string) {
  const phoneSearchPattern = getPhoneSearchPattern(phoneSuffix);
  const messages: WhatsAppIncomingConversationRow[] = [];

  for (let from = 0; ; from += PHONE_MATCH_PAGE_SIZE) {
    const { data, error } = await getWhatsAppMessagesClient()
      .from("whatsapp_mensajes_entrantes")
      .select("id,telefono_origen,mensaje_cliente,recibido_en")
      .ilike("telefono_origen", phoneSearchPattern)
      .order("recibido_en", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PHONE_MATCH_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Failed to fetch incoming WhatsApp messages: ${error.message}`,
      );
    }

    const candidates = (data ?? []) as WhatsAppIncomingConversationRow[];
    messages.push(
      ...candidates.filter(
        (message) => getPhoneSuffix(message.telefono_origen) === phoneSuffix,
      ),
    );

    if (candidates.length < PHONE_MATCH_PAGE_SIZE) {
      return messages;
    }
  }
}

async function getOutgoingConversationMessages(phoneSuffix: string) {
  const phoneSearchPattern = getPhoneSearchPattern(phoneSuffix);
  const messages: WhatsAppOutgoingConversationRow[] = [];

  for (let from = 0; ; from += PHONE_MATCH_PAGE_SIZE) {
    const { data, error } = await getWhatsAppMessagesClient()
      .from("whatsapp_mensajes_salientes")
      .select("id,telefono_destino,mensaje_enviado,enviado_en")
      .ilike("telefono_destino", phoneSearchPattern)
      .order("enviado_en", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PHONE_MATCH_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Failed to fetch outgoing WhatsApp messages: ${error.message}`,
      );
    }

    const candidates = (data ?? []) as WhatsAppOutgoingConversationRow[];
    messages.push(
      ...candidates.filter(
        (message) => getPhoneSuffix(message.telefono_destino) === phoneSuffix,
      ),
    );

    if (candidates.length < PHONE_MATCH_PAGE_SIZE) {
      return messages;
    }
  }
}

function getConversationTimestamp(message: WhatsAppConversationMessageWithSort) {
  const timestamp = Date.parse(message.ocurrido_en);

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function toConversationMessageContext(
  message: WhatsAppConversationMessageWithSort,
): WhatsAppConversationMessageContext {
  return {
    autor: message.autor,
    mensaje: message.mensaje,
    ocurrido_en: message.ocurrido_en,
    ...(message.es_mensaje_actual ? { es_mensaje_actual: true } : {}),
  };
}

async function getConversationThread(
  telefono: string,
  mensajeActual: string,
) {
  const currentMessage: WhatsAppConversationMessageWithSort = {
    id: Number.MAX_SAFE_INTEGER,
    source: "current",
    autor: "cliente",
    mensaje: mensajeActual,
    ocurrido_en: new Date().toISOString(),
    es_mensaje_actual: true,
  };
  const phoneSuffix = getPhoneSuffix(telefono);

  if (!phoneSuffix) {
    return [toConversationMessageContext(currentMessage)];
  }

  const [incomingMessages, outgoingMessages] = await Promise.all([
    getIncomingConversationMessages(phoneSuffix),
    getOutgoingConversationMessages(phoneSuffix),
  ]);
  const conversation = [
    ...incomingMessages.map<WhatsAppConversationMessageWithSort>((message) => ({
      id: message.id,
      source: "incoming",
      autor: "cliente",
      mensaje: message.mensaje_cliente,
      ocurrido_en: message.recibido_en,
    })),
    ...outgoingMessages.map<WhatsAppConversationMessageWithSort>((message) => ({
      id: message.id,
      source: "outgoing",
      autor: "nosotros",
      mensaje: message.mensaje_enviado,
      ocurrido_en: message.enviado_en,
    })),
    currentMessage,
  ];

  return conversation
    .sort((left, right) => {
      const timestampDifference =
        getConversationTimestamp(left) - getConversationTimestamp(right);

      if (timestampDifference !== 0) {
        return timestampDifference;
      }

      if (left.es_mensaje_actual !== right.es_mensaje_actual) {
        return left.es_mensaje_actual ? 1 : -1;
      }

      const sourceDifference = left.source.localeCompare(right.source);
      return sourceDifference !== 0 ? sourceDifference : left.id - right.id;
    })
    .slice(-MAX_CONVERSATION_MESSAGES)
    .map(toConversationMessageContext);
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
  let conversation: WhatsAppConversationMessageContext[] = [
    {
      autor: "cliente",
      mensaje,
      ocurrido_en: new Date().toISOString(),
      es_mensaje_actual: true,
    },
  ];

  try {
    const [categoria, historyResult, tasksResult, conversationResult] =
      await Promise.all([
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
        getConversationThread(telefono, mensaje),
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
    conversation = conversationResult;
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
      conversation,
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
