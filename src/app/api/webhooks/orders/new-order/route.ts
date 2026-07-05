import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import {
  OrderNotFoundError,
  notifyNewOrder,
} from "@/lib/notifications/notifyNewOrder";

export const runtime = "nodejs";

function isValidSecret(receivedSecret: string | null) {
  const expectedSecret = process.env.WEBHOOK_SHARED_SECRET;

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

function isValidOrderId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
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

  const orderId =
    body && typeof body === "object" && "order_id" in body
      ? (body as { order_id: unknown }).order_id
      : undefined;

  if (!isValidOrderId(orderId)) {
    return NextResponse.json(
      { error: "order_id must be a positive integer" },
      { status: 400 },
    );
  }

  try {
    const result = await notifyNewOrder(orderId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to process new order webhook", error);
    return NextResponse.json(
      { error: "Failed to process new order event" },
      { status: 500 },
    );
  }
}
