import { expect, test } from "@playwright/test";

import {
  PRODUCTION_APP_ORIGINS,
  PRODUCTION_PROJECT_REFS,
  assertRunnerVercelAutomationBypass,
  assertSafeStagingEnvironment,
  assertStagingDatabaseMarker,
  assertStagingDeploymentAttestation,
  inspectStagingEnvironment,
} from "../../../scripts/e2e/staging-guard.mjs";

const safeEnvironment = {
  E2E_ALLOW_MUTATIONS: "true",
  VERCEL_ENV: "preview",
  E2E_BASE_URL: "https://crm-v4-preview.vercel.app",
  E2E_EXPECTED_APP_ORIGIN: "https://crm-v4-preview.vercel.app",
  E2E_ATTESTATION_TOKEN: "test-only-attestation-token-1234567890",
  E2E_VERCEL_AUTOMATION_BYPASS_SECRET:
    "0123456789abcdefghijklmnopqrstuv",
  NEXT_PUBLIC_SUPABASE_URL: "https://stagingref123.supabase.co",
  E2E_EXPECTED_PROJECT_REF: "stagingref123",
  SUPABASE_SERVICE_ROLE_KEY: "e2e-test-service-role-key",
  E2E_STAGING_MARKER_TABLE: "e2e_environment_guard",
  E2E_STAGING_MARKER_ID: "crm_v4_e2e",
  E2E_STAGING_MARKER_ID_COLUMN: "id",
} as const;
const testPolicy = {
  allowedStagingProjectRefs: ["stagingref123"],
} as const;

function inspect(environment: Readonly<Record<string, string>>) {
  return inspectStagingEnvironment(environment, testPolicy);
}

function assertSafe(environment: Readonly<Record<string, string>>) {
  return assertSafeStagingEnvironment(environment, testPolicy);
}

function attestationOptions(fetchImpl: typeof fetch) {
  return {
    fetchImpl,
    runnerVercelAutomationBypassSecret:
      safeEnvironment.E2E_VERCEL_AUTOMATION_BYPASS_SECRET,
  };
}

test("mutation guard accepts only an explicitly isolated target", () => {
  const inspection = inspect(safeEnvironment);
  expect(inspection.ok).toBe(true);
  expect(assertSafe(safeEnvironment).projectRef).toBe(
    "stagingref123",
  );
});

test("runner-only Vercel bypass is validated separately from deployment identity", () => {
  const deploymentEnvironment = Object.fromEntries(
    Object.entries(safeEnvironment).filter(
      ([name]) => name !== "E2E_VERCEL_AUTOMATION_BYPASS_SECRET",
    ),
  );

  expect(inspect(deploymentEnvironment).ok).toBe(true);
  expect(() =>
    assertRunnerVercelAutomationBypass(deploymentEnvironment),
  ).toThrow(/runner is missing a valid Vercel automation bypass/i);
  expect(assertRunnerVercelAutomationBypass(safeEnvironment)).toBe(
    safeEnvironment.E2E_VERCEL_AUTOMATION_BYPASS_SECRET,
  );
});

test("runner-only Vercel bypass rejects placeholders and malformed capabilities", () => {
  const invalidSecrets = [
    "",
    "replace-with-vercel-bypass-secret",
    "too-short",
    "0123456789abcdefghij\nklmnopqrst",
  ];

  for (const bypassSecret of invalidSecrets) {
    expect(() =>
      assertRunnerVercelAutomationBypass({
        E2E_VERCEL_AUTOMATION_BYPASS_SECRET: bypassSecret,
      }),
    ).toThrow(/runner is missing a valid Vercel automation bypass/i);
  }
});

test("mutation guard remains closed until staging is version-allowlisted", () => {
  const inspection = inspectStagingEnvironment(safeEnvironment);

  expect(inspection.ok).toBe(false);
  expect(inspection.errors.map(({ code }) => code)).toContain(
    "STAGING_PROJECT_NOT_ALLOWLISTED",
  );
});

test("mutation guard rejects production and disabled mutations", () => {
  const inspection = inspect({
    ...safeEnvironment,
    E2E_ALLOW_MUTATIONS: "false",
    VERCEL_ENV: "production",
  });

  expect(inspection.ok).toBe(false);
  expect(inspection.errors.map(({ code }) => code)).toEqual(
    expect.arrayContaining(["MUTATIONS_NOT_ALLOWED", "NON_PREVIEW_VERCEL_ENV"]),
  );
});

test("mutation guard rejects non-preview environments", () => {
  const inspection = inspect({
    ...safeEnvironment,
    VERCEL_ENV: "development",
  });

  expect(inspection.ok).toBe(false);
  expect(inspection.errors.map(({ code }) => code)).toContain(
    "NON_PREVIEW_VERCEL_ENV",
  );
});

test("mutation guard rejects the versioned production Supabase project", () => {
  const productionProjectRef = PRODUCTION_PROJECT_REFS[0]!;
  const inspection = inspect({
    ...safeEnvironment,
    NEXT_PUBLIC_SUPABASE_URL: `https://${productionProjectRef}.supabase.co`,
    E2E_EXPECTED_PROJECT_REF: productionProjectRef,
  });

  expect(inspection.ok).toBe(false);
  expect(inspection.errors.map(({ code }) => code)).toEqual(
    expect.arrayContaining([
      "PRODUCTION_PROJECT_REF",
      "PRODUCTION_SUPABASE_PROJECT",
    ]),
  );
});

test("mutation guard rejects the versioned production application origin", () => {
  const productionAppOrigin = PRODUCTION_APP_ORIGINS[0]!;
  const inspection = inspect({
    ...safeEnvironment,
    E2E_BASE_URL: productionAppOrigin,
    E2E_EXPECTED_APP_ORIGIN: productionAppOrigin,
  });

  expect(inspection.ok).toBe(false);
  expect(inspection.errors.map(({ code }) => code)).toContain(
    "PRODUCTION_APP_ORIGIN",
  );
});

test("mutation guard rejects an application origin mismatch", () => {
  const inspection = inspect({
    ...safeEnvironment,
    PLAYWRIGHT_BASE_URL: "https://other-preview.vercel.app",
  });

  expect(inspection.ok).toBe(false);
  expect(inspection.errors.map(({ code }) => code)).toContain(
    "APP_ORIGIN_MISMATCH",
  );
});

test("mutation guard rejects a non-canonical Supabase URL", () => {
  const inspection = inspect({
    ...safeEnvironment,
    NEXT_PUBLIC_SUPABASE_URL:
      "https://stagingref123.supabase.co/rest/v1?unsafe=true",
  });

  expect(inspection.ok).toBe(false);
  expect(inspection.errors.map(({ code }) => code)).toContain(
    "SUPABASE_URL_NOT_CANONICAL",
  );
});

test("database marker verification is read-only", async () => {
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    limit() {
      return this;
    },
    async maybeSingle() {
      return { data: { id: "crm_v4_e2e" }, error: null };
    },
  };
  const client = { from: () => query };

  const result = await assertStagingDatabaseMarker(
    assertSafe(safeEnvironment),
    { client: client as never },
  );

  expect(result.markerVerified).toBe(true);
});

test("database marker rejects query errors, missing rows, and mismatches", async () => {
  const config = assertSafe(safeEnvironment);
  const clientFor = (data: object | null, error: object | null = null) => ({
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      limit() {
        return this;
      },
      async maybeSingle() {
        return { data, error };
      },
    }),
  });

  await expect(
    assertStagingDatabaseMarker(config, {
      client: clientFor(null, { message: "denied" }) as never,
    }),
  ).rejects.toMatchObject({
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "MARKER_QUERY_FAILED" }),
    ]),
  });
  await expect(
    assertStagingDatabaseMarker(config, {
      client: clientFor(null) as never,
    }),
  ).rejects.toMatchObject({
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "MARKER_NOT_FOUND" }),
    ]),
  });
  await expect(
    assertStagingDatabaseMarker(config, {
      client: clientFor({ id: "wrong-marker" }) as never,
    }),
  ).rejects.toMatchObject({
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "MARKER_ID_MISMATCH" }),
    ]),
  });
  await expect(
    assertStagingDatabaseMarker({} as never, {
      client: clientFor({ id: "crm_v4_e2e" }) as never,
    }),
  ).rejects.toMatchObject({
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "UNVALIDATED_GUARD_CONFIG" }),
    ]),
  });
});

test("deployment attestation binds the preview to the same staging identity", async () => {
  const verifiedConfig = {
    ...assertSafe(safeEnvironment),
    markerVerified: true as const,
  };
  const payload = {
    version: 1,
    appOrigin: verifiedConfig.appOrigin,
    vercelEnvironment: "preview",
    projectRef: verifiedConfig.projectRef,
    markerVerified: true,
  };
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    expect(input).toBe(
      `${verifiedConfig.appOrigin}/api/e2e/attestation`,
    );
    expect(init?.redirect).toBe("error");
    expect(init?.cache).toBe("no-store");
    const headers = new Headers(init?.headers);
    expect(headers.get("x-e2e-attestation-token")).toBe(
      verifiedConfig.attestationToken,
    );
    expect(headers.get("x-vercel-protection-bypass")).toBe(
      safeEnvironment.E2E_VERCEL_AUTOMATION_BYPASS_SECRET,
    );
    expect(headers.get("x-vercel-set-bypass-cookie")).toBeNull();
    return {
      ok: true,
      status: 200,
      redirected: false,
      url: `${verifiedConfig.appOrigin}/api/e2e/attestation`,
      json: async () => payload,
    };
  }) as unknown as typeof fetch;

  await expect(
    assertStagingDeploymentAttestation(
      verifiedConfig,
      attestationOptions(fetchImpl),
    ),
  ).resolves.toEqual({ ...verifiedConfig, deploymentAttested: true });
});

test("deployment attestation refuses to fetch without the runner-only bypass", async () => {
  const verifiedConfig = {
    ...assertSafe(safeEnvironment),
    markerVerified: true as const,
  };
  let fetchCalled = false;
  const fetchImpl = (async () => {
    fetchCalled = true;
    throw new Error("must not fetch");
  }) as unknown as typeof fetch;

  await expect(
    assertStagingDeploymentAttestation(verifiedConfig, { fetchImpl }),
  ).rejects.toMatchObject({
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "VERCEL_AUTOMATION_BYPASS_INVALID" }),
    ]),
  });
  expect(fetchCalled).toBe(false);
});

test("deployment attestation rejects redirects and identity drift", async () => {
  const verifiedConfig = {
    ...assertSafe(safeEnvironment),
    markerVerified: true as const,
  };
  const responseFor = (
    url: string,
    projectRef: string,
    redirected = false,
  ) =>
    (async () => ({
      ok: true,
      status: 200,
      redirected,
      url,
      json: async () => ({
        version: 1,
        appOrigin: verifiedConfig.appOrigin,
        vercelEnvironment: "preview",
        projectRef,
        markerVerified: true,
      }),
    })) as unknown as typeof fetch;

  await expect(
    assertStagingDeploymentAttestation(verifiedConfig, {
      ...attestationOptions(
        responseFor(
          "https://crm.pakora.online/api/e2e/attestation",
          verifiedConfig.projectRef,
        ),
      ),
    }),
  ).rejects.toMatchObject({
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "ATTESTATION_ORIGIN_MISMATCH" }),
    ]),
  });
  await expect(
    assertStagingDeploymentAttestation(verifiedConfig, {
      ...attestationOptions(
        responseFor(
          `${verifiedConfig.appOrigin}/login`,
          verifiedConfig.projectRef,
          true,
        ),
      ),
    }),
  ).rejects.toMatchObject({
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "ATTESTATION_REDIRECTED" }),
    ]),
  });
  await expect(
    assertStagingDeploymentAttestation(verifiedConfig, {
      ...attestationOptions(
        responseFor(
          `${verifiedConfig.appOrigin}/api/e2e/attestation`,
          "different-staging-ref",
        ),
      ),
    }),
  ).rejects.toMatchObject({
    issues: expect.arrayContaining([
      expect.objectContaining({ code: "ATTESTATION_IDENTITY_MISMATCH" }),
    ]),
  });
});
