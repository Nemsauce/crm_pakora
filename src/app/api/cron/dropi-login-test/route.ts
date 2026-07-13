import { NextResponse, type NextRequest } from "next/server";

import { dropiAuth } from "@/lib/dropi/dropiAuth";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(
    cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`,
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, errorMessage: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await dropiAuth();

    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch {
    return NextResponse.json(
      { success: false, errorMessage: "Unexpected Dropi login test failure" },
      { status: 500 },
    );
  }
}
