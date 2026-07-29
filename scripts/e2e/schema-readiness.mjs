import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import ts from "typescript";

const DATABASE_TYPES_PATH = "src/lib/supabase/database.types.ts";
const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
const execFileAsync = promisify(execFile);
const PROTECTED_UNTRACKED_SOURCE_PATHS = new Set([
  "src/app/api/dropi-order-create-test/route.ts",
  "src/lib/dropi/createDropiOrderCO.test.ts",
  "src/lib/dropi/createDropiOrderCO.ts",
]);

export const SCHEMA_USAGE_DETECTION_SCOPE =
  "literal-supabase-from-and-rpc-calls";

export const KNOWN_MISSING_USED_TABLES = Object.freeze([]);

export const KNOWN_MISSING_USED_RPCS = Object.freeze([]);

export const OBSERVED_LIVE_COLUMNS = Object.freeze({
  orders: Object.freeze([
    "codigo_postal",
    "colonia",
    "numero_interior",
    "monto_a_ganar",
  ]),
  tasks: Object.freeze(["resultado", "snoozed_until"]),
  dropkiller_products_daily: Object.freeze([
    "primary_image_url",
    "providers_count",
  ]),
});

function sorted(values) {
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(path)));
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

async function collectRepositorySourceFiles(rootDirectory, srcDirectory) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      [
        "-C",
        rootDirectory,
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        "src",
      ],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );
    const trackedSourceFiles = stdout
      .split("\0")
      .filter(Boolean)
      .filter((filePath) => !PROTECTED_UNTRACKED_SOURCE_PATHS.has(filePath))
      .filter((filePath) => SOURCE_EXTENSIONS.has(extname(filePath)))
      .map((filePath) => join(rootDirectory, filePath));

    if (trackedSourceFiles.length > 0) {
      return trackedSourceFiles;
    }
  } catch {
    // Synthetic fixtures are not Git repositories; recurse only in that case.
  }

  const discoveredSourceFiles = await collectSourceFiles(srcDirectory);
  return discoveredSourceFiles.filter(
    (filePath) =>
      !PROTECTED_UNTRACKED_SOURCE_PATHS.has(
        relative(rootDirectory, filePath),
      ),
  );
}

function getPropertyName(name) {
  if (!name) {
    return null;
  }

  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }

  return null;
}

function getTypeProperty(typeLiteral, propertyName, context) {
  const property = typeLiteral.members.find(
    (member) =>
      ts.isPropertySignature(member) &&
      getPropertyName(member.name) === propertyName,
  );

  if (!property?.type || !ts.isTypeLiteralNode(property.type)) {
    throw new Error(
      `Could not find the ${context}.${propertyName} type declaration.`,
    );
  }

  return property.type;
}

function getNamedProperties(typeLiteral) {
  return typeLiteral.members
    .filter(ts.isPropertySignature)
    .map((member) => getPropertyName(member.name))
    .filter((name) => name !== null);
}

function parseDatabaseTypes(sourceText, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const databaseDeclaration = sourceFile.statements.find(
    (statement) =>
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === "Database",
  );

  if (
    !databaseDeclaration ||
    !ts.isTypeLiteralNode(databaseDeclaration.type)
  ) {
    throw new Error(`Could not find the Database type in ${filePath}.`);
  }

  const publicSchema = getTypeProperty(
    databaseDeclaration.type,
    "public",
    "Database",
  );
  const tablesType = getTypeProperty(publicSchema, "Tables", "Database.public");
  const functionsType = getTypeProperty(
    publicSchema,
    "Functions",
    "Database.public",
  );
  const declaredTables = getNamedProperties(tablesType);
  const declaredRpcs = getNamedProperties(functionsType);
  const declaredTableColumns = {};

  for (const tableName of declaredTables) {
    const tableType = getTypeProperty(
      tablesType,
      tableName,
      "Database.public.Tables",
    );
    const rowType = getTypeProperty(
      tableType,
      "Row",
      `Database.public.Tables.${tableName}`,
    );
    declaredTableColumns[tableName] = sorted(getNamedProperties(rowType));
  }

  return {
    declaredTables: sorted(declaredTables),
    declaredRpcs: sorted(declaredRpcs),
    declaredTableColumns,
  };
}

function unwrapExpression(expression) {
  let current = expression;

  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function getLiteralCallArgument(callExpression) {
  const firstArgument = callExpression.arguments[0];

  if (!firstArgument) {
    return null;
  }

  const expression = unwrapExpression(firstArgument);
  return ts.isStringLiteralLike(expression) ? expression.text : null;
}

function collectUsedSchemaNames(sourceText, filePath) {
  const scriptKind = filePath.endsWith("x")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const tables = [];
  const rpcs = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const methodName = node.expression.name.text;

      if (methodName === "from" || methodName === "rpc") {
        const schemaName = getLiteralCallArgument(node);

        if (schemaName) {
          (methodName === "from" ? tables : rpcs).push(schemaName);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { tables, rpcs };
}

function getMissingLiveColumns(declaredTableColumns) {
  const missing = {};

  for (const [tableName, observedColumns] of Object.entries(
    OBSERVED_LIVE_COLUMNS,
  )) {
    const declaredColumns = new Set(declaredTableColumns[tableName] ?? []);
    const missingColumns = observedColumns.filter(
      (columnName) => !declaredColumns.has(columnName),
    );

    if (missingColumns.length > 0) {
      missing[tableName] = missingColumns;
    }
  }

  return missing;
}

export async function inspectSchemaReadiness(rootDir) {
  if (typeof rootDir !== "string" || !rootDir.trim()) {
    throw new TypeError("rootDir must be a non-empty repository path.");
  }

  const absoluteRoot = resolve(rootDir);
  const srcDirectory = join(absoluteRoot, "src");
  const databaseTypesPath = join(absoluteRoot, DATABASE_TYPES_PATH);
  const [databaseTypesSource, sourceFiles] = await Promise.all([
    readFile(databaseTypesPath, "utf8"),
    collectRepositorySourceFiles(absoluteRoot, srcDirectory),
  ]);
  const declarations = parseDatabaseTypes(
    databaseTypesSource,
    databaseTypesPath,
  );
  const usedTables = [];
  const usedRpcs = [];

  for (const sourceFilePath of sourceFiles) {
    const sourceText = await readFile(sourceFilePath, "utf8");
    const usage = collectUsedSchemaNames(sourceText, sourceFilePath);
    usedTables.push(...usage.tables);
    usedRpcs.push(...usage.rpcs);
  }

  const normalizedUsedTables = sorted(usedTables);
  const normalizedUsedRpcs = sorted(usedRpcs);
  const declaredTableSet = new Set(declarations.declaredTables);
  const declaredRpcSet = new Set(declarations.declaredRpcs);
  const missingUsedTables = normalizedUsedTables.filter(
    (tableName) => !declaredTableSet.has(tableName),
  );
  const missingUsedRpcs = normalizedUsedRpcs.filter(
    (rpcName) => !declaredRpcSet.has(rpcName),
  );
  const knownMissingTableSet = new Set(KNOWN_MISSING_USED_TABLES);
  const knownMissingRpcSet = new Set(KNOWN_MISSING_USED_RPCS);
  const unexpectedMissingUsedTables = missingUsedTables.filter(
    (tableName) => !knownMissingTableSet.has(tableName),
  );
  const unexpectedMissingUsedRpcs = missingUsedRpcs.filter(
    (rpcName) => !knownMissingRpcSet.has(rpcName),
  );
  const missingLiveColumns = getMissingLiveColumns(
    declarations.declaredTableColumns,
  );
  const missingLiveColumnCount = Object.values(missingLiveColumns).reduce(
    (total, columns) => total + columns.length,
    0,
  );

  return {
    detectionScope: SCHEMA_USAGE_DETECTION_SCOPE,
    rootDir: absoluteRoot,
    databaseTypesPath: relative(absoluteRoot, databaseTypesPath),
    sourceFiles: sourceFiles
      .map((filePath) => relative(absoluteRoot, filePath))
      .sort((left, right) => left.localeCompare(right, "en")),
    ...declarations,
    usedTables: normalizedUsedTables,
    usedRpcs: normalizedUsedRpcs,
    missingUsedTables,
    missingUsedRpcs,
    missingLiveColumns,
    unexpectedMissingUsedTables,
    unexpectedMissingUsedRpcs,
    hasUnexpectedGaps:
      unexpectedMissingUsedTables.length > 0 ||
      unexpectedMissingUsedRpcs.length > 0,
    schemaTypesReady:
      missingUsedTables.length === 0 &&
      missingUsedRpcs.length === 0 &&
      missingLiveColumnCount === 0,
  };
}

async function runCli() {
  const rootDir = process.argv[2];

  if (!rootDir) {
    throw new Error("Usage: node scripts/e2e/schema-readiness.mjs <repo-root>");
  }

  const report = await inspectSchemaReadiness(rootDir);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.hasUnexpectedGaps ? 1 : 0;
}

const entryPoint = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (entryPoint === import.meta.url) {
  await runCli();
}
