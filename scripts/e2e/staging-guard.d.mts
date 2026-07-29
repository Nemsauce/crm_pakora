import type { SupabaseClient, createClient } from "@supabase/supabase-js";

export type StagingGuardEnvironment = Readonly<
  Record<string, string | undefined>
>;

export interface StagingGuardIssue {
  readonly code: string;
  readonly message: string;
  readonly environmentName?: string;
}

export interface StagingGuardConfig {
  readonly environmentVerified: true;
  readonly allowMutations: true;
  readonly vercelEnvironment: string;
  readonly appOrigin: string;
  readonly supabaseUrl: string;
  readonly projectRef: string;
  readonly productionProjectRefs: readonly string[];
  readonly attestationToken: string;
  readonly supabaseServiceRoleKey: string;
  readonly markerTable: string;
  readonly markerId: string;
  readonly markerIdColumn: string;
}

export const PRODUCTION_PROJECT_REFS: readonly string[];
export const PRODUCTION_APP_ORIGINS: readonly string[];
export const ALLOWED_STAGING_PROJECT_REFS: readonly string[];

export interface VerifiedStagingGuardConfig extends StagingGuardConfig {
  readonly markerVerified: true;
}

export interface AttestedStagingGuardConfig
  extends VerifiedStagingGuardConfig {
  readonly deploymentAttested: true;
}

export type StagingGuardInspection =
  | Readonly<{
      ok: true;
      errors: readonly [];
      config: Readonly<StagingGuardConfig>;
    }>
  | Readonly<{
      ok: false;
      errors: readonly StagingGuardIssue[];
      config: null;
    }>;

export interface StagingGuardPolicy {
  readonly allowedStagingProjectRefs?: readonly string[];
}

export interface StagingMarkerOptions extends StagingGuardPolicy {
  readonly client?: SupabaseClient;
  readonly clientFactory?: typeof createClient;
  readonly fetchImpl?: typeof fetch;
  readonly runnerVercelAutomationBypassSecret?: string;
}

export const STAGING_GUARD_ENV_NAMES: Readonly<{
  allowMutations: "E2E_ALLOW_MUTATIONS";
  vercelEnvironment: "VERCEL_ENV";
  appBaseUrl: "E2E_BASE_URL";
  playwrightBaseUrl: "PLAYWRIGHT_BASE_URL";
  expectedAppOrigin: "E2E_EXPECTED_APP_ORIGIN";
  attestationToken: "E2E_ATTESTATION_TOKEN";
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL";
  expectedProjectRef: "E2E_EXPECTED_PROJECT_REF";
  serviceRoleKey: "SUPABASE_SERVICE_ROLE_KEY";
  markerTable: "E2E_STAGING_MARKER_TABLE";
  markerId: "E2E_STAGING_MARKER_ID";
  markerIdColumn: "E2E_STAGING_MARKER_ID_COLUMN";
  runnerVercelAutomationBypassSecret: "E2E_VERCEL_AUTOMATION_BYPASS_SECRET";
}>;

export class StagingGuardError extends Error {
  readonly issues: readonly StagingGuardIssue[];

  constructor(
    message: string,
    issues?: readonly StagingGuardIssue[],
    options?: ErrorOptions,
  );
}

export function inspectStagingEnvironment(
  environment?: StagingGuardEnvironment,
  policy?: StagingGuardPolicy,
): StagingGuardInspection;

export function assertSafeStagingEnvironment(
  environment?: StagingGuardEnvironment,
  policy?: StagingGuardPolicy,
): Readonly<StagingGuardConfig>;

export function assertRunnerVercelAutomationBypass(
  environment?: StagingGuardEnvironment,
): string;

export function assertStagingDatabaseMarker(
  config: Readonly<StagingGuardConfig>,
  options?: StagingMarkerOptions,
): Promise<Readonly<VerifiedStagingGuardConfig>>;

export function assertStagingEnvironment(
  environment?: StagingGuardEnvironment,
  options?: StagingMarkerOptions,
): Promise<Readonly<VerifiedStagingGuardConfig>>;

export function assertStagingDeploymentAttestation(
  config: Readonly<VerifiedStagingGuardConfig>,
  options?: Pick<
    StagingMarkerOptions,
    "fetchImpl" | "runnerVercelAutomationBypassSecret"
  >,
): Promise<Readonly<AttestedStagingGuardConfig>>;

export function assertStagingDeployment(
  environment?: StagingGuardEnvironment,
  options?: StagingMarkerOptions,
): Promise<Readonly<AttestedStagingGuardConfig>>;
