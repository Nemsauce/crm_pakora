#!/usr/bin/env node

import { inspectStagingEnvironment } from "./staging-guard.mjs";

const inspection = inspectStagingEnvironment({});
const rejectionCodes = new Set(inspection.errors.map(({ code }) => code));
const requiredRejections = [
  "MUTATIONS_NOT_ALLOWED",
  "VERCEL_ENV_MISSING",
  "APP_ORIGIN_INVALID",
  "ATTESTATION_TOKEN_INVALID",
  "SUPABASE_URL_INVALID",
  "EXPECTED_PROJECT_REF_INVALID",
  "STAGING_PROJECT_NOT_ALLOWLISTED",
  "SERVICE_ROLE_KEY_MISSING",
  "MARKER_TABLE_MISSING",
  "MARKER_ID_MISSING",
];
const missingRejections = requiredRejections.filter(
  (code) => !rejectionCodes.has(code),
);

if (inspection.ok || inspection.config || missingRejections.length > 0) {
  throw new Error(
    `The empty staging environment did not fail closed. Missing rejection codes: ${
      missingRejections.join(", ") || "none"
    }`,
  );
}

process.stdout.write(
  `Empty staging environment rejected fail-closed (${inspection.errors.length} guard issues).\n`,
);
