import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { processOrderEvent } from "@/lib/tasks/processOrderEvent";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(
    cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`,
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, estado_dropi, tarea_generada_para_estado")
    .eq("activo", true)
    .order("updated_at", { ascending: true })
    .limit(1000);

  if (error) {
    console.error("Failed to load orders for task reconciliation", error);
    return NextResponse.json(
      { error: "Failed to load orders for reconciliation" },
      { status: 500 },
    );
  }

  const ordersToProcess = (data ?? [])
    .filter((order) => order.estado_dropi !== order.tarea_generada_para_estado)
    .slice(0, 200);
  const errors: { order_id: number; error: string }[] = [];
  let processed = 0;

  for (const order of ordersToProcess) {
    try {
      await processOrderEvent(order.id);
      processed += 1;
    } catch (reconcileError) {
      const errorMessage =
        reconcileError instanceof Error
          ? reconcileError.message
          : "Unknown reconciliation error";

      console.error("Failed to reconcile task state", {
        order_id: order.id,
        error: errorMessage,
      });

      errors.push({
        order_id: order.id,
        error: errorMessage,
      });
    }
  }

  return NextResponse.json({ processed, errors });
}
