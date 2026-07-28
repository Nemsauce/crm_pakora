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
  readonly allowMutations: true;
  readonly vercelEnvironment: string;
  readonly supabaseUrl: string;
  readonly projectRef: string;
  readonly productionProjectRef: string;
  readonly supabaseServiceRoleKey: string;
  readonly markerTable: string;
  readonly markerId: string;
  readonly markerIdColumn: string;
}

export interface VerifiedStagingGuardConfig extends StagingGuardConfig {
  readonly markerVerified: true;
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

export interface StagingMarkerOptions {
  readonly client?: SupabaseClient;
  readonly clientFactory?: typeof createClient;
}

export const STAGING_GUARD_ENV_NAMES: Readonly<{
  allowMutations: "E2E_ALLOW_MUTATIONS";
  vercelEnvironment: "VERCEL_ENV";
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL";
  expectedProjectRef: "E2E_EXPECTED_PROJECT_REF";
  productionProjectRef: "E2E_PRODUCTION_PROJECT_REF";
  serviceRoleKey: "SUPABASE_SERVICE_ROLE_KEY";
  markerTable: "E2E_STAGING_MARKER_TABLE";
  markerId: "E2E_STAGING_MARKER_ID";
  markerIdColumn: "E2E_STAGING_MARKER_ID_COLUMN";
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
): StagingGuardInspection;

export function assertSafeStagingEnvironment(
  environment?: StagingGuardEnvironment,
): Readonly<StagingGuardConfig>;

export function assertStagingDatabaseMarker(
  config: Readonly<StagingGuardConfig>,
  options?: StagingMarkerOptions,
): Promise<Readonly<VerifiedStagingGuardConfig>>;

export function assertStagingEnvironment(
  environment?: StagingGuardEnvironment,
  options?: StagingMarkerOptions,
): Promise<Readonly<VerifiedStagingGuardConfig>>;
