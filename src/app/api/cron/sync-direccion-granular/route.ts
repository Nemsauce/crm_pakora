import { NextResponse, type NextRequest } from "next/server";

import { syncDireccionGranularReleasit } from "@/lib/pedidos/syncDireccionGranularReleasit";

export const runtime = "nodejs";
export const maxDuration = 300;

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
    return NextResponse.json(await syncDireccionGranularReleasit());
  } catch (error) {
    console.error(
      "Failed to sync granular Releasit addresses",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      { error: "Failed to sync granular Releasit addresses" },
      { status: 500 },
    );
  }
}
