import { NextResponse, type NextRequest } from "next/server";

import { checkConfirmationFollowups } from "@/lib/tasks/checkConfirmationFollowups";

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
    return NextResponse.json(await checkConfirmationFollowups());
  } catch (error) {
    console.error("Failed to check confirmation follow-ups", error);

    return NextResponse.json(
      { error: "Failed to check confirmation follow-ups" },
      { status: 500 },
    );
  }
}
