#!/usr/bin/env node

import { randomUUID } from "node:crypto";

const WORKFLOWS = [
  { id: "9p1gvbDxdYqugkMT", name: "Dropi Polling (CO)" },
  { id: "BQ7G5rSntIoszmJ3", name: "Dropi Polling MX" },
];

const UPDATE_ORDER_NODE_NAME = "Actualizar orden Supabase";
const WEBHOOK_NODE_NAME = "Notificar backend CRM";
const DEFAULT_BACKEND_WEBHOOK_URL =
  "https://crm.pakora.online/api/webhooks/orders/status-changed";
const WEBHOOK_JSON_BODY = `={
  "order_id": {{ $('Comparar y filtrar cambios').item.json.supabase_id }}
}`;

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
  const requiredEnvNames = [
    "N8N_BASE_URL",
    "N8N_API_KEY",
    "WEBHOOK_SHARED_SECRET",
  ];
  const missing = requiredEnvNames.filter((name) => !readEnv(name));

  if (missing.length > 0) {
    throw new Error(
      `Missing required env var(s): ${missing.join(", ")}. ` +
        "Set them before running this script.",
    );
  }

  const n8nBaseUrl = readEnv("N8N_BASE_URL").replace(/\/+$/, "");
  const backendWebhookUrl =
    readEnv("BACKEND_WEBHOOK_URL") ?? DEFAULT_BACKEND_WEBHOOK_URL;

  try {
    new URL(n8nBaseUrl);
  } catch {
    throw new Error("N8N_BASE_URL must be a full URL, for example https://n8n.example.com");
  }

  try {
    new URL(backendWebhookUrl);
  } catch {
    throw new Error("BACKEND_WEBHOOK_URL must be a full URL when provided.");
  }

  return {
    n8nBaseUrl,
    apiKey: readEnv("N8N_API_KEY"),
    webhookSharedSecret: readEnv("WEBHOOK_SHARED_SECRET"),
    backendWebhookUrl,
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

function getPositionNear(sourceNode) {
  const [x = 0, y = 0] = Array.isArray(sourceNode.position)
    ? sourceNode.position
    : [0, 0];

  return [x + 420, y + 150];
}

function buildWebhookParameters(config) {
  return {
    method: "POST",
    url: config.backendWebhookUrl,
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
    jsonBody: WEBHOOK_JSON_BODY,
    options: {},
  };
}

function getRetryStyle(workflow) {
  const httpRequestNodes = workflow.nodes.filter(
    (node) => node.type === "n8n-nodes-base.httpRequest",
  );
  const nodeUsingParameterOptions = httpRequestNodes.find((node) => {
    const options = node.parameters?.options;

    return (
      options &&
      (Object.hasOwn(options, "retryOnFail") ||
        Object.hasOwn(options, "maxTries") ||
        Object.hasOwn(options, "waitBetweenTries"))
    );
  });

  return nodeUsingParameterOptions ? "parameters.options" : "node";
}

function applyRetrySettings(node, retryStyle) {
  if (retryStyle === "parameters.options") {
    node.parameters ??= {};
    node.parameters.options ??= {};
    node.parameters.options.retryOnFail = true;
    node.parameters.options.maxTries = 3;
    node.parameters.options.waitBetweenTries = 2000;
    delete node.retryOnFail;
    delete node.maxTries;
    delete node.waitBetweenTries;
    return;
  }

  if (node.parameters?.options) {
    delete node.parameters.options.retryOnFail;
    delete node.parameters.options.maxTries;
    delete node.parameters.options.waitBetweenTries;
  }

  node.retryOnFail = true;
  node.maxTries = 3;
  node.waitBetweenTries = 2000;
}

function buildWebhookNode(updateOrderNode, config, retryStyle) {
  const node = {
    parameters: buildWebhookParameters(config),
    id: randomUUID(),
    name: WEBHOOK_NODE_NAME,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.4,
    position: getPositionNear(updateOrderNode),
  };

  applyRetrySettings(node, retryStyle);

  return node;
}

function createOrUpdateWebhookNode(workflow, updateOrderNode, config, retryStyle) {
  const existingWebhookNode = findNode(workflow, WEBHOOK_NODE_NAME);

  if (!existingWebhookNode) {
    const newNode = buildWebhookNode(updateOrderNode, config, retryStyle);
    workflow.nodes.push(newNode);

    return {
      node: newNode,
      status: "added",
    };
  }

  const before = JSON.stringify({
    parameters: existingWebhookNode.parameters,
    retryOnFail: existingWebhookNode.retryOnFail,
    maxTries: existingWebhookNode.maxTries,
    waitBetweenTries: existingWebhookNode.waitBetweenTries,
  });

  existingWebhookNode.parameters = buildWebhookParameters(config);
  applyRetrySettings(existingWebhookNode, retryStyle);

  const after = JSON.stringify({
    parameters: existingWebhookNode.parameters,
    retryOnFail: existingWebhookNode.retryOnFail,
    maxTries: existingWebhookNode.maxTries,
    waitBetweenTries: existingWebhookNode.waitBetweenTries,
  });

  return {
    node: existingWebhookNode,
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

function buildWorkflowUpdatePayload(workflow) {
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings ?? {},
  };

  if (Object.hasOwn(workflow, "staticData")) {
    payload.staticData = workflow.staticData;
  }

  if (Object.hasOwn(workflow, "pinData")) {
    payload.pinData = workflow.pinData;
  }

  return payload;
}

function patchWorkflow(workflow, config) {
  if (!Array.isArray(workflow.nodes)) {
    throw new Error("Workflow response does not include a nodes array.");
  }

  const updateOrderNode = findNode(workflow, UPDATE_ORDER_NODE_NAME);

  if (!updateOrderNode) {
    throw new Error(`Node "${UPDATE_ORDER_NODE_NAME}" was not found.`);
  }

  const retryStyle = getRetryStyle(workflow);
  const nodeChange = createOrUpdateWebhookNode(
    workflow,
    updateOrderNode,
    config,
    retryStyle,
  );
  const connectionStatus = ensureMainConnection(
    workflow,
    UPDATE_ORDER_NODE_NAME,
    WEBHOOK_NODE_NAME,
  );

  return {
    nodeStatus: nodeChange.status,
    connectionStatus,
    retryStyle,
    webhookNodeId: nodeChange.node.id,
  };
}

function printChangeSummary(workflow, workflowTarget, patchResult, config) {
  console.log(`\n[${workflowTarget.name}] ${workflowTarget.id}`);
  console.log(`Workflow: ${workflow.name ?? "(unnamed)"}`);
  console.log(`- node "${WEBHOOK_NODE_NAME}": ${patchResult.nodeStatus}`);
  console.log(
    `- connection "${UPDATE_ORDER_NODE_NAME}" -> "${WEBHOOK_NODE_NAME}": ${patchResult.connectionStatus}`,
  );
  console.log(`- retry settings style: ${patchResult.retryStyle}`);
  console.log(`- webhook url: ${config.backendWebhookUrl}`);
  console.log("- x-webhook-secret: <from WEBHOOK_SHARED_SECRET>");
  console.log(`- webhook node id: ${patchResult.webhookNodeId}`);
}

async function processWorkflow(workflowTarget, config, confirm) {
  const url = workflowUrl(config, workflowTarget.id);
  console.log(`\nGET ${url}`);

  const workflow = await requestJson(url, config);
  const patchResult = patchWorkflow(workflow, config);

  printChangeSummary(workflow, workflowTarget, patchResult, config);

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
  console.log(`Target backend webhook: ${config.backendWebhookUrl}`);

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
