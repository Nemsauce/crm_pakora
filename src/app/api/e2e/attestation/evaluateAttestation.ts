import { timingSafeEqual } from "node:crypto";

import {
  assertStagingEnvironment,
  type StagingGuardEnvironment,
  type VerifiedStagingGuardConfig,
} from "../../../../../scripts/e2e/staging-guard.mjs";

type AttestationBody =
  | Readonly<{ error: string }>
  | Readonly<{
      version: 1;
      appOrigin: string;
      vercelEnvironment: string;
      projectRef: string;
      markerVerified: true;
    }>;

export type AttestationEvaluation = Readonly<{
  status: 200 | 401 | 404 | 409 | 503;
  body: AttestationBody;
}>;

export type StagingEnvironmentAssertion = (
  environment: StagingGuardEnvironment,
) => Promise<Readonly<VerifiedStagingGuardConfig>>;

type AttestationRequest = Readonly<{
  environment: StagingGuardEnvironment;
  receivedToken: string | null;
  requestOrigin: string;
}>;

function secretsMatch(received: string | null, expected: string | undefined) {
  if (!received || !expected) {
    return false;
  }

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

/**
 * Evaluates the preview attestation contract without constructing a response.
 * Dependency injection exists only so every fail-closed branch can be tested
 * without provisioning or mutating an external Supabase project.
 */
export async function evaluateAttestationRequest(
  request: AttestationRequest,
  assertEnvironment: StagingEnvironmentAssertion = assertStagingEnvironment,
): Promise<AttestationEvaluation> {
  if (request.environment.VERCEL_ENV !== "preview") {
    return { status: 404, body: { error: "Not found" } };
  }

  if (
    !secretsMatch(
      request.receivedToken,
      request.environment.E2E_ATTESTATION_TOKEN,
    )
  ) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  try {
    const config = await assertEnvironment(request.environment);

    if (request.requestOrigin !== config.appOrigin) {
      return {
        status: 409,
        body: { error: "Attestation origin mismatch" },
      };
    }

    return {
      status: 200,
      body: {
        version: 1,
        appOrigin: config.appOrigin,
        vercelEnvironment: config.vercelEnvironment,
        projectRef: config.projectRef,
        markerVerified: config.markerVerified,
      },
    };
  } catch {
    return {
      status: 503,
      body: { error: "Staging attestation unavailable" },
    };
  }
}
