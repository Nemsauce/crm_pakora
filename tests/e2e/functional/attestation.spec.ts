import { expect, test } from "../fixtures/app";

import {
  evaluateAttestationRequest,
  type StagingEnvironmentAssertion,
} from "../../../src/app/api/e2e/attestation/evaluateAttestation";

const TOKEN = "test-only-attestation-token-1234567890";
const APP_ORIGIN = "https://crm-v4-git-redesign-example.vercel.app";

const previewEnvironment = {
  VERCEL_ENV: "preview",
  E2E_ATTESTATION_TOKEN: TOKEN,
};

const successfulAssertion: StagingEnvironmentAssertion = async () => ({
  environmentVerified: true,
  allowMutations: true,
  vercelEnvironment: "preview",
  appOrigin: APP_ORIGIN,
  supabaseUrl: "https://staging-example.supabase.co",
  projectRef: "staging-example",
  productionProjectRefs: ["production-example"],
  attestationToken: TOKEN,
  supabaseServiceRoleKey: "test-service-role",
  markerTable: "e2e_environment_markers",
  markerId: "crm-v4-staging",
  markerIdColumn: "id",
  markerVerified: true,
});

test("the real endpoint stays hidden outside Preview without redirecting", async ({
  page,
}) => {
  const response = await page.request.get("/api/e2e/attestation", {
    headers: { "x-e2e-attestation-token": "invalid-public-token" },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(404);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({ error: "Not found" });
});

test("attestation is indistinguishable from a missing route outside Preview", async () => {
  let assertionCalled = false;
  const result = await evaluateAttestationRequest(
    {
      environment: {
        ...previewEnvironment,
        VERCEL_ENV: "production",
      },
      receivedToken: TOKEN,
      requestOrigin: APP_ORIGIN,
    },
    async (environment) => {
      assertionCalled = true;
      return successfulAssertion(environment);
    },
  );

  expect(result).toEqual({ status: 404, body: { error: "Not found" } });
  expect(assertionCalled).toBe(false);
});

test("attestation rejects a missing or invalid secret before checking staging", async () => {
  let assertionCalled = false;
  const assertion: StagingEnvironmentAssertion = async (environment) => {
    assertionCalled = true;
    return successfulAssertion(environment);
  };

  for (const receivedToken of [null, "wrong-token"]) {
    const result = await evaluateAttestationRequest(
      {
        environment: previewEnvironment,
        receivedToken,
        requestOrigin: APP_ORIGIN,
      },
      assertion,
    );

    expect(result).toEqual({
      status: 401,
      body: { error: "Unauthorized" },
    });
  }
  expect(assertionCalled).toBe(false);
});

test("attestation fails closed when marker or staging validation fails", async () => {
  const result = await evaluateAttestationRequest(
    {
      environment: previewEnvironment,
      receivedToken: TOKEN,
      requestOrigin: APP_ORIGIN,
    },
    async () => {
      throw new Error("marker missing");
    },
  );

  expect(result).toEqual({
    status: 503,
    body: { error: "Staging attestation unavailable" },
  });
});

test("attestation rejects request-origin drift after staging is verified", async () => {
  const result = await evaluateAttestationRequest(
    {
      environment: previewEnvironment,
      receivedToken: TOKEN,
      requestOrigin: "https://different-preview.vercel.app",
    },
    successfulAssertion,
  );

  expect(result).toEqual({
    status: 409,
    body: { error: "Attestation origin mismatch" },
  });
});

test("attestation exposes only the verified non-secret staging identity", async () => {
  const result = await evaluateAttestationRequest(
    {
      environment: previewEnvironment,
      receivedToken: TOKEN,
      requestOrigin: APP_ORIGIN,
    },
    successfulAssertion,
  );

  expect(result).toEqual({
    status: 200,
    body: {
      version: 1,
      appOrigin: APP_ORIGIN,
      vercelEnvironment: "preview",
      projectRef: "staging-example",
      markerVerified: true,
    },
  });
  expect(JSON.stringify(result)).not.toContain(TOKEN);
  expect(JSON.stringify(result)).not.toContain("test-service-role");
});
