import { expect, test } from "@playwright/test";

import {
  assertSafeStagingEnvironment,
  assertStagingDatabaseMarker,
  inspectStagingEnvironment,
} from "../../../scripts/e2e/staging-guard.mjs";

const safeEnvironment = {
  E2E_ALLOW_MUTATIONS: "true",
  VERCEL_ENV: "preview",
  NEXT_PUBLIC_SUPABASE_URL: "https://stagingref123.supabase.co",
  E2E_EXPECTED_PROJECT_REF: "stagingref123",
  E2E_PRODUCTION_PROJECT_REF: "productionref456",
  SUPABASE_SERVICE_ROLE_KEY: "e2e-test-service-role-key",
  E2E_STAGING_MARKER_TABLE: "e2e_environment_guard",
  E2E_STAGING_MARKER_ID: "crm_v4_e2e",
  E2E_STAGING_MARKER_ID_COLUMN: "id",
} as const;

test("mutation guard accepts only an explicitly isolated target", () => {
  const inspection = inspectStagingEnvironment(safeEnvironment);
  expect(inspection.ok).toBe(true);
  expect(assertSafeStagingEnvironment(safeEnvironment).projectRef).toBe(
    "stagingref123",
  );
});

test("mutation guard rejects production and disabled mutations", () => {
  const inspection = inspectStagingEnvironment({
    ...safeEnvironment,
    E2E_ALLOW_MUTATIONS: "false",
    VERCEL_ENV: "production",
  });

  expect(inspection.ok).toBe(false);
  expect(inspection.errors.map(({ code }) => code)).toEqual(
    expect.arrayContaining(["MUTATIONS_NOT_ALLOWED", "PRODUCTION_VERCEL_ENV"]),
  );
});

test("mutation guard rejects a staging ref equal to production", () => {
  const inspection = inspectStagingEnvironment({
    ...safeEnvironment,
    E2E_PRODUCTION_PROJECT_REF: "stagingref123",
  });

  expect(inspection.ok).toBe(false);
  expect(inspection.errors.map(({ code }) => code)).toContain(
    "PROJECT_REFS_MATCH",
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
    assertSafeStagingEnvironment(safeEnvironment),
    { client: client as never },
  );

  expect(result.markerVerified).toBe(true);
});
