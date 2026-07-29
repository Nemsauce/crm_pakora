import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export type WhatsAppStatusHistoryContext = {
  estado: string;
  transportadora: string | null;
  categoria: string | null;
  novedad: string | null;
  notas: string | null;
  registrado_en: string;
};

export type WhatsAppOrderContext = {
  numero_orden: string | null;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  codigo_postal: string | null;
  colonia: string | null;
  numero_interior: string | null;
  barrio_referencia: string | null;
  nombre_producto: string | null;
  cantidad: number | null;
  precio: number | null;
  total: number | null;
  fecha: string | null;
  estado_dropi: string | null;
  categoria: string | null;
  guia_envio: string | null;
  transportadora: string | null;
  fecha_entrega_real: string | null;
  nivel_riesgo: string | null;
};

export type WhatsAppTaskContext = {
  tipo: string;
  estado: string;
  resultado: string | null;
  notas_completado: string | null;
};

export type WhatsAppConversationMessageContext = {
  autor: "cliente" | "nosotros";
  mensaje: string;
  ocurrido_en: string;
  es_mensaje_actual?: boolean;
};

export type FullOrderContext = {
  orderId: number;
  isComplete: boolean;
  orderContext: WhatsAppOrderContext;
  statusHistory: WhatsAppStatusHistoryContext[];
  tasks: WhatsAppTaskContext[];
  conversation: WhatsAppConversationMessageContext[];
};

export type GetFullOrderContextInput = {
  orderId?: number;
  numeroOrden?: string;
  telefono?: string;
  conversationPhone?: string;
  currentCustomerMessage?: string;
};

type OrderRow = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  | "id"
  | "numero_orden"
  | "nombre"
  | "apellido"
  | "telefono"
  | "direccion"
  | "ciudad"
  | "departamento"
  | "codigo_postal"
  | "colonia"
  | "numero_interior"
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

type IncomingConversationRow = {
  id: number;
  telefono_origen: string;
  mensaje_cliente: string;
  recibido_en: string;
};

type OutgoingConversationRow = {
  id: number;
  telefono_destino: string;
  mensaje_enviado: string;
  enviado_en: string;
};

type ConversationMessageWithSort = WhatsAppConversationMessageContext & {
  id: number;
  source: "incoming" | "outgoing" | "current";
};

type ContextValue = string | number | null | undefined;

const PHONE_SUFFIX_LENGTH = 10;
const PHONE_MATCH_PAGE_SIZE = 1_000;
const MAX_CONVERSATION_MESSAGES = 20;
const ORDER_SELECT =
  "id,numero_orden,nombre,apellido,telefono,direccion,ciudad,departamento,codigo_postal,colonia,numero_interior,barrio_referencia,nombre_producto,cantidad,precio,total,fecha,estado_dropi,guia_envio,transportadora,fecha_entrega_real,nivel_riesgo";

function getWhatsAppContextClient() {
  return createAdminClient();
}

function getPhoneSuffix(telefono: string | null | undefined) {
  const digits = telefono?.replace(/\D/g, "") ?? "";

  return digits.length >= PHONE_SUFFIX_LENGTH
    ? digits.slice(-PHONE_SUFFIX_LENGTH)
    : null;
}

function getPhoneSearchPattern(phoneSuffix: string) {
  return `%${phoneSuffix.split("").join("%")}%`;
}

function getOrderNumberCandidates(numeroOrden: string) {
  const trimmedValue = numeroOrden.trim();
  const digits = trimmedValue.replace(/\D/g, "");

  return [...new Set([trimmedValue, digits, digits ? `#${digits}` : ""])]
    .map((value) => value.trim())
    .filter(Boolean);
}

async function findOrderById(
  supabase: SupabaseClient<Database>,
  orderId: number,
) {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch order: ${error.message}`);
  }

  return data;
}

async function findOrderByNumeroOrden(
  supabase: SupabaseClient<Database>,
  numeroOrden: string,
) {
  const candidates = getOrderNumberCandidates(numeroOrden);

  if (candidates.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .in("numero_orden", candidates)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find order by number: ${error.message}`);
  }

  return data;
}

async function findOrderByPhone(
  supabase: SupabaseClient<Database>,
  telefono: string,
) {
  const phoneSuffix = getPhoneSuffix(telefono);

  if (!phoneSuffix) {
    return null;
  }

  const phoneSearchPattern = getPhoneSearchPattern(phoneSuffix);

  for (let from = 0; ; from += PHONE_MATCH_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .ilike("telefono", phoneSearchPattern)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PHONE_MATCH_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to find order by phone: ${error.message}`);
    }

    const candidates = data ?? [];
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

async function findOrder(
  supabase: SupabaseClient<Database>,
  input: GetFullOrderContextInput,
) {
  if (
    typeof input.orderId === "number" &&
    Number.isSafeInteger(input.orderId) &&
    input.orderId > 0
  ) {
    return findOrderById(supabase, input.orderId);
  }

  if (input.numeroOrden?.trim()) {
    return findOrderByNumeroOrden(supabase, input.numeroOrden);
  }

  if (input.telefono?.trim()) {
    return findOrderByPhone(supabase, input.telefono);
  }

  return null;
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

async function getIncomingConversationMessages(phoneSuffix: string) {
  const phoneSearchPattern = getPhoneSearchPattern(phoneSuffix);
  const messages: IncomingConversationRow[] = [];
  const supabase = getWhatsAppContextClient();

  for (let from = 0; ; from += PHONE_MATCH_PAGE_SIZE) {
    const { data, error } = await supabase
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

    const candidates = data ?? [];
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
  const messages: OutgoingConversationRow[] = [];
  const supabase = getWhatsAppContextClient();

  for (let from = 0; ; from += PHONE_MATCH_PAGE_SIZE) {
    const { data, error } = await supabase
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

    const candidates = data ?? [];
    messages.push(
      ...candidates.filter(
        (message) =>
          getPhoneSuffix(message.telefono_destino) === phoneSuffix,
      ),
    );

    if (candidates.length < PHONE_MATCH_PAGE_SIZE) {
      return messages;
    }
  }
}

function getConversationTimestamp(message: ConversationMessageWithSort) {
  const timestamp = Date.parse(message.ocurrido_en);

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function toConversationMessageContext(
  message: ConversationMessageWithSort,
): WhatsAppConversationMessageContext {
  return {
    autor: message.autor,
    mensaje: message.mensaje,
    ocurrido_en: message.ocurrido_en,
    ...(message.es_mensaje_actual ? { es_mensaje_actual: true } : {}),
  };
}

async function getConversationThread(
  telefono: string | null | undefined,
  currentCustomerMessage?: string,
) {
  const currentMessage = currentCustomerMessage !== undefined
    ? {
        id: Number.MAX_SAFE_INTEGER,
        source: "current" as const,
        autor: "cliente" as const,
        mensaje: currentCustomerMessage,
        ocurrido_en: new Date().toISOString(),
        es_mensaje_actual: true,
      }
    : null;
  const phoneSuffix = getPhoneSuffix(telefono);

  if (!phoneSuffix) {
    return currentMessage ? [toConversationMessageContext(currentMessage)] : [];
  }

  const [incomingMessages, outgoingMessages] = await Promise.all([
    getIncomingConversationMessages(phoneSuffix),
    getOutgoingConversationMessages(phoneSuffix),
  ]);
  const conversation: ConversationMessageWithSort[] = [
    ...incomingMessages.map((message) => ({
      id: message.id,
      source: "incoming" as const,
      autor: "cliente" as const,
      mensaje: message.mensaje_cliente,
      ocurrido_en: message.recibido_en,
    })),
    ...outgoingMessages.map((message) => ({
      id: message.id,
      source: "outgoing" as const,
      autor: "nosotros" as const,
      mensaje: message.mensaje_enviado,
      ocurrido_en: message.enviado_en,
    })),
    ...(currentMessage ? [currentMessage] : []),
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

function getFallbackConversation(currentCustomerMessage?: string) {
  return currentCustomerMessage !== undefined
    ? [
        {
          autor: "cliente" as const,
          mensaje: currentCustomerMessage,
          ocurrido_en: new Date().toISOString(),
          es_mensaje_actual: true,
        },
      ]
    : [];
}

function toOrderContext(
  order: OrderRow,
  categoria: string | null,
): WhatsAppOrderContext {
  return {
    numero_orden: order.numero_orden,
    nombre: order.nombre,
    apellido: order.apellido,
    telefono: order.telefono,
    direccion: order.direccion,
    ciudad: order.ciudad,
    departamento: order.departamento,
    codigo_postal: order.codigo_postal,
    colonia: order.colonia,
    numero_interior: order.numero_interior,
    barrio_referencia: order.barrio_referencia,
    nombre_producto: order.nombre_producto,
    cantidad: order.cantidad,
    precio: order.precio,
    total: order.total,
    fecha: order.fecha,
    estado_dropi: order.estado_dropi,
    categoria,
    guia_envio: order.guia_envio,
    transportadora: order.transportadora,
    fecha_entrega_real: order.fecha_entrega_real,
    nivel_riesgo: order.nivel_riesgo,
  };
}

export async function getFullOrderContext(
  input: GetFullOrderContextInput,
): Promise<FullOrderContext | null> {
  const supabase = createAdminClient();
  const order = await findOrder(supabase, input);

  if (!order) {
    return null;
  }

  try {
    const [categoria, historyResult, tasksResult, conversation] =
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
        getWhatsAppContextClient()
          .from("tasks")
          .select("tipo,estado,resultado,notas_completado")
          .eq("order_id", order.id)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
        getConversationThread(
          input.conversationPhone ?? order.telefono,
          input.currentCustomerMessage,
        ),
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

    return {
      orderId: order.id,
      isComplete: true,
      orderContext: toOrderContext(order, categoria),
      statusHistory: historyResult.data ?? [],
      tasks: tasksResult.data ?? [],
      conversation,
    };
  } catch (error) {
    console.error("Failed to fetch full order context", error);

    return {
      orderId: order.id,
      isComplete: false,
      orderContext: toOrderContext(order, "sin_clasificar"),
      statusHistory: [],
      tasks: [],
      conversation: getFallbackConversation(input.currentCustomerMessage),
    };
  }
}

export async function getWhatsAppBusinessRules() {
  const { data, error } = await getWhatsAppContextClient()
    .from("asistente_whatsapp_config")
    .select("reglas")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load WhatsApp assistant rules", {
      message: error.message,
    });
    return "";
  }

  return typeof data?.reglas === "string" ? data.reglas.trim() : "";
}

function formatContextValue(value: ContextValue) {
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue || null;
  }

  return typeof value === "number" ? String(value) : null;
}

function formatField(label: string, value: ContextValue) {
  const formattedValue = formatContextValue(value);

  return formattedValue ? `- ${label}: ${formattedValue}` : null;
}

function formatInlineField(label: string, value: ContextValue) {
  const formattedValue = formatContextValue(value);

  return formattedValue ? `${label}: ${formattedValue}` : null;
}

function buildOrderDetails(orderContext: WhatsAppOrderContext) {
  const fields = [
    formatField("Número de orden", orderContext.numero_orden),
    formatField("Nombre", orderContext.nombre),
    formatField("Apellido", orderContext.apellido),
    formatField("Teléfono", orderContext.telefono),
    formatField("Dirección", orderContext.direccion),
    formatField("Ciudad", orderContext.ciudad),
    formatField("Departamento", orderContext.departamento),
    formatField("Código postal", orderContext.codigo_postal),
    formatField("Colonia", orderContext.colonia),
    formatField("Número interior", orderContext.numero_interior),
    formatField("Barrio o referencia", orderContext.barrio_referencia),
    formatField("Producto", orderContext.nombre_producto),
    formatField("Cantidad", orderContext.cantidad),
    formatField("Precio registrado", orderContext.precio),
    formatField("Total registrado", orderContext.total),
    formatField("Fecha del pedido", orderContext.fecha),
    formatField("Estado Dropi actual", orderContext.estado_dropi),
    formatField(
      "Categoría interna de estado actual",
      orderContext.categoria,
    ),
    formatField("Guía de envío", orderContext.guia_envio),
    formatField("Transportadora", orderContext.transportadora),
    formatField("Fecha de entrega real", orderContext.fecha_entrega_real),
    formatField("Nivel de riesgo interno", orderContext.nivel_riesgo),
  ].filter((field): field is string => field !== null);

  return fields.length > 0
    ? fields.join("\n")
    : "- No hay datos disponibles del pedido.";
}

function buildStatusHistory(statusHistory: WhatsAppStatusHistoryContext[]) {
  if (statusHistory.length === 0) {
    return "- No hay historial registrado.";
  }

  return statusHistory
    .map((entry) => {
      const fields = [
        formatInlineField("Registrado en", entry.registrado_en),
        formatInlineField("Estado", entry.estado),
        formatInlineField("Transportadora", entry.transportadora),
        formatInlineField("Categoría interna", entry.categoria),
        formatInlineField("Novedad", entry.novedad),
        formatInlineField("Notas", entry.notas),
      ].filter((field): field is string => field !== null);

      return `- ${fields.join("; ")}`;
    })
    .join("\n");
}

function buildTaskHistory(tasks: WhatsAppTaskContext[]) {
  if (tasks.length === 0) {
    return "- No hay tareas registradas.";
  }

  return tasks
    .map((task) => {
      const fields = [
        formatInlineField("Tipo", task.tipo),
        formatInlineField("Estado", task.estado),
        formatInlineField("Resultado", task.resultado),
        formatInlineField("Notas de completado", task.notas_completado),
      ].filter((field): field is string => field !== null);

      return `- ${fields.join("; ")}`;
    })
    .join("\n");
}

function buildConversationTranscript(
  conversation: WhatsAppConversationMessageContext[],
) {
  if (conversation.length === 0) {
    return "- No hay mensajes previos registrados para este teléfono.";
  }

  return conversation
    .map((message) => {
      const author = message.autor === "nosotros" ? "Nosotros" : "Cliente";
      const currentMessageLabel = message.es_mensaje_actual
        ? " (este es el mensaje que hay que responder ahora)"
        : "";
      const timestamp = formatContextValue(message.ocurrido_en);
      const text = formatContextValue(message.mensaje);
      const timePrefix = timestamp ? `${timestamp} — ` : "";

      return `- ${timePrefix}${author}${currentMessageLabel}: ${text ?? "(sin texto)"}`;
    })
    .join("\n");
}

export function buildFullOrderContextSections(
  context: Pick<
    FullOrderContext,
    "orderContext" | "statusHistory" | "tasks" | "conversation"
  >,
) {
  return [
    "Datos del pedido:",
    buildOrderDetails(context.orderContext),
    "",
    "Historial completo de estados:",
    buildStatusHistory(context.statusHistory),
    "",
    "Tareas y resultados previos:",
    buildTaskHistory(context.tasks),
    "",
    "Conversación completa de WhatsApp con este teléfono (últimos 20 mensajes, orden cronológico):",
    buildConversationTranscript(context.conversation),
  ].join("\n");
}
