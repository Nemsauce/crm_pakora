import { NextResponse, type NextRequest } from "next/server";

import { checkStaleOrders } from "@/lib/tasks/checkStaleOrders";

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

  try {
    const result = await checkStaleOrders();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to check stale orders", error);

    return NextResponse.json(
      { error: "Failed to check stale orders" },
      { status: 500 },
    );
  }
}
