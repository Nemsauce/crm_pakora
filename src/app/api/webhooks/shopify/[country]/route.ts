import { after, NextResponse } from "next/server";

import {
  mapShopifyOrderCO,
  mapShopifyOrderMX,
  type MappedShopifyOrder,
} from "@/lib/shopify/mapShopifyOrder";
import { verifyShopifyWebhook } from "@/lib/shopify/verifyShopifyWebhook";
import { notifyNewOrder } from "@/lib/notifications/notifyNewOrder";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import { ensureOpenTask } from "@/lib/tasks/processOrderEvent";

export const runtime = "nodejs";

type CountryParam = "co" | "mx";
type CountryCode = "CO" | "MX";
type Order = Tables<"orders">;

type RouteContext = {
  params: Promise<{ country: string }>;
};

type DatabaseError = {
  code?: string;
  message: string;
};

type WebhookEventTable = {
  select(columns: "webhook_id"): {
    eq(column: "webhook_id", value: string): {
      maybeSingle(): Promise<{
        data: { webhook_id: string } | null;
        error: DatabaseError | null;
      }>;
    };
  };
  insert(values: { webhook_id: string }): PromiseLike<{
    error: DatabaseError | null;
  }>;
  delete(): {
    eq(column: "webhook_id", value: string): PromiseLike<{
      error: DatabaseError | null;
    }>;
  };
};

type WebhookClaim = "claimed" | "duplicate";

export async function POST(request: Request, context: RouteContext) {
  const countryParam = (await context.params).country;
  const country = getCountry(countryParam);

  if (!country) {
    return NextResponse.json({ error: "Invalid country" }, { status: 400 });
  }

  const secret = getShopifySecret(countryParam as CountryParam);

  if (!secret) {
    console.error("Shopify webhook secret is not configured", {
      country: countryParam,
    });
    return NextResponse.json(
      { error: "Shopify webhook is not configured" },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhook(rawBody, hmacHeader, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawOrder: unknown;

  try {
    rawOrder = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const webhookId = request.headers.get("x-shopify-webhook-id")?.trim();

  if (!webhookId) {
    return NextResponse.json(
      { error: "Missing X-Shopify-Webhook-Id" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  let claim: WebhookClaim;

  try {
    claim = await claimWebhookEvent(supabase, webhookId);
  } catch (error) {
    console.error("Failed to claim Shopify webhook", {
      webhookId,
      message: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: "Failed to register Shopify webhook" },
      { status: 500 },
    );
  }

  if (claim === "duplicate") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  let mappedOrder: MappedShopifyOrder;

  try {
    mappedOrder =
      country === "CO"
        ? mapShopifyOrderCO(rawOrder)
        : mapShopifyOrderMX(rawOrder);
  } catch (error) {
    await releaseWebhookClaim(supabase, webhookId);
    console.error("Invalid Shopify order payload", {
      webhookId,
      country,
      message: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: "Invalid Shopify order payload" },
      { status: 400 },
    );
  }

  const { comentario, ...orderFields } = mappedOrder;
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .upsert(
      { ...orderFields, pais: country },
      {
        onConflict: "id_orden_shopify",
        ignoreDuplicates: false,
      },
    )
    .select("*")
    .single();

  if (orderError || !order) {
    await releaseWebhookClaim(supabase, webhookId);
    console.error("Failed to upsert Shopify order", {
      webhookId,
      country,
      message: orderError?.message ?? "Order row was not returned",
    });
    return NextResponse.json(
      { error: "Failed to store Shopify order" },
      { status: 500 },
    );
  }

  after(async () => {
    const postProcessing = await Promise.allSettled([
      createTaskAndComment(order, comentario),
      notifyNewOrder(order.id),
    ]);

    reportNonCriticalFailure(
      postProcessing[0],
      "Failed to create Shopify confirmation task or comment",
      order.id,
    );
    reportNonCriticalFailure(
      postProcessing[1],
      "Failed to send Shopify new-order notification",
      order.id,
    );
  });

  return NextResponse.json({
    ok: true,
    duplicate: false,
    orderId: order.id,
  });
}

function getCountry(value: string): CountryCode | null {
  if (value === "co") return "CO";
  if (value === "mx") return "MX";
  return null;
}

function getShopifySecret(country: CountryParam) {
  return country === "co"
    ? process.env.SHOPIFY_CO_API_SECRET
    : process.env.SHOPIFY_MX_API_SECRET;
}

async function claimWebhookEvent(
  supabase: ReturnType<typeof createAdminClient>,
  webhookId: string,
): Promise<WebhookClaim> {
  const table = supabase.from(
    "shopify_webhook_events" as never,
  ) as unknown as WebhookEventTable;
  const { data: existingEvent, error: lookupError } = await table
    .select("webhook_id")
    .eq("webhook_id", webhookId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existingEvent) {
    return "duplicate";
  }

  const { error: insertError } = await table.insert({
    webhook_id: webhookId,
  });

  if (insertError?.code === "23505") {
    return "duplicate";
  }

  if (insertError) {
    throw insertError;
  }

  return "claimed";
}

async function releaseWebhookClaim(
  supabase: ReturnType<typeof createAdminClient>,
  webhookId: string,
) {
  const table = supabase.from(
    "shopify_webhook_events" as never,
  ) as unknown as WebhookEventTable;
  const { error } = await table.delete().eq("webhook_id", webhookId);

  if (error) {
    console.error("Failed to release Shopify webhook claim", {
      webhookId,
      message: error.message,
    });
  }
}

async function createTaskAndComment(
  order: Order,
  comentario: string | null,
) {
  const taskResult = await ensureOpenTask({
    order,
    tipo: "llamar_confirmacion",
    titulo: `Llamar para confirmar pedido ${order.numero_orden}`,
    descripcion: `Llamar a ${order.nombre} ${order.apellido} al ${order.telefono} para confirmar el pedido de ${order.nombre_producto} por $${order.total}`,
  });

  if (taskResult.action === "task_created" && taskResult.taskId) {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("tasks")
      .update({
        fecha_limite: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .eq("id", taskResult.taskId);

    if (error) {
      throw error;
    }
  }

  if (!comentario) {
    return;
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("comentarios").insert({
    order_id: order.id,
    comentario,
    origen: "sheet",
  });

  if (error) {
    throw error;
  }
}

function reportNonCriticalFailure(
  result: PromiseSettledResult<unknown>,
  message: string,
  orderId: number,
) {
  if (result.status === "rejected") {
    console.error(message, {
      orderId,
      message: getErrorMessage(result.reason),
    });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}
