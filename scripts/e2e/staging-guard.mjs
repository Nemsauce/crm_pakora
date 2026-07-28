import { createClient } from "@supabase/supabase-js";

export const STAGING_GUARD_ENV_NAMES = Object.freeze({
  allowMutations: "E2E_ALLOW_MUTATIONS",
  vercelEnvironment: "VERCEL_ENV",
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL",
  expectedProjectRef: "E2E_EXPECTED_PROJECT_REF",
  productionProjectRef: "E2E_PRODUCTION_PROJECT_REF",
  serviceRoleKey: "SUPABASE_SERVICE_ROLE_KEY",
  markerTable: "E2E_STAGING_MARKER_TABLE",
  markerId: "E2E_STAGING_MARKER_ID",
  markerIdColumn: "E2E_STAGING_MARKER_ID_COLUMN",
});

const DEFAULT_MARKER_ID_COLUMN = "id";
const POSTGRES_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SUPABASE_PROJECT_REF = /^[a-z0-9][a-z0-9-]{2,62}$/;
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

/**
 * Pure, side-effect-free validation for the environment gates that must pass
 * before any mutable E2E test is allowed to run.
 */
export function inspectStagingEnvironment(environment = process.env) {
  const errors = [];
  const allowMutations = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.allowMutations,
  );
  const vercelEnvironment = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.vercelEnvironment,
  );
  const supabaseUrl = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.supabaseUrl,
  );
  const expectedProjectRef = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.expectedProjectRef,
  ).toLowerCase();
  const productionProjectRef = valueFrom(
    environment,
    STAGING_GUARD_ENV_NAMES.productionProjectRef,
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
  } else if (vercelEnvironment.toLowerCase() === "production") {
    errors.push(
      issue(
        "PRODUCTION_VERCEL_ENV",
        "Mutable E2E tests are forbidden when VERCEL_ENV is production.",
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

  if (
    missingOrPlaceholder(productionProjectRef) ||
    !SUPABASE_PROJECT_REF.test(productionProjectRef)
  ) {
    errors.push(
      issue(
        "PRODUCTION_PROJECT_REF_INVALID",
        `${STAGING_GUARD_ENV_NAMES.productionProjectRef} must contain the exact production Supabase project ref.`,
        STAGING_GUARD_ENV_NAMES.productionProjectRef,
      ),
    );
  }

  if (
    expectedProjectRef &&
    productionProjectRef &&
    expectedProjectRef === productionProjectRef
  ) {
    errors.push(
      issue(
        "PROJECT_REFS_MATCH",
        "The expected staging project ref must not match the production project ref.",
        STAGING_GUARD_ENV_NAMES.expectedProjectRef,
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
    const productionHostname = `${productionProjectRef}.supabase.co`;

    if (
      parsedSupabaseUrl.protocol !== "https:" ||
      parsedSupabaseUrl.port ||
      parsedSupabaseUrl.username ||
      parsedSupabaseUrl.password
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
      productionProjectRef &&
      parsedSupabaseUrl.hostname.toLowerCase() === productionHostname
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

  if (errors.length > 0 || !parsedSupabaseUrl) {
    return freezeInspection(false, errors, null);
  }

  return freezeInspection(true, [], {
    allowMutations: true,
    vercelEnvironment,
    supabaseUrl: parsedSupabaseUrl.origin,
    projectRef: expectedProjectRef,
    productionProjectRef,
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

export function assertSafeStagingEnvironment(environment = process.env) {
  const inspection = inspectStagingEnvironment(environment);

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
  if (!config?.supabaseUrl || !config?.supabaseServiceRoleKey) {
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
  const config = assertSafeStagingEnvironment(environment);
  return assertStagingDatabaseMarker(config, options);
}
