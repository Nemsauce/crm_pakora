#!/usr/bin/env node

import { randomUUID } from "node:crypto";

const WORKFLOWS = [
  { id: "R6yGZIKxVCWfJaq9", name: "Shopify Orders (CO)", pais: "CO" },
  { id: "oYYHzqRXCjNfPGks", name: "Shopify Orders MX", pais: "MX" },
];

const INSERT_ORDER_NODE_NAME = "Insertar orden Supabase1";
const MAP_ORDER_NODE_NAME = "Mapear orden Shopify";
const NOTIFY_NEW_ORDER_NODE_NAME = "Notificar pedido nuevo";
const DEFAULT_NEW_ORDER_WEBHOOK_URL =
  "https://crm.pakora.online/api/webhooks/orders/new-order";
const NOTIFY_NEW_ORDER_JSON_BODY = `={
  "order_id": {{ $('${INSERT_ORDER_NODE_NAME}').item.json.id }}
}`;
const ACTIVO_ANCHOR = '"activo": true';
const OLD_FECHA_LOGIC_WITH_FALLBACK = `let fecha;
try {
  const fechaRaw = order.created_at || order.processed_at || new Date().toISOString();
  fecha = new Date(fechaRaw).toISOString().split('T')[0];
} catch(e) {
  fecha = new Date().toISOString().split('T')[0];
}`;
const OLD_FECHA_LOGIC_CREATED_AT_ONLY = `let fecha = null;
try {
  fecha = order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : null;
} catch(e) { fecha = null; }`;
const NEW_FECHA_LOGIC = `let fecha;
try {
  const fechaRaw = order.created_at || order.processed_at || new Date().toISOString();
  fecha = String(fechaRaw).slice(0, 10);
} catch(e) {
  fecha = new Date().toISOString().split('T')[0];
}`;
const OLD_FECHA_LOGIC_VARIANTS = [
  OLD_FECHA_LOGIC_WITH_FALLBACK,
  OLD_FECHA_LOGIC_CREATED_AT_ONLY,
];
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
  const requiredEnvNames = ["N8N_BASE_URL", "N8N_API_KEY", "WEBHOOK_SHARED_SECRET"];
  const missing = requiredEnvNames.filter((name) => !readEnv(name));

  if (missing.length > 0) {
    throw new Error(
      `Missing required env var(s): ${missing.join(", ")}. ` +
        "Set them before running this script.",
    );
  }

  const n8nBaseUrl = readEnv("N8N_BASE_URL").replace(/\/+$/, "");
  const newOrderWebhookUrl =
    readEnv("NEW_ORDER_WEBHOOK_URL") ?? DEFAULT_NEW_ORDER_WEBHOOK_URL;

  try {
    new URL(n8nBaseUrl);
  } catch {
    throw new Error("N8N_BASE_URL must be a full URL, for example https://n8n.example.com");
  }

  try {
    new URL(newOrderWebhookUrl);
  } catch {
    throw new Error("NEW_ORDER_WEBHOOK_URL must be a full URL when provided.");
  }

  return {
    n8nBaseUrl,
    apiKey: readEnv("N8N_API_KEY"),
    webhookSharedSecret: readEnv("WEBHOOK_SHARED_SECRET"),
    newOrderWebhookUrl,
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

function clone(value) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

function getPositionNear(sourceNode, offset = [420, 150]) {
  const [x = 0, y = 0] = Array.isArray(sourceNode.position)
    ? sourceNode.position
    : [0, 0];

  return [x + offset[0], y + offset[1]];
}

function getHeaderParameterList(parameters) {
  const headers = parameters?.headerParameters?.parameters;

  return Array.isArray(headers)
    ? clone(headers).filter(
        (header) =>
          header &&
          typeof header === "object" &&
          typeof header.name === "string" &&
          Object.hasOwn(header, "value"),
      )
    : [];
}

function parsePreferDirectives(value) {
  return value
    .split(",")
    .map((directive) => directive.trim())
    .filter((directive) => directive.length > 0);
}

function ensurePreferReturnsRepresentation(node) {
  if (node.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${INSERT_ORDER_NODE_NAME}" is not an HTTP Request node. Found type: ${node.type ?? "(missing)"}.`,
    );
  }

  node.parameters ??= {};

  const headers = getHeaderParameterList(node.parameters);
  const preferHeader = headers.find(
    (header) => header.name.toLowerCase() === "prefer",
  );
  const before = preferHeader ? preferHeader.value : null;

  if (!preferHeader) {
    headers.push({ name: "Prefer", value: "return=representation" });
    node.parameters.sendHeaders = true;
    node.parameters.headerParameters = { parameters: headers };

    return { status: "added", before, after: "return=representation" };
  }

  const directives = parsePreferDirectives(preferHeader.value);
  const returnDirectiveIndex = directives.findIndex((directive) =>
    directive.startsWith("return="),
  );

  if (returnDirectiveIndex === -1) {
    directives.push("return=representation");
  } else if (directives[returnDirectiveIndex] === "return=representation") {
    return { status: "confirmed", before, after: before };
  } else {
    directives[returnDirectiveIndex] = "return=representation";
  }

  const nextValue = directives.join(",");
  preferHeader.value = nextValue;
  node.parameters.sendHeaders = true;
  node.parameters.headerParameters = { parameters: headers };

  return { status: "updated", before, after: nextValue };
}

function buildNotifyNewOrderParameters(config) {
  return {
    method: "POST",
    url: config.newOrderWebhookUrl,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        {
          name: "x-webhook-secret",
          value: config.webhookSharedSecret,
        },
        {
          name: "Content-Type",
          value: "application/json",
        },
      ],
    },
    sendBody: true,
    specifyBody: "json",
    jsonBody: NOTIFY_NEW_ORDER_JSON_BODY,
    options: {},
  };
}

function buildNotifyNewOrderNode(insertOrderNode, config) {
  return {
    parameters: buildNotifyNewOrderParameters(config),
    id: randomUUID(),
    name: NOTIFY_NEW_ORDER_NODE_NAME,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.4,
    position: getPositionNear(insertOrderNode),
  };
}

function createOrUpdateNotifyNewOrderNode(workflow, insertOrderNode, config) {
  const existingNode = findNode(workflow, NOTIFY_NEW_ORDER_NODE_NAME);

  if (!existingNode) {
    const newNode = buildNotifyNewOrderNode(insertOrderNode, config);
    workflow.nodes.push(newNode);

    return { node: newNode, status: "added" };
  }

  if (existingNode.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${NOTIFY_NEW_ORDER_NODE_NAME}" exists but is not an HTTP Request node. Found type: ${existingNode.type ?? "(missing)"}.`,
    );
  }

  const before = JSON.stringify(existingNode.parameters);
  existingNode.parameters = buildNotifyNewOrderParameters(config);
  const after = JSON.stringify(existingNode.parameters);

  return {
    node: existingNode,
    status: before === after ? "confirmed" : "updated",
  };
}

function ensureMainConnection(workflow, sourceNodeName, targetNodeName) {
  workflow.connections ??= {};
  workflow.connections[sourceNodeName] ??= {};
  workflow.connections[sourceNodeName].main ??= [];
  workflow.connections[sourceNodeName].main[0] ??= [];

  const outputConnections = workflow.connections[sourceNodeName].main[0];
  const existingConnection = outputConnections.find(
    (connection) => connection.node === targetNodeName,
  );

  if (existingConnection) {
    const before = JSON.stringify(existingConnection);
    existingConnection.type = "main";
    existingConnection.index = 0;

    return before === JSON.stringify(existingConnection) ? "confirmed" : "updated";
  }

  outputConnections.push({
    node: targetNodeName,
    type: "main",
    index: 0,
  });

  return "added";
}

function countSubstring(value, substring) {
  let count = 0;
  let index = value.indexOf(substring);

  while (index !== -1) {
    count += 1;
    index = value.indexOf(substring, index + substring.length);
  }

  return count;
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

function buildFechaLogicDiff(oldFechaLogic) {
  const beforeLines = oldFechaLogic.split("\n").map((line) => `-${line}`);
  const afterLines = NEW_FECHA_LOGIC.split("\n").map((line) => `+${line}`);

  return [
    `--- ${MAP_ORDER_NODE_NAME} jsCode BEFORE`,
    `+++ ${MAP_ORDER_NODE_NAME} jsCode AFTER`,
    "@@ fecha calculation @@",
    ...beforeLines,
    ...afterLines,
  ].join("\n");
}

function patchMapOrderJsCode(node) {
  if (node.type !== "n8n-nodes-base.code") {
    throw new Error(
      `"${MAP_ORDER_NODE_NAME}" is not a Code node. Found type: ${node.type ?? "(missing)"}.`,
    );
  }

  if (
    !node.parameters ||
    typeof node.parameters !== "object" ||
    Array.isArray(node.parameters)
  ) {
    throw new Error(`"${MAP_ORDER_NODE_NAME}" does not have parameters.`);
  }

  const jsCode = node.parameters.jsCode;

  if (typeof jsCode !== "string") {
    throw new Error(`"${MAP_ORDER_NODE_NAME}" does not have a string jsCode.`);
  }

  if (jsCode.includes(NEW_FECHA_LOGIC)) {
    return {
      status: "confirmed",
      before: jsCode,
      after: jsCode,
      diff: "(already patched; no jsCode diff)",
    };
  }

  const matchingOldLogic = OLD_FECHA_LOGIC_VARIANTS.map((oldLogic) => ({
    oldLogic,
    occurrences: countSubstring(jsCode, oldLogic),
  })).filter((match) => match.occurrences > 0);
  const totalOldLogicOccurrences = matchingOldLogic.reduce(
    (total, match) => total + match.occurrences,
    0,
  );

  if (totalOldLogicOccurrences !== 1) {
    throw new Error(
      `"${MAP_ORDER_NODE_NAME}" jsCode does not contain exactly one expected fecha calculation block. Found ${totalOldLogicOccurrences}. Manual review required.`,
    );
  }

  const oldFechaLogic = matchingOldLogic[0].oldLogic;
  const nextJsCode = jsCode.replace(oldFechaLogic, NEW_FECHA_LOGIC);
  node.parameters.jsCode = nextJsCode;

  return {
    status: "fixed",
    before: jsCode,
    after: nextJsCode,
    diff: buildFechaLogicDiff(oldFechaLogic),
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

function patchWorkflow(workflow, workflowTarget, config) {
  if (!Array.isArray(workflow.nodes)) {
    throw new Error("Workflow response does not include a nodes array.");
  }

  const insertOrderNode = findNode(workflow, INSERT_ORDER_NODE_NAME);

  if (!insertOrderNode) {
    throw new Error(`Node "${INSERT_ORDER_NODE_NAME}" was not found.`);
  }

  const mapOrderNode = findNode(workflow, MAP_ORDER_NODE_NAME);

  if (!mapOrderNode) {
    throw new Error(`Node "${MAP_ORDER_NODE_NAME}" was not found.`);
  }

  const jsonBodyPatch = patchInsertOrderJsonBody(insertOrderNode, workflowTarget.pais);
  const fechaLogicPatch = patchMapOrderJsCode(mapOrderNode);
  const preferPatch = ensurePreferReturnsRepresentation(insertOrderNode);
  const notifyNodePatch = createOrUpdateNotifyNewOrderNode(
    workflow,
    insertOrderNode,
    config,
  );
  const connectionStatus = ensureMainConnection(
    workflow,
    INSERT_ORDER_NODE_NAME,
    NOTIFY_NEW_ORDER_NODE_NAME,
  );

  return {
    jsonBodyStatus: jsonBodyPatch.status,
    jsonBodyBefore: jsonBodyPatch.before,
    jsonBodyAfter: jsonBodyPatch.after,
    fechaLogicStatus: fechaLogicPatch.status,
    fechaLogicDiff: fechaLogicPatch.diff,
    preferStatus: preferPatch.status,
    preferBefore: preferPatch.before,
    preferAfter: preferPatch.after,
    notifyNodeStatus: notifyNodePatch.status,
    connectionStatus,
    hasChanges:
      jsonBodyPatch.status !== "confirmed" ||
      fechaLogicPatch.status !== "confirmed" ||
      preferPatch.status !== "confirmed" ||
      notifyNodePatch.status !== "confirmed" ||
      connectionStatus !== "confirmed",
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
    `- "${MAP_ORDER_NODE_NAME}" fecha calculation: ${patchResult.fechaLogicStatus}`,
  );
  console.log(`- "${MAP_ORDER_NODE_NAME}" jsCode diff:`);
  console.log(patchResult.fechaLogicDiff);
  console.log(
    `- "${INSERT_ORDER_NODE_NAME}" Prefer header: ${patchResult.preferStatus}`,
  );
  console.log(`  before: ${patchResult.preferBefore ?? "(no Prefer header)"}`);
  console.log(`  after: ${patchResult.preferAfter}`);
  console.log(
    `- "${NOTIFY_NEW_ORDER_NODE_NAME}" node: ${patchResult.notifyNodeStatus}`,
  );
  console.log(
    `- connection "${INSERT_ORDER_NODE_NAME}" -> "${NOTIFY_NEW_ORDER_NODE_NAME}": ${patchResult.connectionStatus}`,
  );
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
  const patchResult = patchWorkflow(workflow, workflowTarget, config);

  printChangeSummary(workflow, workflowTarget, patchResult);

  if (!patchResult.hasChanges) {
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
