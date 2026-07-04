import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import {
  processOrderHistory,
  type OrderHistoryEntry,
} from "@/lib/tasks/processOrderHistory";
import { OrderNotFoundError } from "@/lib/tasks/processOrderEvent";

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

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isHistoryEntry(value: unknown): value is OrderHistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Record<string, unknown>;

  return (
    typeof entry.estado === "string" &&
    isNullableString(entry.transportadora) &&
    isNullableString(entry.novedad) &&
    typeof entry.registrado_en === "string"
  );
}

function getHistory(value: unknown): OrderHistoryEntry[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.every(isHistoryEntry) ? value : null;
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
  const historyValue =
    body && typeof body === "object" && "history" in body
      ? (body as { history: unknown }).history
      : undefined;
  const history = getHistory(historyValue);

  if (!isValidOrderId(orderId)) {
    return NextResponse.json(
      { error: "order_id must be a positive integer" },
      { status: 400 },
    );
  }

  if (!history) {
    return NextResponse.json(
      {
        error:
          "history must be an array of { estado, transportadora, novedad, registrado_en } entries",
      },
      { status: 400 },
    );
  }

  if (history.length === 0) {
    return NextResponse.json({
      message: "No history entries to process",
      processed: 0,
      tasksCreated: 0,
      tasksClosed: 0,
      errors: [],
    });
  }

  try {
    const result = await processOrderHistory(orderId, history);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to process order history webhook", error);

    return NextResponse.json(
      { error: "Failed to process order history" },
      { status: 500 },
    );
  }
}
