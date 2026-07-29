/**
 * MANUAL-ONLY dry-run test route for createDropiOrderCO (Colombia).
 *
 * ⚠️ THIS IS NOT A CRON AND IS NOT WIRED INTO ANY WEBHOOK. It exists solely so
 * the new createDropiOrderCO client can be exercised by hand against Dropi
 * before it is integrated anywhere. Invoking it with ?confirm=true creates a
 * REAL Dropi CO order (FINAL_ORDER + CON RECAUDO).
 *
 * Guards:
 *  - Requires the CRON_SECRET bearer token (same scheme as the login-test route).
 *  - Refuses unless the caller passes ?confirm=true, so it cannot fire by
 *    accident / from a stray request.
 *
 * Usage:
 *   curl -X POST 'https://<host>/api/dropi-order-create-test?confirm=true' \
 *     -H "authorization: Bearer $CRON_SECRET" \
 *     -H 'content-type: application/json' \
 *     -d '{ ...CreateDropiOrderCOInput... }'
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  createDropiOrderCO,
  DropiCaptchaRequiredError,
  DropiOrderCreationError,
  type CreateDropiOrderCOInput,
} from "@/lib/dropi/createDropiOrderCO";
import { getDropiSession } from "@/lib/dropi/getDropiSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(
    cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`,
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, errorMessage: "Unauthorized" },
      { status: 401 },
    );
  }

  // Explicit confirmation guard — refuse unless ?confirm=true.
  const confirm = request.nextUrl.searchParams.get("confirm");

  if (confirm !== "true") {
    return NextResponse.json(
      {
        success: false,
        errorMessage:
          "Refusing to create a real Dropi order. Re-invoke with ?confirm=true to proceed.",
      },
      { status: 400 },
    );
  }

  let input: CreateDropiOrderCOInput;

  try {
    input = (await request.json()) as CreateDropiOrderCOInput;
  } catch {
    return NextResponse.json(
      { success: false, errorMessage: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  try {
    const session = await getDropiSession("CO");
    const result = await createDropiOrderCO({ token: session.token, input });

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error) {
    if (error instanceof DropiCaptchaRequiredError) {
      return NextResponse.json(
        {
          success: false,
          captchaRequired: true,
          step: error.step,
          errorMessage: error.message,
        },
        { status: 409 },
      );
    }

    if (error instanceof DropiOrderCreationError) {
      return NextResponse.json(
        { success: false, step: error.step, errorMessage: error.message },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unexpected Dropi order-creation failure",
      },
      { status: 500 },
    );
  }
}
