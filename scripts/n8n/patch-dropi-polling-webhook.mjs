#!/usr/bin/env node

import { randomUUID } from "node:crypto";

const WORKFLOWS = [
  { id: "9p1gvbDxdYqugkMT", name: "Dropi Polling (CO)", pais: "CO" },
  { id: "BQ7G5rSntIoszmJ3", name: "Dropi Polling MX", pais: "MX" },
];

const UPDATE_ORDER_NODE_NAME = "Actualizar orden Supabase";
const WEBHOOK_NODE_NAME = "Notificar backend CRM";
const ACTIVE_ORDERS_NODE_NAME = "Traer ordenes activas Supabase";
const COMPARE_FILTER_NODE_NAME = "Comparar y filtrar cambios";
const DROPI_WALLET_NODE_NAME = "Dropi Consultar Wallet";
const MAP_WALLET_NODE_NAME = "Mapear movimientos wallet completo";
const INSERT_WALLET_NODE_NAME = "Insertar movimientos wallet";
const DEFAULT_BACKEND_WEBHOOK_URL =
  "https://crm.pakora.online/api/webhooks/orders/status-changed";
const WEBHOOK_JSON_BODY = `={
  "order_id": {{ $('Comparar y filtrar cambios').item.json.supabase_id }}
}`;
const RECONCILIATION_SELECT_COLUMN = "tarea_generada_para_estado";
const CODE_RECONCILIATION_MARKER =
  "const yaProcesado = supabase.json.tarea_generada_para_estado === estadoNuevo;";
const CODE_STATUS_ANCHOR = "if (estadoAnterior === estadoNuevo) continue;";
const CODE_STATUS_REPLACEMENT = `${CODE_RECONCILIATION_MARKER}
  if (estadoAnterior === estadoNuevo && yaProcesado) continue;`;
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

function clone(value) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
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

function buildWalletMappingCode(pais) {
  return `const pais = ${JSON.stringify(pais)};
const rows = [];

function getObjects(payload) {
  if (Array.isArray(payload?.objects)) return payload.objects;
  if (Array.isArray(payload?.data?.objects)) return payload.data.objects;
  if (Array.isArray(payload?.body?.objects)) return payload.body.objects;
  return [];
}

function toAmount(value, fallback) {
  const parsed = parseFloat(value || fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

for (const item of $input.all()) {
  const objects = getObjects(item.json);

  for (const m of objects) {
    if (!m || m.order_id === null || m.order_id === undefined || m.order_id === "") {
      continue;
    }

    rows.push({
      id_movimiento_dropi: m.id,
      wallet_id: m.wallet_id ?? null,
      id_orden_dropi: m.order_id,
      identification_code: m.identification_code != null ? String(m.identification_code) : null,
      tipo: m.type ?? null,
      amount: toAmount(m.amount, 0),
      previous_amount: m.previous_amount != null ? toAmount(m.previous_amount, null) : null,
      description: m.description ?? null,
      guia_envio: m.shipping_guide ?? m.guide ?? null,
      registrado_en: m.created_at,
      pais,
    });
  }
}

return rows.length > 0 ? [{ json: { wallet_movements: rows } }] : [];
`;
}

function buildWalletMappingNode(walletSourceNode, pais) {
  return {
    parameters: {
      jsCode: buildWalletMappingCode(pais),
    },
    id: randomUUID(),
    name: MAP_WALLET_NODE_NAME,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: getPositionNear(walletSourceNode),
  };
}

function createOrUpdateWalletMappingNode(workflow, walletSourceNode, pais) {
  const existingNode = findNode(workflow, MAP_WALLET_NODE_NAME);

  if (!existingNode) {
    const newNode = buildWalletMappingNode(walletSourceNode, pais);
    workflow.nodes.push(newNode);

    return {
      node: newNode,
      status: "added",
    };
  }

  if (existingNode.type !== "n8n-nodes-base.code") {
    throw new Error(
      `"${MAP_WALLET_NODE_NAME}" exists but is not a Code node. Found type: ${existingNode.type ?? "(missing)"}.`,
    );
  }

  const before = JSON.stringify({
    parameters: existingNode.parameters,
  });

  existingNode.parameters = {
    ...(existingNode.parameters ?? {}),
    jsCode: buildWalletMappingCode(pais),
  };

  const after = JSON.stringify({
    parameters: existingNode.parameters,
  });

  return {
    node: existingNode,
    status: before === after ? "confirmed" : "updated",
  };
}

function getHttpRequestUrl(node) {
  return typeof node?.parameters?.url === "string" ? node.parameters.url : "";
}

function isSupabaseRestNode(node) {
  return (
    node?.type === "n8n-nodes-base.httpRequest" &&
    getHttpRequestUrl(node).includes("/rest/v1/")
  );
}

function findSupabaseRestSourceNode(workflow) {
  const preferredNodeNames = [
    ACTIVE_ORDERS_NODE_NAME,
    UPDATE_ORDER_NODE_NAME,
    "Actualizar liquidacion",
    "Actualizar devolucion",
  ];

  for (const nodeName of preferredNodeNames) {
    const node = findNode(workflow, nodeName);

    if (isSupabaseRestNode(node)) {
      return node;
    }
  }

  return workflow.nodes.find((node) => isSupabaseRestNode(node));
}

function buildWalletMovementsUrl(supabaseSourceNode) {
  const sourceUrl = getHttpRequestUrl(supabaseSourceNode);
  const restIndex = sourceUrl.indexOf("/rest/v1/");

  if (restIndex === -1) {
    throw new Error("Could not infer Supabase REST URL from existing workflow nodes.");
  }

  return `${sourceUrl.slice(0, restIndex)}/rest/v1/wallet_movements`;
}

function getHeaderParameterList(sourceParameters) {
  const headers = sourceParameters?.headerParameters?.parameters;

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

function upsertHeader(headers, name, value) {
  const existingHeader = headers.find(
    (header) => header.name.toLowerCase() === name.toLowerCase(),
  );

  if (existingHeader) {
    existingHeader.name = name;
    existingHeader.value = value;
    return;
  }

  headers.push({
    name,
    value,
  });
}

function buildWalletInsertParameters(supabaseSourceNode) {
  const sourceParameters = supabaseSourceNode.parameters ?? {};
  const headers = getHeaderParameterList(sourceParameters);

  upsertHeader(headers, "Content-Type", "application/json");
  upsertHeader(headers, "Prefer", "resolution=ignore-duplicates,return=minimal");

  const parameters = {
    method: "POST",
    url: buildWalletMovementsUrl(supabaseSourceNode),
    sendHeaders: true,
    headerParameters: {
      parameters: headers,
    },
    sendBody: true,
    specifyBody: "json",
    jsonBody: "={{ $json.wallet_movements }}",
    options: {},
  };

  for (const authKey of ["authentication", "genericAuthType", "nodeCredentialType"]) {
    if (Object.hasOwn(sourceParameters, authKey)) {
      parameters[authKey] = clone(sourceParameters[authKey]);
    }
  }

  return parameters;
}

function applyNodeCredentialsFromSource(targetNode, sourceNode) {
  if (Object.hasOwn(sourceNode, "credentials")) {
    targetNode.credentials = clone(sourceNode.credentials);
    return;
  }

  delete targetNode.credentials;
}

function buildWalletInsertNode(walletMappingNode, supabaseSourceNode, retryStyle) {
  const node = {
    parameters: buildWalletInsertParameters(supabaseSourceNode),
    id: randomUUID(),
    name: INSERT_WALLET_NODE_NAME,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.4,
    position: getPositionNear(walletMappingNode),
  };

  applyNodeCredentialsFromSource(node, supabaseSourceNode);
  applyRetrySettings(node, retryStyle);

  return node;
}

function createOrUpdateWalletInsertNode(
  workflow,
  walletMappingNode,
  supabaseSourceNode,
  retryStyle,
) {
  const existingNode = findNode(workflow, INSERT_WALLET_NODE_NAME);

  if (!existingNode) {
    const newNode = buildWalletInsertNode(
      walletMappingNode,
      supabaseSourceNode,
      retryStyle,
    );
    workflow.nodes.push(newNode);

    return {
      node: newNode,
      status: "added",
    };
  }

  if (existingNode.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${INSERT_WALLET_NODE_NAME}" exists but is not an HTTP Request node. Found type: ${existingNode.type ?? "(missing)"}.`,
    );
  }

  const before = JSON.stringify({
    parameters: existingNode.parameters,
    credentials: existingNode.credentials,
    retryOnFail: existingNode.retryOnFail,
    maxTries: existingNode.maxTries,
    waitBetweenTries: existingNode.waitBetweenTries,
  });

  existingNode.parameters = buildWalletInsertParameters(supabaseSourceNode);
  applyNodeCredentialsFromSource(existingNode, supabaseSourceNode);
  applyRetrySettings(existingNode, retryStyle);

  const after = JSON.stringify({
    parameters: existingNode.parameters,
    credentials: existingNode.credentials,
    retryOnFail: existingNode.retryOnFail,
    maxTries: existingNode.maxTries,
    waitBetweenTries: existingNode.waitBetweenTries,
  });

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

function patchSelectParam(urlValue, columnName) {
  if (typeof urlValue !== "string") {
    throw new Error(
      `"${ACTIVE_ORDERS_NODE_NAME}" does not have a string parameters.url value.`,
    );
  }

  const selectMatch = /([?&]select=)([^&]*)/.exec(urlValue);

  if (!selectMatch) {
    throw new Error(
      `"${ACTIVE_ORDERS_NODE_NAME}" URL does not contain a select= query parameter.`,
    );
  }

  const [matchedSelect, selectPrefix, rawSelectValue] = selectMatch;
  let decodedSelectValue = rawSelectValue;

  try {
    decodedSelectValue = decodeURIComponent(rawSelectValue);
  } catch {
    decodedSelectValue = rawSelectValue;
  }

  const selectedColumns = decodedSelectValue
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);

  if (selectedColumns.includes(columnName)) {
    return {
      nextUrl: urlValue,
      status: "confirmed",
    };
  }

  const delimiter = rawSelectValue.includes("%2C") ? "%2C" : ",";
  const nextSelectValue = rawSelectValue
    ? `${rawSelectValue}${delimiter}${columnName}`
    : columnName;
  const startIndex = selectMatch.index;
  const endIndex = startIndex + matchedSelect.length;

  return {
    nextUrl: `${urlValue.slice(0, startIndex)}${selectPrefix}${nextSelectValue}${urlValue.slice(endIndex)}`,
    status: "added",
  };
}

function patchActiveOrdersSelect(workflow) {
  const node = findNode(workflow, ACTIVE_ORDERS_NODE_NAME);

  if (!node) {
    return "skipped-not-found";
  }

  if (node.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${ACTIVE_ORDERS_NODE_NAME}" is not an HTTP Request node. Found type: ${node.type ?? "(missing)"}.`,
    );
  }

  if (
    !node.parameters ||
    typeof node.parameters !== "object" ||
    Array.isArray(node.parameters)
  ) {
    throw new Error(`"${ACTIVE_ORDERS_NODE_NAME}" does not have parameters.`);
  }

  const { nextUrl, status } = patchSelectParam(
    node.parameters.url,
    RECONCILIATION_SELECT_COLUMN,
  );

  node.parameters.url = nextUrl;

  return status;
}

function patchCompareFilterCode(workflow) {
  const node = findNode(workflow, COMPARE_FILTER_NODE_NAME);

  if (!node) {
    return "skipped-not-found";
  }

  if (node.type !== "n8n-nodes-base.code") {
    throw new Error(
      `"${COMPARE_FILTER_NODE_NAME}" is not a Code node. Found type: ${node.type ?? "(missing)"}.`,
    );
  }

  if (
    !node.parameters ||
    typeof node.parameters !== "object" ||
    Array.isArray(node.parameters)
  ) {
    throw new Error(`"${COMPARE_FILTER_NODE_NAME}" does not have parameters.`);
  }

  const jsCode = node.parameters.jsCode;

  if (typeof jsCode !== "string") {
    throw new Error(`"${COMPARE_FILTER_NODE_NAME}" does not have string jsCode.`);
  }

  if (jsCode.includes("yaProcesado")) {
    return "already-patched";
  }

  if (!jsCode.includes(CODE_STATUS_ANCHOR)) {
    throw new Error(
      `"${COMPARE_FILTER_NODE_NAME}" jsCode anchor not found. Expected exact line: ${CODE_STATUS_ANCHOR}`,
    );
  }

  node.parameters.jsCode = jsCode.replace(
    CODE_STATUS_ANCHOR,
    CODE_STATUS_REPLACEMENT,
  );

  return "added";
}

function getFilteredWorkflowSettings(workflow) {
  const settings =
    workflow.settings &&
    typeof workflow.settings === "object" &&
    !Array.isArray(workflow.settings)
      ? workflow.settings
      : {};
  const presentKeys = Object.keys(settings).sort();
  const keptKeys = presentKeys.filter((key) =>
    ALLOWED_WORKFLOW_SETTINGS_KEYS.has(key),
  );
  const droppedKeys = presentKeys.filter(
    (key) => !ALLOWED_WORKFLOW_SETTINGS_KEYS.has(key),
  );
  const filteredSettings = Object.fromEntries(
    keptKeys.map((key) => [key, settings[key]]),
  );

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

  const updateOrderNode = findNode(workflow, UPDATE_ORDER_NODE_NAME);

  if (!updateOrderNode) {
    throw new Error(`Node "${UPDATE_ORDER_NODE_NAME}" was not found.`);
  }

  const walletSourceNode = findNode(workflow, DROPI_WALLET_NODE_NAME);

  if (!walletSourceNode) {
    throw new Error(`Node "${DROPI_WALLET_NODE_NAME}" was not found.`);
  }

  const supabaseSourceNode = findSupabaseRestSourceNode(workflow);

  if (!supabaseSourceNode) {
    throw new Error(
      "No existing Supabase REST HTTP Request node was found to infer URL/auth headers.",
    );
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
  const activeOrdersSelectStatus = patchActiveOrdersSelect(workflow);
  const compareFilterCodeStatus = patchCompareFilterCode(workflow);
  const walletMappingNodeChange = createOrUpdateWalletMappingNode(
    workflow,
    walletSourceNode,
    workflowTarget.pais,
  );
  const walletInsertNodeChange = createOrUpdateWalletInsertNode(
    workflow,
    walletMappingNodeChange.node,
    supabaseSourceNode,
    retryStyle,
  );
  const walletSourceConnectionStatus = ensureMainConnection(
    workflow,
    DROPI_WALLET_NODE_NAME,
    MAP_WALLET_NODE_NAME,
  );
  const walletInsertConnectionStatus = ensureMainConnection(
    workflow,
    MAP_WALLET_NODE_NAME,
    INSERT_WALLET_NODE_NAME,
  );

  return {
    nodeStatus: nodeChange.status,
    connectionStatus,
    activeOrdersSelectStatus,
    compareFilterCodeStatus,
    walletMappingNodeStatus: walletMappingNodeChange.status,
    walletInsertNodeStatus: walletInsertNodeChange.status,
    walletSourceConnectionStatus,
    walletInsertConnectionStatus,
    walletInsertUrl: walletInsertNodeChange.node.parameters.url,
    supabaseAuthSourceNodeName: supabaseSourceNode.name,
    retryStyle,
    settingsSummary: getFilteredWorkflowSettings(workflow),
    webhookNodeId: nodeChange.node.id,
    walletMappingNodeId: walletMappingNodeChange.node.id,
    walletInsertNodeId: walletInsertNodeChange.node.id,
  };
}

function printChangeSummary(workflow, workflowTarget, patchResult, config) {
  console.log(`\n[${workflowTarget.name}] ${workflowTarget.id}`);
  console.log(`Workflow: ${workflow.name ?? "(unnamed)"}`);
  console.log(`- node "${WEBHOOK_NODE_NAME}": ${patchResult.nodeStatus}`);
  console.log(
    `- connection "${UPDATE_ORDER_NODE_NAME}" -> "${WEBHOOK_NODE_NAME}": ${patchResult.connectionStatus}`,
  );
  console.log(
    `- "${ACTIVE_ORDERS_NODE_NAME}" select ${RECONCILIATION_SELECT_COLUMN}: ${patchResult.activeOrdersSelectStatus}`,
  );
  console.log(
    `- "${COMPARE_FILTER_NODE_NAME}" reconciliation code: ${patchResult.compareFilterCodeStatus}`,
  );
  console.log(
    `- node "${MAP_WALLET_NODE_NAME}": ${patchResult.walletMappingNodeStatus}`,
  );
  console.log(
    `- node "${INSERT_WALLET_NODE_NAME}": ${patchResult.walletInsertNodeStatus}`,
  );
  console.log(
    `- connection "${DROPI_WALLET_NODE_NAME}" -> "${MAP_WALLET_NODE_NAME}": ${patchResult.walletSourceConnectionStatus}`,
  );
  console.log(
    `- connection "${MAP_WALLET_NODE_NAME}" -> "${INSERT_WALLET_NODE_NAME}": ${patchResult.walletInsertConnectionStatus}`,
  );
  console.log(`- wallet pais literal: ${workflowTarget.pais}`);
  console.log(`- wallet insert url: ${patchResult.walletInsertUrl}`);
  console.log(
    `- Supabase auth/header source node for wallet insert: ${patchResult.supabaseAuthSourceNodeName}`,
  );
  console.log(`- retry settings style: ${patchResult.retryStyle}`);
  console.log(
    `- workflow.settings keys returned: ${formatKeys(patchResult.settingsSummary.presentKeys)}`,
  );
  console.log(
    `- workflow.settings keys sent: ${formatKeys(patchResult.settingsSummary.keptKeys)}`,
  );
  console.log(
    `- workflow.settings keys dropped: ${formatKeys(patchResult.settingsSummary.droppedKeys)}`,
  );
  console.log(`- webhook url: ${config.backendWebhookUrl}`);
  console.log("- x-webhook-secret: <from WEBHOOK_SHARED_SECRET>");
  console.log(`- webhook node id: ${patchResult.webhookNodeId}`);
  console.log(`- wallet map node id: ${patchResult.walletMappingNodeId}`);
  console.log(`- wallet insert node id: ${patchResult.walletInsertNodeId}`);
}

async function processWorkflow(workflowTarget, config, confirm) {
  const url = workflowUrl(config, workflowTarget.id);
  console.log(`\nGET ${url}`);

  const workflow = await requestJson(url, config);
  const patchResult = patchWorkflow(workflow, workflowTarget, config);

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
