import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<unknown>;
};

function parseOrderId(value: string) {
  const orderId = Number(value);

  if (!Number.isInteger(orderId) || orderId < 1) {
    return null;
  }

  return orderId;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const id =
    params && typeof params === "object" && "id" in params
      ? String((params as { id: unknown }).id)
      : "";
  const orderId = parseOrderId(id);

  if (!orderId) {
    return NextResponse.json(
      { error: "Order id must be a positive integer" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json(
      { error: "Failed to load order" },
      { status: 500 },
    );
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const [
    { data: statusHistory, error: statusHistoryError },
    { data: tasks, error: tasksError },
    { data: comentarios, error: comentariosError },
  ] = await Promise.all([
    supabase
      .from("status_history")
      .select("*")
      .eq("order_id", orderId)
      .order("registrado_en", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("comentarios")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
  ]);

  if (statusHistoryError || tasksError || comentariosError) {
    return NextResponse.json(
      { error: "Failed to load order detail" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    order,
    statusHistory: statusHistory ?? [],
    tasks: tasks ?? [],
    comentarios: comentarios ?? [],
  });
}
