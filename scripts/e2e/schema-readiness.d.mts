export type ObservedLiveTable =
  | "orders"
  | "tasks"
  | "dropkiller_products_daily";

export interface SchemaReadinessReport {
  readonly detectionScope: "literal-supabase-from-and-rpc-calls";
  readonly rootDir: string;
  readonly databaseTypesPath: string;
  readonly sourceFiles: readonly string[];
  readonly declaredTables: readonly string[];
  readonly declaredRpcs: readonly string[];
  readonly declaredTableColumns: Readonly<Record<string, readonly string[]>>;
  readonly usedTables: readonly string[];
  readonly usedRpcs: readonly string[];
  readonly missingUsedTables: readonly string[];
  readonly missingUsedRpcs: readonly string[];
  readonly missingLiveColumns: Readonly<
    Partial<Record<ObservedLiveTable, readonly string[]>>
  >;
  readonly unexpectedMissingUsedTables: readonly string[];
  readonly unexpectedMissingUsedRpcs: readonly string[];
  readonly hasUnexpectedGaps: boolean;
  readonly schemaTypesReady: boolean;
}

export const SCHEMA_USAGE_DETECTION_SCOPE: "literal-supabase-from-and-rpc-calls";

export const KNOWN_MISSING_USED_TABLES: readonly string[];
export const KNOWN_MISSING_USED_RPCS: readonly string[];
export const OBSERVED_LIVE_COLUMNS: Readonly<
  Record<ObservedLiveTable, readonly string[]>
>;

export function inspectSchemaReadiness(
  rootDir: string,
): Promise<SchemaReadinessReport>;
