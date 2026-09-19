import { NextResponse, type NextRequest } from "next/server";

import { evaluateAutopause } from "@/lib/meta/evaluateAutopause";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRunParam = request.nextUrl.searchParams.get("dryRun");
  // A misspelled dry-run value must never silently enable real writes.
  if (dryRunParam !== null && dryRunParam !== "true" && dryRunParam !== "false") {
    return NextResponse.json({ error: "dryRun must be true or false" }, { status: 400 });
  }
  try {
    return NextResponse.json(await evaluateAutopause({ dryRun: dryRunParam === "true" }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // Do not log raw upstream errors, URLs or tokens.
    return NextResponse.json({
      evaluated: 0, paused: [],
      errors: [{ campaignId: null, error: "No se pudo ejecutar la revisión de auto-pausa." }],
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
