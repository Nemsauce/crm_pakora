import { createClient } from "@supabase/supabase-js";

export const PRODUCTION_PROJECT_REFS = Object.freeze([
  "nauqpgsspwfqkxidenkx",
]);
export const PRODUCTION_APP_ORIGINS = Object.freeze([
  "https://crm.pakora.online",
]);
// Environment variables alone cannot authorize a mutable target. Every ref in
// this list is reviewed, schema-audited, marker-protected staging infrastructure.
export const ALLOWED_STAGING_PROJECT_REFS = Object.freeze([
  "qmpcthkbrckjeedbxgkw",
]);

export const STAGING_GUARD_ENV_NAMES = Object.freeze({
  allowMutations: "E2E_ALLOW_MUTATIONS",
  vercelEnvironment: "VERCEL_ENV",
  appBaseUrl: "E2E_BASE_URL",
  playwrightBaseUrl: "PLAYWRIGHT_BASE_URL",
  expectedAppOrigin: "E2E_EXPECTED_APP_ORIGIN",
  attestationToken: "E2E_ATTESTATION_TOKEN",
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL",
  expectedProjectRef: "E2E_EXPECTED_PROJECT_REF",
  serviceRoleKey: "SUPABASE_SERVICE_ROLE_KEY",
  markerTable: "E2E_STAGING_MARKER_TABLE",
  markerId: "E2E_STAGING_MARKER_ID",
  markerIdColumn: "E2E_STAGING_MARKER_ID_COLUMN",
  runnerVercelAutomationBypassSecret:
    "E2E_VERCEL_AUTOMATION_BYPASS_SECRET",
});

const DEFAULT_MARKER_ID_COLUMN = "id";
const POSTGRES_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SUPABASE_PROJECT_REF = /^[a-z0-9][a-z0-9-]{2,62}$/;
const VERCEL_AUTOMATION_BYPASS_SECRET = /^[A-Za-z0-9]{32}$/;
const PLACEHOLDER = /(?:replace-with|change-?me|your-|example)/i;

function valueFrom(environment, name) {
  const value = environment?.[name];
  return typeof value === "string" ? value.trim() : "";
}

function issue(code, message, environmentName) {
  return Object.freeze({ code, message, environmentName });
}

function missingOrPlaceholder(value) {
  return value.length === 0 || PLACEHOLDER.test(value);
}

function freezeInspection(ok, errors, config) {
  return Object.freeze({
    ok,
    errors: Object.freeze(errors),
    config: config ? Object.freeze(config) : null,
  });
}

function parseCanonicalOrigin(value, environmentName, errors) {
  if (missingOrPlaceholder(value)) {
    errors.push(
      issue(
        "APP_ORIGIN_INVALID",
        `${environmentName} must contain an explicit staging application origin.`,
        environmentName,
      ),
    );
    return null;
  }

  try {
    const parsed = new URL(value);
    const canonicalValue = parsed.origin;
    const normalizedInput = value.replace(/\/$/, "");

    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      normalizedInput !== canonicalValue
    ) {
      errors.push(
        issue(
          "APP_ORIGIN_NOT_CANONICAL",
          `${environmentName} must be a canonical HTTPS origin without credentials, path, query, or hash.`,
          environmentName,
        ),
      );
      return null;
    }

    return canonicalValue;
  } catch {
    errors.push(
      issue(
        "APP_ORIGIN_INVALID",
        `${environmentName} must be a valid URL origin.`,
        environmentName,
      ),
    );
    return null;
  }
}

/**
 * Pure, side-effect-free validation for the environment gates that must pass
 * before any mutable E2E test is allowed to run.
 */
export function inspectStagingEnvironment(
  environment = process.env,
  policy = {},
) {
  const errors = [];
  const allowedStagingProjectRefs =
    policy.allowedStagingProjectRefs ?? ALLOWED_STAGING_PROJECT_REFS;
  const allowMutations = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.allowMutations,
  );
  const vercelEnvironment = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.vercelEnvironment,
  );
  const playwrightBaseUrl = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.playwrightBaseUrl,
  );
  const e2eBaseUrl = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.appBaseUrl,
  );
  const appBaseUrl = playwrightBaseUrl || e2eBaseUrl;
  const appBaseUrlEnvironmentName = playwrightBaseUrl
    ? STAGING_GUARD_ENV_NAMES.playwrightBaseUrl
    : STAGING_GUARD_ENV_NAMES.appBaseUrl;
  const expectedAppOriginValue = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.expectedAppOrigin,
  );
  const attestationToken = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.attestationToken,
  );
  const supabaseUrl = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.supabaseUrl,
  );
  const expectedProjectRef = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.expectedProjectRef,
  ).toLowerCase();
  const supabaseServiceRoleKey = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.serviceRoleKey,
  );
  const markerTable = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.markerTable,
  );
  const markerId = valueFrom(environment, STAGING_GUARD_ENV_NAMES.markerId);
  const markerIdColumn =
    valueFrom(environment, STAGING_GUARD_ENV_NAMES.markerIdColumn) ||
    DEFAULT_MARKER_ID_COLUMN;

  if (allowMutations !== "true") {
    errors.push(
      issue(
        "MUTATIONS_NOT_ALLOWED",
        `${STAGING_GUARD_ENV_NAMES.allowMutations} must be exactly "true".`,
        STAGING_GUARD_ENV_NAMES.allowMutations,
      ),
    );
  }

  if (!vercelEnvironment) {
    errors.push(
      issue(
        "VERCEL_ENV_MISSING",
        `${STAGING_GUARD_ENV_NAMES.vercelEnvironment} is required and must identify a non-production environment.`,
        STAGING_GUARD_ENV_NAMES.vercelEnvironment,
      ),
    );
  } else if (vercelEnvironment.toLowerCase() !== "preview") {
    errors.push(
      issue(
        "NON_PREVIEW_VERCEL_ENV",
        "Mutable E2E tests require VERCEL_ENV to be exactly preview.",
        STAGING_GUARD_ENV_NAMES.vercelEnvironment,
      ),
    );
  }

  if (
    missingOrPlaceholder(expectedProjectRef) ||
    !SUPABASE_PROJECT_REF.test(expectedProjectRef)
  ) {
    errors.push(
      issue(
        "EXPECTED_PROJECT_REF_INVALID",
        `${STAGING_GUARD_ENV_NAMES.expectedProjectRef} must contain the exact staging Supabase project ref.`,
        STAGING_GUARD_ENV_NAMES.expectedProjectRef,
      ),
    );
  }

  if (missingOrPlaceholder(attestationToken) || attestationToken.length < 32) {
    errors.push(
      issue(
        "ATTESTATION_TOKEN_INVALID",
        `${STAGING_GUARD_ENV_NAMES.attestationToken} must be a staging-only secret of at least 32 characters.`,
        STAGING_GUARD_ENV_NAMES.attestationToken,
      ),
    );
  }

  if (PRODUCTION_PROJECT_REFS.includes(expectedProjectRef)) {
    errors.push(
      issue(
        "PRODUCTION_PROJECT_REF",
        "The expected staging project ref matches a versioned production denylist entry.",
        STAGING_GUARD_ENV_NAMES.expectedProjectRef,
      ),
    );
  }

  if (!allowedStagingProjectRefs.includes(expectedProjectRef)) {
    errors.push(
      issue(
        "STAGING_PROJECT_NOT_ALLOWLISTED",
        "The expected project ref is not in the versioned staging allowlist.",
        STAGING_GUARD_ENV_NAMES.expectedProjectRef,
      ),
    );
  }

  const appOrigin = parseCanonicalOrigin(
    appBaseUrl,
    appBaseUrlEnvironmentName,
    errors,
  );
  const expectedAppOrigin = parseCanonicalOrigin(
    expectedAppOriginValue,
    STAGING_GUARD_ENV_NAMES.expectedAppOrigin,
    errors,
  );

  if (
    appOrigin &&
    expectedAppOrigin &&
    appOrigin !== expectedAppOrigin
  ) {
    errors.push(
      issue(
        "APP_ORIGIN_MISMATCH",
        "The Playwright application origin must exactly match the expected staging origin.",
        STAGING_GUARD_ENV_NAMES.expectedAppOrigin,
      ),
    );
  }

  if (
    (appOrigin && PRODUCTION_APP_ORIGINS.includes(appOrigin)) ||
    (expectedAppOrigin && PRODUCTION_APP_ORIGINS.includes(expectedAppOrigin))
  ) {
    errors.push(
      issue(
        "PRODUCTION_APP_ORIGIN",
        "Authenticated or mutable E2E tests must never target a production application origin.",
        STAGING_GUARD_ENV_NAMES.expectedAppOrigin,
      ),
    );
  }

  let parsedSupabaseUrl = null;
  if (missingOrPlaceholder(supabaseUrl)) {
    errors.push(
      issue(
        "SUPABASE_URL_INVALID",
        `${STAGING_GUARD_ENV_NAMES.supabaseUrl} must contain the staging project URL.`,
        STAGING_GUARD_ENV_NAMES.supabaseUrl,
      ),
    );
  } else {
    try {
      parsedSupabaseUrl = new URL(supabaseUrl);
    } catch {
      errors.push(
        issue(
          "SUPABASE_URL_INVALID",
          `${STAGING_GUARD_ENV_NAMES.supabaseUrl} must be a valid URL.`,
          STAGING_GUARD_ENV_NAMES.supabaseUrl,
        ),
      );
    }
  }

  if (parsedSupabaseUrl) {
    const expectedHostname = `${expectedProjectRef}.supabase.co`;

    if (
      parsedSupabaseUrl.protocol !== "https:" ||
      parsedSupabaseUrl.port ||
      parsedSupabaseUrl.username ||
      parsedSupabaseUrl.password ||
      parsedSupabaseUrl.pathname !== "/" ||
      parsedSupabaseUrl.search ||
      parsedSupabaseUrl.hash ||
      supabaseUrl.replace(/\/$/, "") !== parsedSupabaseUrl.origin
    ) {
      errors.push(
        issue(
          "SUPABASE_URL_NOT_CANONICAL",
          `${STAGING_GUARD_ENV_NAMES.supabaseUrl} must use the canonical HTTPS Supabase origin without credentials or a custom port.`,
          STAGING_GUARD_ENV_NAMES.supabaseUrl,
        ),
      );
    }

    if (
      expectedProjectRef &&
      parsedSupabaseUrl.hostname.toLowerCase() !== expectedHostname
    ) {
      errors.push(
        issue(
          "SUPABASE_HOST_MISMATCH",
          `Supabase hostname must be exactly ${expectedHostname}.`,
          STAGING_GUARD_ENV_NAMES.supabaseUrl,
        ),
      );
    }

    if (
      PRODUCTION_PROJECT_REFS.some(
        (projectRef) =>
          parsedSupabaseUrl.hostname.toLowerCase() ===
          `${projectRef}.supabase.co`,
      )
    ) {
      errors.push(
        issue(
          "PRODUCTION_SUPABASE_PROJECT",
          "Mutable E2E tests must never target the production Supabase project.",
          STAGING_GUARD_ENV_NAMES.supabaseUrl,
        ),
      );
    }
  }

  if (missingOrPlaceholder(supabaseServiceRoleKey)) {
    errors.push(
      issue(
        "SERVICE_ROLE_KEY_MISSING",
        `${STAGING_GUARD_ENV_NAMES.serviceRoleKey} is required for the staging marker check.`,
        STAGING_GUARD_ENV_NAMES.serviceRoleKey,
      ),
    );
  }

  if (missingOrPlaceholder(markerTable)) {
    errors.push(
      issue(
        "MARKER_TABLE_MISSING",
        `${STAGING_GUARD_ENV_NAMES.markerTable} is required.`,
        STAGING_GUARD_ENV_NAMES.markerTable,
      ),
    );
  } else if (!POSTGRES_IDENTIFIER.test(markerTable)) {
    errors.push(
      issue(
        "MARKER_TABLE_INVALID",
        `${STAGING_GUARD_ENV_NAMES.markerTable} must be a plain PostgreSQL identifier.`,
        STAGING_GUARD_ENV_NAMES.markerTable,
      ),
    );
  }

  if (missingOrPlaceholder(markerId)) {
    errors.push(
      issue(
        "MARKER_ID_MISSING",
        `${STAGING_GUARD_ENV_NAMES.markerId} is required and must identify a staging-only row.`,
        STAGING_GUARD_ENV_NAMES.markerId,
      ),
    );
  }

  if (!POSTGRES_IDENTIFIER.test(markerIdColumn)) {
    errors.push(
      issue(
        "MARKER_ID_COLUMN_INVALID",
        `${STAGING_GUARD_ENV_NAMES.markerIdColumn} must be a plain PostgreSQL identifier.`,
        STAGING_GUARD_ENV_NAMES.markerIdColumn,
      ),
    );
  }

  if (
    errors.length > 0 ||
    !parsedSupabaseUrl ||
    !appOrigin ||
    !expectedAppOrigin
  ) {
    return freezeInspection(false, errors, null);
  }

  return freezeInspection(true, [], {
    environmentVerified: true,
    allowMutations: true,
    vercelEnvironment,
    appOrigin,
    supabaseUrl: parsedSupabaseUrl.origin,
    projectRef: expectedProjectRef,
    productionProjectRefs: PRODUCTION_PROJECT_REFS,
    attestationToken,
    supabaseServiceRoleKey,
    markerTable,
    markerId,
    markerIdColumn,
  });
}

export class StagingGuardError extends Error {
  constructor(message, issues = [], options) {
    super(message, options);
    this.name = "StagingGuardError";
    this.issues = Object.freeze([...issues]);
  }
}

/**
 * Validates the Vercel Deployment Protection capability held by the E2E
 * runner. This deliberately remains separate from StagingGuardConfig because
 * the deployed attestation endpoint validates that config too and must never
 * require or expose the runner-only bypass secret.
 */
export function assertRunnerVercelAutomationBypass(
  environment = process.env,
) {
  const bypassSecret = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.runnerVercelAutomationBypassSecret,
  );

  if (
    missingOrPlaceholder(bypassSecret) ||
    !VERCEL_AUTOMATION_BYPASS_SECRET.test(bypassSecret)
  ) {
    throw new StagingGuardError(
      "The E2E runner is missing a valid Vercel automation bypass capability.",
      [
        issue(
          "VERCEL_AUTOMATION_BYPASS_INVALID",
          `${STAGING_GUARD_ENV_NAMES.runnerVercelAutomationBypassSecret} must contain the 32-character alphanumeric secret generated by Vercel Deployment Protection.`,
          STAGING_GUARD_ENV_NAMES.runnerVercelAutomationBypassSecret,
        ),
      ],
    );
  }

  return bypassSecret;
}

export function assertSafeStagingEnvironment(
  environment = process.env,
  policy = {},
) {
  const inspection = inspectStagingEnvironment(environment, policy);

  if (!inspection.ok || !inspection.config) {
    const detail = inspection.errors
      .map(({ code, message }) => `[${code}] ${message}`)
      .join("\n");
    throw new StagingGuardError(
      `E2E staging guard rejected this environment.${detail ? `\n${detail}` : ""}`,
      inspection.errors,
    );
  }

  return inspection.config;
}

/**
 * Executes one read-only lookup for a marker row that must exist exclusively in
 * staging. This function never inserts, updates, upserts, invokes an RPC, or
 * deletes data.
 */
export async function assertStagingDatabaseMarker(config, options = {}) {
  if (
    config?.environmentVerified !== true ||
    !config?.supabaseUrl ||
    !config?.supabaseServiceRoleKey
  ) {
    throw new StagingGuardError(
      "A validated staging guard config is required before checking the database marker.",
      [
        issue(
          "UNVALIDATED_GUARD_CONFIG",
          "Call assertSafeStagingEnvironment before assertStagingDatabaseMarker.",
        ),
      ],
    );
  }

  const clientFactory = options.clientFactory ?? createClient;
  const client =
    options.client ??
    clientFactory(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });

  let response;
  try {
    response = await client
      .from(config.markerTable)
      .select(config.markerIdColumn)
      .eq(config.markerIdColumn, config.markerId)
      .limit(1)
      .maybeSingle();
  } catch (error) {
    throw new StagingGuardError(
      "The staging-only database marker could not be queried.",
      [
        issue(
          "MARKER_QUERY_FAILED",
          "The read-only staging marker query threw an exception.",
          STAGING_GUARD_ENV_NAMES.markerTable,
        ),
      ],
      { cause: error },
    );
  }

  if (response.error) {
    throw new StagingGuardError(
      `The staging-only database marker query failed: ${response.error.message}`,
      [
        issue(
          "MARKER_QUERY_FAILED",
          "The configured staging marker table could not be read.",
          STAGING_GUARD_ENV_NAMES.markerTable,
        ),
      ],
      { cause: response.error },
    );
  }

  if (!response.data) {
    throw new StagingGuardError(
      "The required staging-only database marker row was not found.",
      [
        issue(
          "MARKER_NOT_FOUND",
          `Expected ${config.markerTable}.${config.markerIdColumn}=${config.markerId}.`,
          STAGING_GUARD_ENV_NAMES.markerId,
        ),
      ],
    );
  }

  const returnedMarkerId = response.data[config.markerIdColumn];
  if (String(returnedMarkerId) !== config.markerId) {
    throw new StagingGuardError(
      "The staging-only database marker returned an unexpected identifier.",
      [
        issue(
          "MARKER_ID_MISMATCH",
          "The marker response did not match the configured staging marker id.",
          STAGING_GUARD_ENV_NAMES.markerId,
        ),
      ],
    );
  }

  return Object.freeze({ ...config, markerVerified: true });
}

export async function assertStagingEnvironment(
  environment = process.env,
  options = {},
) {
  const config = assertSafeStagingEnvironment(environment, options);
  return assertStagingDatabaseMarker(config, options);
}

export async function assertStagingDeploymentAttestation(config, options = {}) {
  if (!config?.markerVerified || !config?.appOrigin || !config?.attestationToken) {
    throw new StagingGuardError(
      "A marker-verified staging guard config is required before deployment attestation.",
      [
        issue(
          "UNVERIFIED_DEPLOYMENT_CONFIG",
          "Call assertStagingEnvironment before deployment attestation.",
        ),
      ],
    );
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new StagingGuardError("Deployment attestation requires fetch support.", [
      issue("ATTESTATION_FETCH_UNAVAILABLE", "No fetch implementation exists."),
    ]);
  }

  const runnerVercelAutomationBypassSecret =
    assertRunnerVercelAutomationBypass({
      [STAGING_GUARD_ENV_NAMES.runnerVercelAutomationBypassSecret]:
        options.runnerVercelAutomationBypassSecret,
    });

  const attestationUrl = `${config.appOrigin}/api/e2e/attestation`;
  let response;
  try {
    response = await fetchImpl(attestationUrl, {
      method: "GET",
      headers: {
        "x-e2e-attestation-token": config.attestationToken,
        "x-vercel-protection-bypass":
          runnerVercelAutomationBypassSecret,
      },
      redirect: "error",
      cache: "no-store",
    });
  } catch (error) {
    throw new StagingGuardError(
      "The staging deployment attestation endpoint could not be reached.",
      [
        issue(
          "ATTESTATION_REQUEST_FAILED",
          "The attestation request threw before a response was received.",
          STAGING_GUARD_ENV_NAMES.expectedAppOrigin,
        ),
      ],
      { cause: error },
    );
  }

  let responseOrigin = null;
  let responseUrl = null;
  try {
    responseUrl = new URL(response.url).href;
    responseOrigin = new URL(response.url).origin;
  } catch {
    // The explicit mismatch below reports malformed or missing response URLs.
  }

  if (responseOrigin !== config.appOrigin) {
    throw new StagingGuardError(
      "The attestation request left the expected staging application origin.",
      [
        issue(
          "ATTESTATION_ORIGIN_MISMATCH",
          "Redirects to another preview or production origin are forbidden.",
          STAGING_GUARD_ENV_NAMES.expectedAppOrigin,
        ),
      ],
    );
  }

  if (response.redirected === true || responseUrl !== attestationUrl) {
    throw new StagingGuardError(
      "The attestation endpoint redirected or changed its canonical URL.",
      [
        issue(
          "ATTESTATION_REDIRECTED",
          "The attestation response must come directly from the exact endpoint URL.",
          STAGING_GUARD_ENV_NAMES.expectedAppOrigin,
        ),
      ],
    );
  }

  if (!response.ok) {
    throw new StagingGuardError(
      `The staging deployment attestation endpoint returned HTTP ${response.status}.`,
      [
        issue(
          "ATTESTATION_HTTP_ERROR",
          "The target deployment did not attest its staging identity.",
          STAGING_GUARD_ENV_NAMES.expectedAppOrigin,
        ),
      ],
    );
  }

  let attestation;
  try {
    attestation = await response.json();
  } catch (error) {
    throw new StagingGuardError(
      "The staging deployment returned an invalid attestation payload.",
      [issue("ATTESTATION_PAYLOAD_INVALID", "Expected a JSON payload.")],
      { cause: error },
    );
  }

  if (
    attestation?.version !== 1 ||
    attestation?.appOrigin !== config.appOrigin ||
    attestation?.vercelEnvironment !== "preview" ||
    attestation?.projectRef !== config.projectRef ||
    attestation?.markerVerified !== true
  ) {
    throw new StagingGuardError(
      "The staging deployment attestation does not match the runner configuration.",
      [
        issue(
          "ATTESTATION_IDENTITY_MISMATCH",
          "App origin, Vercel environment, Supabase ref and marker must all match.",
          STAGING_GUARD_ENV_NAMES.expectedAppOrigin,
        ),
      ],
    );
  }

  return Object.freeze({ ...config, deploymentAttested: true });
}

export async function assertStagingDeployment(
  environment = process.env,
  options = {},
) {
  const runnerVercelAutomationBypassSecret =
    assertRunnerVercelAutomationBypass(environment);
  const config = await assertStagingEnvironment(environment, options);
  return assertStagingDeploymentAttestation(config, {
    ...options,
    runnerVercelAutomationBypassSecret,
  });
}
