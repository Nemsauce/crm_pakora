import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  inspectSchemaReadiness,
  KNOWN_MISSING_USED_RPCS,
  KNOWN_MISSING_USED_TABLES,
  OBSERVED_LIVE_COLUMNS,
  SCHEMA_USAGE_DETECTION_SCOPE,
} from "../../../scripts/e2e/schema-readiness.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

test("schema readiness confirms the audited generated types are complete", async () => {
  const report = await inspectSchemaReadiness(repositoryRoot);

  expect(report.detectionScope).toBe(SCHEMA_USAGE_DETECTION_SCOPE);
  expect(report.missingUsedTables).toEqual(KNOWN_MISSING_USED_TABLES);
  expect(report.missingUsedRpcs).toEqual(KNOWN_MISSING_USED_RPCS);
  expect(report.missingLiveColumns).toEqual({});
  expect(report.schemaTypesReady).toBe(true);
});

test("schema readiness has no unallowlisted repository gaps", async () => {
  const report = await inspectSchemaReadiness(repositoryRoot);

  expect(report.sourceFiles).not.toEqual(
    expect.arrayContaining([
      "src/app/api/dropi-order-create-test/route.ts",
      "src/lib/dropi/createDropiOrderCO.test.ts",
      "src/lib/dropi/createDropiOrderCO.ts",
    ]),
  );
  expect(report.unexpectedMissingUsedTables).toEqual([]);
  expect(report.unexpectedMissingUsedRpcs).toEqual([]);
  expect(report.hasUnexpectedGaps).toBe(false);
});

test("schema readiness detects newly added literal table and RPC usage", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "crm-schema-readiness-"));

  try {
    await mkdir(join(fixtureRoot, "src/lib/supabase"), { recursive: true });
    await mkdir(join(fixtureRoot, "src/features"), { recursive: true });
    await writeFile(
      join(fixtureRoot, "src/lib/supabase/database.types.ts"),
      `export type Database = {
        public: {
          Tables: {
            orders: { Row: { id: number }; Insert: {}; Update: {}; Relationships: [] };
            tasks: { Row: { id: number }; Insert: {}; Update: {}; Relationships: [] };
            dropkiller_products_daily: { Row: { id: number }; Insert: {}; Update: {}; Relationships: [] };
            declared_table: { Row: { id: number }; Insert: {}; Update: {}; Relationships: [] };
          };
          Views: {};
          Functions: {
            declared_rpc: { Args: never; Returns: boolean };
          };
          Enums: {};
          CompositeTypes: {};
        };
      };\n`,
      "utf8",
    );
    await writeFile(
      join(fixtureRoot, "src/features/schema-usage.ts"),
      `declare const client: {
        from(name: string): unknown;
        rpc(name: string): unknown;
      };

      client.from("declared_table");
      client.from(("new_live_table" as never));
      client.rpc("declared_rpc");
      client.rpc("new_live_rpc");
      // client.from("commented_table");
      `,
      "utf8",
    );

    const report = await inspectSchemaReadiness(fixtureRoot);

    expect(report.detectionScope).toBe(
      "literal-supabase-from-and-rpc-calls",
    );
    expect(report.usedTables).toEqual([
      "declared_table",
      "new_live_table",
    ]);
    expect(report.usedRpcs).toEqual(["declared_rpc", "new_live_rpc"]);
    expect(report.missingUsedTables).toEqual(["new_live_table"]);
    expect(report.missingUsedRpcs).toEqual(["new_live_rpc"]);
    expect(report.unexpectedMissingUsedTables).toEqual(["new_live_table"]);
    expect(report.unexpectedMissingUsedRpcs).toEqual(["new_live_rpc"]);
    expect(report.missingLiveColumns.orders).toEqual(
      OBSERVED_LIVE_COLUMNS.orders,
    );
    expect(report.hasUnexpectedGaps).toBe(true);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
