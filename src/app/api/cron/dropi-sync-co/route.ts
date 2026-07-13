import { NextResponse, type NextRequest } from "next/server";

import { dropiAuthWithToken } from "@/lib/dropi/dropiAuth";
import { fetchDropiOrdersCO } from "@/lib/dropi/fetchDropiOrdersCO";
import {
  syncDropiOrdersCO,
  type SyncDropiOrdersCOResult,
} from "@/lib/dropi/syncDropiOrdersCO";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(
    cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`,
  );
}

function failureSummary(errorMessage: string): SyncDropiOrdersCOResult {
  return {
    ordersFromDropi: 0,
    ordersMatched: 0,
    ordersWithMissingHistory: 0,
    orderUpdateErrors: [errorMessage],
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authResult = await dropiAuthWithToken();

  if (!authResult.success) {
    return NextResponse.json(
      failureSummary(`Dropi login failed: ${authResult.errorMessage}`),
      { status: 502 },
    );
  }

  try {
    const dropiOrders = await fetchDropiOrdersCO(authResult.token);
    const result = await syncDropiOrdersCO(dropiOrders);

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown Dropi CO sync error";

    console.error("Dropi CO sync failed", errorMessage);

    return NextResponse.json(failureSummary(errorMessage), { status: 500 });
  }
}
