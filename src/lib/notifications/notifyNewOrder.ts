import { sendTelegramMessage } from "@/lib/notifications/sendTelegram";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";

export type Order = Tables<"orders">;

type NotificationRecipient = {
  id: string;
  telegram_chat_id: string | null;
};

export class OrderNotFoundError extends Error {
  constructor(orderId: number) {
    super(`Order ${orderId} not found`);
    this.name = "OrderNotFoundError";
  }
}

function getOrderNumber(order: Order) {
  return order.numero_orden ?? String(order.id);
}

function formatTotal(total: number | null) {
  return (total ?? 0).toFixed(2);
}

async function loadOrder(orderId: number) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new OrderNotFoundError(orderId);
  }

  return data;
}

async function notifyActiveProfiles(order: Order): Promise<NotificationRecipient[]> {
  try {
    const supabase = createAdminClient();
    const { data: activeProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,telegram_chat_id")
      .eq("activo", true);

    if (profilesError) {
      throw profilesError;
    }

    const recipients = (activeProfiles ?? []) as unknown as NotificationRecipient[];

    if (recipients.length === 0) {
      return [];
    }

    const productName = order.nombre_producto?.trim() || "Producto sin nombre";
    const titulo = `🆕 Pedido nuevo: ${getOrderNumber(order)}`;
    const mensaje = `${order.nombre} ${order.apellido} · ${productName} · $${formatTotal(order.total)}`;
    const rows = recipients.map((profile) => ({
      user_id: profile.id,
      tipo: "pedido_nuevo" as const,
      titulo,
      mensaje,
      order_id: order.id,
      task_id: null,
    }));

    const { error: insertError } = await supabase
      .from("notifications")
      .insert(rows);

    if (insertError) {
      throw insertError;
    }

    return recipients;
  } catch (error) {
    console.error("Failed to insert new order notifications", error);
    return [];
  }
}

async function sendTelegramNotifications(
  order: Order,
  recipients: NotificationRecipient[],
) {
  const productName = order.nombre_producto?.trim() || "Producto sin nombre";
  const titulo = `🆕 Pedido nuevo: ${getOrderNumber(order)}`;
  const mensaje = `${order.nombre} ${order.apellido} · ${productName} · $${formatTotal(order.total)}`;

  for (const profile of recipients) {
    if (!profile.telegram_chat_id) {
      continue;
    }

    try {
      await sendTelegramMessage(
        profile.telegram_chat_id,
        `${titulo}\n${mensaje}`,
        order.pais,
      );
    } catch (error) {
      console.error("Failed to send Telegram new order notification", error);
    }
  }
}

export async function notifyNewOrder(orderId: number) {
  const order = await loadOrder(orderId);

  const recipients = await notifyActiveProfiles(order);
  await sendTelegramNotifications(order, recipients);

  return { action: "new_order_notified", orderId: order.id };
}
