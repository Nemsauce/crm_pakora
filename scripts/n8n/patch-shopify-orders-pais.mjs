#!/usr/bin/env node

const WORKFLOWS = [
  { id: "R6yGZIKxVCWfJaq9", name: "Shopify Orders (CO)", pais: "CO" },
  { id: "oYYHzqRXCjNfPGks", name: "Shopify Orders MX", pais: "MX" },
];

const INSERT_ORDER_NODE_NAME = "Insertar orden Supabase1";
const ACTIVO_ANCHOR = '"activo": true';
const ALLOWED_WORKFLOW_SETTINGS_KEYS = new Set([
  "executionOrder",
  "saveManualExecutions",
  "callerPolicy",
  "errorWorkflow",
  "timezone",
  "saveDataErrorExecution",
  "saveDataSuccessExecution",
  "saveExecutionProgress",
]);

function parseArgs(argv) {
  const unknownArgs = argv.filter((arg) => arg !== "--confirm");

  if (unknownArgs.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  }

  return {
    confirm: argv.includes("--confirm"),
  };
}

function readEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readConfig() {
  const requiredEnvNames = ["N8N_BASE_URL", "N8N_API_KEY"];
  const missing = requiredEnvNames.filter((name) => !readEnv(name));

  if (missing.length > 0) {
    throw new Error(
      `Missing required env var(s): ${missing.join(", ")}. ` +
        "Set them before running this script.",
    );
  }

  const n8nBaseUrl = readEnv("N8N_BASE_URL").replace(/\/+$/, "");

  try {
    new URL(n8nBaseUrl);
  } catch {
    throw new Error("N8N_BASE_URL must be a full URL, for example https://n8n.example.com");
  }

  return {
    n8nBaseUrl,
    apiKey: readEnv("N8N_API_KEY"),
  };
}

function workflowUrl(config, workflowId) {
  return new URL(`/api/v1/workflows/${workflowId}`, config.n8nBaseUrl).toString();
}

async function requestJson(url, config, options = {}) {
  const method = options.method ?? "GET";
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": config.apiKey,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const responseText = await response.text();
  const responsePreview = responseText ? ` Response: ${responseText.slice(0, 500)}` : "";

  if (!response.ok) {
    throw new Error(
      `${method} ${url} failed with ${response.status} ${response.statusText}.${responsePreview}`,
    );
  }

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`${method} ${url} returned non-JSON response.${responsePreview}`);
  }
}

function findNode(workflow, name) {
  return workflow.nodes?.find((node) => node.name === name);
}

function countOccurrences(value, char) {
  let count = 0;

  for (const character of value) {
    if (character === char) {
      count += 1;
    }
  }

  return count;
}

function validateJsonBodyStructure(jsonBody) {
  const trimmed = jsonBody.trim();

  if (!trimmed.startsWith("={")) {
    throw new Error('jsonBody does not start with the expected "={" expression prefix.');
  }

  if (!trimmed.endsWith("}")) {
    throw new Error('jsonBody does not end with a closing "}".');
  }

  const openBraces = countOccurrences(trimmed, "{");
  const closeBraces = countOccurrences(trimmed, "}");

  if (openBraces !== closeBraces) {
    throw new Error(
      `jsonBody brace count is unbalanced after patch: ${openBraces} "{" vs ${closeBraces} "}".`,
    );
  }

  if (/,\s*}$/.test(trimmed)) {
    throw new Error("jsonBody has a dangling trailing comma before the closing brace.");
  }

  return trimmed;
}

function findExistingPais(jsonBody) {
  const match = /"pais"\s*:\s*"([^"]*)"/.exec(jsonBody);

  return match ? match[1] : null;
}

function patchInsertOrderJsonBody(node, pais) {
  if (node.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${INSERT_ORDER_NODE_NAME}" is not an HTTP Request node. Found type: ${node.type ?? "(missing)"}.`,
    );
  }

  if (
    !node.parameters ||
    typeof node.parameters !== "object" ||
    Array.isArray(node.parameters)
  ) {
    throw new Error(`"${INSERT_ORDER_NODE_NAME}" does not have parameters.`);
  }

  const jsonBody = node.parameters.jsonBody;

  if (typeof jsonBody !== "string") {
    throw new Error(`"${INSERT_ORDER_NODE_NAME}" does not have a string jsonBody.`);
  }

  const existingPais = findExistingPais(jsonBody);

  if (existingPais !== null) {
    if (existingPais === pais) {
      return {
        status: "confirmed",
        before: jsonBody,
        after: jsonBody,
      };
    }

    throw new Error(
      `"${INSERT_ORDER_NODE_NAME}" jsonBody already has "pais": "${existingPais}", which does not match the expected "${pais}". Not overwriting — needs manual review.`,
    );
  }

  if (!jsonBody.includes(ACTIVO_ANCHOR)) {
    throw new Error(
      `"${INSERT_ORDER_NODE_NAME}" jsonBody does not contain the expected anchor: ${ACTIVO_ANCHOR}`,
    );
  }

  const nextJsonBody = jsonBody.replace(
    ACTIVO_ANCHOR,
    `${ACTIVO_ANCHOR},\n  "pais": "${pais}"`,
  );

  validateJsonBodyStructure(nextJsonBody);

  node.parameters.jsonBody = nextJsonBody;

  return {
    status: "added",
    before: jsonBody,
    after: nextJsonBody,
  };
}

function getFilteredWorkflowSettings(workflow) {
  const settings =
    workflow.settings &&
    typeof workflow.settings === "object" &&
    !Array.isArray(workflow.settings)
      ? workflow.settings
      : {};
  const presentKeys = Object.keys(settings).sort();
  const keptKeys = presentKeys.filter((key) => ALLOWED_WORKFLOW_SETTINGS_KEYS.has(key));
  const droppedKeys = presentKeys.filter((key) => !ALLOWED_WORKFLOW_SETTINGS_KEYS.has(key));
  const filteredSettings = Object.fromEntries(keptKeys.map((key) => [key, settings[key]]));

  return {
    settings: filteredSettings,
    presentKeys,
    keptKeys,
    droppedKeys,
  };
}

function buildWorkflowUpdatePayload(workflow) {
  const { settings } = getFilteredWorkflowSettings(workflow);
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings,
  };

  if (Object.hasOwn(workflow, "staticData")) {
    payload.staticData = workflow.staticData;
  }

  if (Object.hasOwn(workflow, "pinData")) {
    payload.pinData = workflow.pinData;
  }

  return payload;
}

function formatKeys(keys) {
  return keys.length > 0 ? keys.join(", ") : "(none)";
}

function patchWorkflow(workflow, workflowTarget) {
  if (!Array.isArray(workflow.nodes)) {
    throw new Error("Workflow response does not include a nodes array.");
  }

  const insertOrderNode = findNode(workflow, INSERT_ORDER_NODE_NAME);

  if (!insertOrderNode) {
    throw new Error(`Node "${INSERT_ORDER_NODE_NAME}" was not found.`);
  }

  const jsonBodyPatch = patchInsertOrderJsonBody(insertOrderNode, workflowTarget.pais);

  return {
    jsonBodyStatus: jsonBodyPatch.status,
    jsonBodyBefore: jsonBodyPatch.before,
    jsonBodyAfter: jsonBodyPatch.after,
    settingsSummary: getFilteredWorkflowSettings(workflow),
  };
}

function printChangeSummary(workflow, workflowTarget, patchResult) {
  console.log(`\n[${workflowTarget.name}] ${workflowTarget.id}`);
  console.log(`Workflow: ${workflow.name ?? "(unnamed)"}`);
  console.log(
    `- "${INSERT_ORDER_NODE_NAME}" jsonBody pais field: ${patchResult.jsonBodyStatus}`,
  );
  console.log(`- expected pais literal: ${workflowTarget.pais}`);
  console.log(`- "${INSERT_ORDER_NODE_NAME}" jsonBody BEFORE:`);
  console.log(patchResult.jsonBodyBefore);
  console.log(`- "${INSERT_ORDER_NODE_NAME}" jsonBody AFTER:`);
  console.log(patchResult.jsonBodyAfter);
  console.log(
    `- workflow.settings keys returned: ${formatKeys(patchResult.settingsSummary.presentKeys)}`,
  );
  console.log(
    `- workflow.settings keys sent: ${formatKeys(patchResult.settingsSummary.keptKeys)}`,
  );
  console.log(
    `- workflow.settings keys dropped: ${formatKeys(patchResult.settingsSummary.droppedKeys)}`,
  );
}

async function processWorkflow(workflowTarget, config, confirm) {
  const url = workflowUrl(config, workflowTarget.id);
  console.log(`\nGET ${url}`);

  const workflow = await requestJson(url, config);
  const patchResult = patchWorkflow(workflow, workflowTarget);

  printChangeSummary(workflow, workflowTarget, patchResult);

  if (patchResult.jsonBodyStatus === "confirmed") {
    console.log("Already patched — nothing to write.");
    return confirm ? "confirmed-no-write" : "dry-run-confirmed";
  }

  if (!confirm) {
    console.log("DRY RUN - no changes written. Re-run with --confirm to apply.");
    return "dry-run";
  }

  const payload = buildWorkflowUpdatePayload(workflow);
  console.log(`PUT ${url}`);
  await requestJson(url, config, {
    method: "PUT",
    body: payload,
  });
  console.log("Write complete.");

  return "written";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = readConfig();
  const results = [];

  console.log(args.confirm ? "Mode: APPLY (--confirm)" : "Mode: DRY RUN");

  for (const workflowTarget of WORKFLOWS) {
    try {
      const status = await processWorkflow(workflowTarget, config, args.confirm);
      results.push({
        workflow: workflowTarget.name,
        id: workflowTarget.id,
        ok: true,
        status,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n[${workflowTarget.name}] FAILED: ${message}`);
      results.push({
        workflow: workflowTarget.name,
        id: workflowTarget.id,
        ok: false,
        error: message,
      });
    }
  }

  console.log("\nSummary:");
  for (const result of results) {
    if (result.ok) {
      console.log(`- OK ${result.workflow} (${result.id}): ${result.status}`);
    } else {
      console.log(`- FAILED ${result.workflow} (${result.id}): ${result.error}`);
    }
  }

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
