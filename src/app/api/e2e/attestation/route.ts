import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { evaluateAttestationRequest } from "./evaluateAttestation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const evaluation = await evaluateAttestationRequest({
    environment: process.env,
    receivedToken: request.headers.get("x-e2e-attestation-token"),
    requestOrigin: request.nextUrl.origin,
  });

  return json(evaluation.body, evaluation.status);
}
