#!/usr/bin/env node

import { randomUUID } from "node:crypto";

const WORKFLOWS = [
  { id: "9p1gvbDxdYqugkMT", name: "Dropi Polling (CO)", pais: "CO" },
  { id: "BQ7G5rSntIoszmJ3", name: "Dropi Polling MX", pais: "MX" },
];

const UPDATE_ORDER_NODE_NAME = "Actualizar orden Supabase";
const REGISTER_HISTORY_NODE_NAME = "Registrar historial";
const WEBHOOK_NODE_NAME = "Notificar backend CRM";
const ACTIVE_ORDERS_NODE_NAME = "Traer ordenes activas Supabase";
const COMPARE_FILTER_NODE_NAME = "Comparar y filtrar cambios";
const FILTER_HISTORY_NODE_NAME = "Filtrar historial faltante";
const PROCESS_HISTORY_NODE_NAME = "Procesar historial completo";
const DROPI_WALLET_NODE_NAME = "Dropi Consultar Wallet";
const MAP_WALLET_NODE_NAME = "Mapear movimientos wallet completo";
const INSERT_WALLET_NODE_NAME = "Insertar movimientos wallet";
const DROPI_LOGIN_FINAL_NODE_NAME = "Dropi Login Final";
const STALE_ORDERS_NODE_NAME = "Chequear pedidos estancados";
const DEFAULT_BACKEND_WEBHOOK_URL =
  "https://crm.pakora.online/api/webhooks/orders/status-changed";
const DEFAULT_PROCESS_HISTORY_WEBHOOK_URL =
  "https://crm.pakora.online/api/webhooks/orders/process-history";
const STALE_ORDERS_CRON_URL =
  "https://crm.pakora.online/api/cron/check-stale-orders";
const WEBHOOK_JSON_BODY = `={
  "order_id": {{ $('Comparar y filtrar cambios').item.json.supabase_id }}
}`;
const PROCESS_HISTORY_JSON_BODY = `={{ JSON.stringify({ order_id: $json.supabase_id, history: ($json.historiaFaltante || []).map((entry) => ({ estado: entry.estado, transportadora: entry.transportadora ?? null, novedad: entry.novedad ?? null, registrado_en: entry.registrado_en })) }) }}`;
const UPDATE_ORDER_JSON_BODY = `={{ JSON.stringify({ id_orden_dropi: $json.dropi_id, estado_dropi: $json.estado_nuevo, estado_crm: $json.estado_crm, guia_envio: $json.guia, transportadora: $json.transportadora, nivel_riesgo: $json.nivel_riesgo, total_pedidos_cliente: $json.total_pedidos_cliente ?? 0, pedidos_entregados_cliente: $json.pedidos_entregados_cliente ?? 0, pedidos_devueltos_cliente: $json.pedidos_devueltos_cliente ?? 0, activo: $json.cerrar ? false : true, costo_producto: $json.costo_producto ?? 0, costo_envio: $json.costo_envio ?? 0, comision_cod: $json.comision_cod ?? 0, fecha_entrega_real: $json.estado_nuevo === "ENTREGADO" ? $json.registrado_en : null }) }}`;
const REGISTER_HISTORY_JSON_BODY = `={{ JSON.stringify({ order_id: $('Comparar y filtrar cambios').item.json.supabase_id, estado: $('Comparar y filtrar cambios').item.json.estado_nuevo, transportadora: $('Comparar y filtrar cambios').item.json.transportadora, registrado_en: $('Comparar y filtrar cambios').item.json.registrado_en, novedad: $('Comparar y filtrar cambios').item.json.novedad }) }}`;
const UPDATE_ORDER_JSON_BODY_MARKER = "={{ JSON.stringify(";
const WALLET_ON_CONFLICT_PARAM = "on_conflict=pais,id_movimiento_dropi";
const RECONCILIATION_SELECT_COLUMN = "tarea_generada_para_estado";
const LATEST_HISTORY_SELECT_COLUMN = "status_history(registrado_en)";
const LATEST_HISTORY_ORDER_PARAM = "status_history.order";
const LATEST_HISTORY_ORDER_VALUE = "registrado_en.desc";
const LATEST_HISTORY_LIMIT_PARAM = "status_history.limit";
const LATEST_HISTORY_LIMIT_VALUE = "1";
const CODE_RECONCILIATION_MARKER =
  "const yaProcesado = supabase.json.tarea_generada_para_estado === estadoNuevo;";
const CODE_HISTORY_REPLAY_MARKER =
  "function getMissingHistoryEntries(history, latestKnownRegisteredAt, fallbackTransportadora, fallbackNovedad)";
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
    "CRON_SECRET",
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
  const processHistoryWebhookUrl =
    readEnv("PROCESS_HISTORY_WEBHOOK_URL") ?? DEFAULT_PROCESS_HISTORY_WEBHOOK_URL;

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

  try {
    new URL(processHistoryWebhookUrl);
  } catch {
    throw new Error(
      "PROCESS_HISTORY_WEBHOOK_URL must be a full URL when provided.",
    );
  }

  return {
    n8nBaseUrl,
    apiKey: readEnv("N8N_API_KEY"),
    webhookSharedSecret: readEnv("WEBHOOK_SHARED_SECRET"),
    cronSecret: readEnv("CRON_SECRET"),
    backendWebhookUrl,
    processHistoryWebhookUrl,
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

function buildProcessHistoryParameters(config) {
  return {
    method: "POST",
    url: config.processHistoryWebhookUrl,
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
    jsonBody: PROCESS_HISTORY_JSON_BODY,
    options: {},
  };
}

function buildProcessHistoryNode(historyFilterNode, config, retryStyle) {
  const node = {
    parameters: buildProcessHistoryParameters(config),
    id: randomUUID(),
    name: PROCESS_HISTORY_NODE_NAME,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.4,
    position: getPositionNear(historyFilterNode),
  };

  applyRetrySettings(node, retryStyle);

  return node;
}

function createOrUpdateProcessHistoryNode(
  workflow,
  historyFilterNode,
  config,
  retryStyle,
) {
  const existingNode = findNode(workflow, PROCESS_HISTORY_NODE_NAME);

  if (!existingNode) {
    const newNode = buildProcessHistoryNode(historyFilterNode, config, retryStyle);
    workflow.nodes.push(newNode);

    return {
      node: newNode,
      status: "added",
    };
  }

  if (existingNode.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${PROCESS_HISTORY_NODE_NAME}" exists but is not an HTTP Request node. Found type: ${existingNode.type ?? "(missing)"}.`,
    );
  }

  const before = JSON.stringify({
    parameters: existingNode.parameters,
    retryOnFail: existingNode.retryOnFail,
    maxTries: existingNode.maxTries,
    waitBetweenTries: existingNode.waitBetweenTries,
  });

  existingNode.parameters = buildProcessHistoryParameters(config);
  applyRetrySettings(existingNode, retryStyle);

  const after = JSON.stringify({
    parameters: existingNode.parameters,
    retryOnFail: existingNode.retryOnFail,
    maxTries: existingNode.maxTries,
    waitBetweenTries: existingNode.waitBetweenTries,
  });

  return {
    node: existingNode,
    status: before === after ? "confirmed" : "updated",
  };
}

function buildStaleOrdersParameters(config) {
  return {
    method: "GET",
    url: STALE_ORDERS_CRON_URL,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        {
          name: "Authorization",
          value: `Bearer ${config.cronSecret}`,
        },
      ],
    },
    options: {},
  };
}

function buildStaleOrdersNode(sourceNode, config) {
  return {
    parameters: buildStaleOrdersParameters(config),
    id: randomUUID(),
    name: STALE_ORDERS_NODE_NAME,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.4,
    position: getPositionNear(sourceNode),
  };
}

function createOrUpdateStaleOrdersNode(workflow, sourceNode, config) {
  const existingNode = findNode(workflow, STALE_ORDERS_NODE_NAME);

  if (!existingNode) {
    const newNode = buildStaleOrdersNode(sourceNode, config);
    workflow.nodes.push(newNode);

    return {
      node: newNode,
      status: "added",
    };
  }

  if (existingNode.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${STALE_ORDERS_NODE_NAME}" exists but is not an HTTP Request node. Found type: ${existingNode.type ?? "(missing)"}.`,
    );
  }

  const before = JSON.stringify({
    parameters: existingNode.parameters,
    retryOnFail: existingNode.retryOnFail,
    maxTries: existingNode.maxTries,
    waitBetweenTries: existingNode.waitBetweenTries,
  });

  existingNode.parameters = buildStaleOrdersParameters(config);
  delete existingNode.retryOnFail;
  delete existingNode.maxTries;
  delete existingNode.waitBetweenTries;

  const after = JSON.stringify({
    parameters: existingNode.parameters,
    retryOnFail: existingNode.retryOnFail,
    maxTries: existingNode.maxTries,
    waitBetweenTries: existingNode.waitBetweenTries,
  });

  return {
    node: existingNode,
    status: before === after ? "confirmed" : "updated",
  };
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

function patchUpdateOrderJsonBody(updateOrderNode) {
  if (updateOrderNode.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${UPDATE_ORDER_NODE_NAME}" is not an HTTP Request node. Found type: ${updateOrderNode.type ?? "(missing)"}.`,
    );
  }

  if (
    !updateOrderNode.parameters ||
    typeof updateOrderNode.parameters !== "object" ||
    Array.isArray(updateOrderNode.parameters)
  ) {
    throw new Error(`"${UPDATE_ORDER_NODE_NAME}" does not have parameters.`);
  }

  const jsonBody = updateOrderNode.parameters.jsonBody;

  if (
    typeof jsonBody === "string" &&
    jsonBody.trimStart().startsWith(UPDATE_ORDER_JSON_BODY_MARKER)
  ) {
    return "already-patched";
  }

  updateOrderNode.parameters.jsonBody = UPDATE_ORDER_JSON_BODY;

  return "updated";
}

function patchRegisterHistoryJsonBody(workflow) {
  const registerHistoryNode = findNode(workflow, REGISTER_HISTORY_NODE_NAME);

  if (!registerHistoryNode) {
    throw new Error(`Node "${REGISTER_HISTORY_NODE_NAME}" was not found.`);
  }

  if (registerHistoryNode.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${REGISTER_HISTORY_NODE_NAME}" is not an HTTP Request node. Found type: ${registerHistoryNode.type ?? "(missing)"}.`,
    );
  }

  if (
    !registerHistoryNode.parameters ||
    typeof registerHistoryNode.parameters !== "object" ||
    Array.isArray(registerHistoryNode.parameters)
  ) {
    throw new Error(`"${REGISTER_HISTORY_NODE_NAME}" does not have parameters.`);
  }

  const beforeJsonBody = registerHistoryNode.parameters.jsonBody;

  if (
    typeof beforeJsonBody === "string" &&
    beforeJsonBody.trimStart().startsWith(UPDATE_ORDER_JSON_BODY_MARKER) &&
    beforeJsonBody.includes("novedad")
  ) {
    return {
      status: "already-patched",
      beforeJsonBody,
      afterJsonBody: beforeJsonBody,
    };
  }

  registerHistoryNode.parameters.jsonBody = REGISTER_HISTORY_JSON_BODY;

  return {
    status: "updated",
    beforeJsonBody,
    afterJsonBody: REGISTER_HISTORY_JSON_BODY,
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

  return ensureWalletOnConflictParam(
    `${sourceUrl.slice(0, restIndex)}/rest/v1/wallet_movements`,
  );
}

function ensureWalletOnConflictParam(urlValue) {
  if (urlValue.includes("on_conflict=")) {
    return urlValue;
  }

  const separator = urlValue.includes("?") ? "&" : "?";
  return `${urlValue}${separator}${WALLET_ON_CONFLICT_PARAM}`;
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
      onConflictStatus: "added",
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
  const onConflictStatus = getHttpRequestUrl(existingNode).includes("on_conflict=")
    ? "confirmed"
    : "added";

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
    onConflictStatus,
  };
}

function buildHistoryFilterCode() {
  return `return $input.all().filter((item) =>
  Array.isArray(item.json.historiaFaltante) && item.json.historiaFaltante.length > 0,
);
`;
}

function buildHistoryFilterNode(compareFilterNode) {
  return {
    parameters: {
      jsCode: buildHistoryFilterCode(),
    },
    id: randomUUID(),
    name: FILTER_HISTORY_NODE_NAME,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: getPositionNear(compareFilterNode),
  };
}

function createOrUpdateHistoryFilterNode(workflow, compareFilterNode) {
  const existingNode = findNode(workflow, FILTER_HISTORY_NODE_NAME);

  if (!existingNode) {
    const newNode = buildHistoryFilterNode(compareFilterNode);
    workflow.nodes.push(newNode);

    return {
      node: newNode,
      status: "added",
    };
  }

  if (existingNode.type !== "n8n-nodes-base.code") {
    throw new Error(
      `"${FILTER_HISTORY_NODE_NAME}" exists but is not a Code node. Found type: ${existingNode.type ?? "(missing)"}.`,
    );
  }

  const before = JSON.stringify({
    parameters: existingNode.parameters,
  });

  existingNode.parameters = {
    ...(existingNode.parameters ?? {}),
    jsCode: buildHistoryFilterCode(),
  };

  const after = JSON.stringify({
    parameters: existingNode.parameters,
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

function assertMainConnection(workflow, sourceNodeName, targetNodeName) {
  const outputConnections = workflow.connections?.[sourceNodeName]?.main?.[0];
  const hasConnection =
    Array.isArray(outputConnections) &&
    outputConnections.some((connection) => connection.node === targetNodeName);

  if (!hasConnection) {
    throw new Error(
      `Expected existing connection "${sourceNodeName}" -> "${targetNodeName}" was not found.`,
    );
  }

  return "confirmed";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeQueryValue(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function patchQueryParam(urlValue, paramName, paramValue) {
  if (typeof urlValue !== "string") {
    throw new Error(
      `"${ACTIVE_ORDERS_NODE_NAME}" does not have a string parameters.url value.`,
    );
  }

  const paramPattern = new RegExp(`([?&]${escapeRegExp(paramName)}=)([^&]*)`);
  const paramMatch = paramPattern.exec(urlValue);

  if (paramMatch) {
    const [matchedParam, paramPrefix, rawValue] = paramMatch;

    if (decodeQueryValue(rawValue) === paramValue) {
      return {
        nextUrl: urlValue,
        status: "confirmed",
      };
    }

    const startIndex = paramMatch.index;
    const endIndex = startIndex + matchedParam.length;

    return {
      nextUrl: `${urlValue.slice(0, startIndex)}${paramPrefix}${paramValue}${urlValue.slice(endIndex)}`,
      status: "updated",
    };
  }

  const separator = urlValue.includes("?") ? "&" : "?";

  return {
    nextUrl: `${urlValue}${separator}${paramName}=${paramValue}`,
    status: "added",
  };
}

function combinePatchStatuses(statuses) {
  if (statuses.includes("updated")) {
    return "updated";
  }

  if (statuses.includes("added")) {
    return "added";
  }

  if (statuses.includes("already-patched")) {
    return "already-patched";
  }

  return "confirmed";
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
  const decodedSelectValue = decodeQueryValue(rawSelectValue);

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

  const reconciliationPatch = patchSelectParam(
    node.parameters.url,
    RECONCILIATION_SELECT_COLUMN,
  );
  const latestHistorySelectPatch = patchSelectParam(
    reconciliationPatch.nextUrl,
    LATEST_HISTORY_SELECT_COLUMN,
  );
  const latestHistoryOrderPatch = patchQueryParam(
    latestHistorySelectPatch.nextUrl,
    LATEST_HISTORY_ORDER_PARAM,
    LATEST_HISTORY_ORDER_VALUE,
  );
  const latestHistoryLimitPatch = patchQueryParam(
    latestHistoryOrderPatch.nextUrl,
    LATEST_HISTORY_LIMIT_PARAM,
    LATEST_HISTORY_LIMIT_VALUE,
  );

  node.parameters.url = latestHistoryLimitPatch.nextUrl;

  return {
    reconciliationStatus: reconciliationPatch.status,
    latestHistoryStatus: combinePatchStatuses([
      latestHistorySelectPatch.status,
      latestHistoryOrderPatch.status,
      latestHistoryLimitPatch.status,
    ]),
  };
}

function buildCompareFilterCode() {
  return `const dropiResponse = $('Dropi Consultar Pedidos').item.json;
const dropiOrders = Array.isArray(dropiResponse.objects) ? dropiResponse.objects : [];
const supabaseOrders = $('Traer ordenes activas Supabase').all();

const estadosCerrados = ['ENTREGADO', 'CANCELADO', 'DEVOLUCION'];

const estadosNovedad = [
  'DESTINATARIO SE REHUSA A RECIBIR',
  'Se visita, no se logra entrega',
  'No contesta Cliente',
  'PARA NUEVO INTENTO ENTREGA',
  'EN CONFIRMACIÓN TELEFÓNICA',
  'NOVEDAD',
  'CERRADO POR INCIDENCIA, VER CAUSA',
  'RECLAME EN OFICINA'
];

const generaTarea = (estadoNuevo, novedad) => {
  if (estadoNuevo === 'GUIA_GENERADA') return 'notificar_guia';
  if (estadoNuevo === 'PENDIENTE CONFIRMACION') return 'llamar_confirmacion';
  if (estadosNovedad.includes(estadoNuevo)) return 'presionar_entrega';
  if (novedad && estadosNovedad.some(e => novedad.toLowerCase().includes(e.toLowerCase()))) return 'presionar_entrega';
  return null;
};

function normalizeId(value) {
  return value === null || value === undefined || value === '' ? null : String(value);
}

function getLatestKnownRegisteredAt(supabaseOrder) {
  const history = supabaseOrder.status_history;

  if (Array.isArray(history) && history.length > 0) {
    return history[0]?.registrado_en ?? null;
  }

  if (history && typeof history === 'object') {
    return history.registrado_en ?? null;
  }

  return null;
}

function getHistoryEstado(historyEntry) {
  return historyEntry?.status ?? historyEntry?.estado ?? null;
}

function getHistoryRegisteredAt(historyEntry) {
  return historyEntry?.created_at ?? historyEntry?.registrado_en ?? historyEntry?.updated_at ?? null;
}

function getHistoryNovedad(historyEntry, fallbackNovedad) {
  return (
    historyEntry?.novedad ??
    historyEntry?.observacion ??
    historyEntry?.observation ??
    historyEntry?.description ??
    historyEntry?.notes ??
    fallbackNovedad ??
    null
  );
}

function isStrictlyAfterKnownRegisteredAt(registradoEn, latestKnownRegisteredAt) {
  if (!latestKnownRegisteredAt) return true;
  if (!registradoEn) return false;

  const registeredTime = Date.parse(registradoEn);
  const latestKnownTime = Date.parse(latestKnownRegisteredAt);

  if (Number.isFinite(registeredTime) && Number.isFinite(latestKnownTime)) {
    return registeredTime > latestKnownTime;
  }

  return String(registradoEn) > String(latestKnownRegisteredAt);
}

function getMissingHistoryEntries(history, latestKnownRegisteredAt, fallbackTransportadora, fallbackNovedad) {
  if (!Array.isArray(history)) return [];

  return history
    .map((historyEntry) => {
      const estado = getHistoryEstado(historyEntry);
      const registradoEn = getHistoryRegisteredAt(historyEntry);

      if (!estado || !registradoEn) {
        return null;
      }

      return {
        estado,
        transportadora:
          historyEntry?.transportadora ??
          historyEntry?.distribution_company?.name ??
          fallbackTransportadora ??
          null,
        novedad: getHistoryNovedad(historyEntry, fallbackNovedad),
        registrado_en: registradoEn,
      };
    })
    .filter(Boolean)
    .filter((historyEntry) =>
      isStrictlyAfterKnownRegisteredAt(historyEntry.registrado_en, latestKnownRegisteredAt),
    );
}

const results = [];

for (const dropi of dropiOrders) {
  const dropiShopOrderId = normalizeId(dropi.shop_order_id);
  const dropiId = normalizeId(dropi.id);
  const supabase = supabaseOrders.find((s) =>
    (dropiShopOrderId && normalizeId(s.json.id_orden_shopify) === dropiShopOrderId) ||
    (dropiId && normalizeId(s.json.id_orden_dropi) === dropiId)
  );

  if (!supabase) continue;

  const estadoAnterior = supabase.json.estado_dropi;
  const estadoNuevo = dropi.status;
  const yaProcesado = supabase.json.tarea_generada_para_estado === estadoNuevo;
  const cerrar = estadosCerrados.includes(estadoNuevo);
  const history = Array.isArray(dropi.history) ? dropi.history : [];
  const historyMatch = [...history].reverse().find((h) => getHistoryEstado(h) === estadoNuevo);
  const registradoEn = historyMatch ? getHistoryRegisteredAt(historyMatch) : dropi.updated_at;
  const novedad = dropi.novedad_servientrega || null;
  const transportadora = dropi.distribution_company?.name || null;
  const latestKnownStatusRegisteredAt = getLatestKnownRegisteredAt(supabase.json);
  const historiaFaltante = getMissingHistoryEntries(
    history,
    latestKnownStatusRegisteredAt,
    transportadora,
    novedad,
  );
  const debeActualizarEstado = !(estadoAnterior === estadoNuevo && yaProcesado);

  if (!debeActualizarEstado && historiaFaltante.length === 0) continue;

  const accion = generaTarea(estadoNuevo, novedad);

  const totalPedidos = dropi.client_total_orders || 0;
  const devoluciones = dropi.client_total_orders_returneds || 0;
  let nivelRiesgo = 'sin_datos';
  if (totalPedidos > 0) {
    const tasa = devoluciones / totalPedidos;
    if (tasa >= 0.5) nivelRiesgo = 'alto';
    else if (tasa >= 0.25) nivelRiesgo = 'medio';
    else nivelRiesgo = 'bajo';
  }

  let estadoCrm;
  if (cerrar) {
    if (estadoNuevo === 'ENTREGADO') estadoCrm = 'entregado';
    else if (estadoNuevo.includes('DEVOLUCION')) estadoCrm = 'devolucion';
    else estadoCrm = 'cancelado';
  } else if (estadoNuevo === 'PENDIENTE CONFIRMACION') {
    estadoCrm = 'nuevo';
  } else {
    estadoCrm = 'en_ruta';
  }

  const orderDetail = (dropi.orderdetails || [])[0] || {};
  const costoProducto = parseFloat(orderDetail.supplier_price || 0);
  const costoEnvio = parseFloat(dropi.shipping_amount || 0);

  results.push({
    json: {
      supabase_id: supabase.json.id,
      dropi_id: dropi.id,
      numero_orden: supabase.json.numero_orden,
      estado_anterior: estadoAnterior,
      estado_nuevo: estadoNuevo,
      estado_crm: estadoCrm,
      registrado_en: registradoEn,
      novedad,
      cerrar,
      accion,
      nombre: dropi.name,
      telefono: String(dropi.phone),
      guia: dropi.shipping_guide,
      transportadora,
      nivel_riesgo: nivelRiesgo,
      total_pedidos_cliente: dropi.client_total_orders,
      pedidos_entregados_cliente: dropi.client_total_orders_delivered,
      pedidos_devueltos_cliente: devoluciones,
      costo_producto: costoProducto,
      costo_envio: costoEnvio,
      comision_cod: 0,
      latest_status_history_registrado_en: latestKnownStatusRegisteredAt,
      historiaFaltante,
      debe_actualizar_estado: debeActualizarEstado
    }
  });
}

return results.length > 0 ? results : [];
`;
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

  if (jsCode.includes(CODE_HISTORY_REPLAY_MARKER)) {
    return "already-patched";
  }

  if (!jsCode.includes("const dropiResponse") || !jsCode.includes("results.push")) {
    throw new Error(
      `"${COMPARE_FILTER_NODE_NAME}" jsCode does not match the expected Dropi comparison shape.`,
    );
  }

  node.parameters.jsCode = buildCompareFilterCode();

  return jsCode.includes(CODE_RECONCILIATION_MARKER) ? "updated" : "added";
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

function formatJsonBodyForSummary(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined) {
    return "(undefined)";
  }

  return JSON.stringify(value, null, 2);
}

function indentBlock(value, prefix = "    ") {
  return formatJsonBodyForSummary(value)
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function patchWorkflow(workflow, workflowTarget, config) {
  if (!Array.isArray(workflow.nodes)) {
    throw new Error("Workflow response does not include a nodes array.");
  }

  const updateOrderNode = findNode(workflow, UPDATE_ORDER_NODE_NAME);

  if (!updateOrderNode) {
    throw new Error(`Node "${UPDATE_ORDER_NODE_NAME}" was not found.`);
  }

  const compareFilterNode = findNode(workflow, COMPARE_FILTER_NODE_NAME);

  if (!compareFilterNode) {
    throw new Error(`Node "${COMPARE_FILTER_NODE_NAME}" was not found.`);
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
  const updateOrderJsonBodyStatus = patchUpdateOrderJsonBody(updateOrderNode);
  const registerHistoryJsonBodyPatch = patchRegisterHistoryJsonBody(workflow);
  const singleStateConnectionStatus = assertMainConnection(
    workflow,
    COMPARE_FILTER_NODE_NAME,
    UPDATE_ORDER_NODE_NAME,
  );
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
  const activeOrdersSelectPatch = patchActiveOrdersSelect(workflow);
  const compareFilterCodeStatus = patchCompareFilterCode(workflow);
  const historyFilterNodeChange = createOrUpdateHistoryFilterNode(
    workflow,
    compareFilterNode,
  );
  const processHistoryNodeChange = createOrUpdateProcessHistoryNode(
    workflow,
    historyFilterNodeChange.node,
    config,
    retryStyle,
  );
  const historyFilterConnectionStatus = ensureMainConnection(
    workflow,
    COMPARE_FILTER_NODE_NAME,
    FILTER_HISTORY_NODE_NAME,
  );
  const processHistoryConnectionStatus = ensureMainConnection(
    workflow,
    FILTER_HISTORY_NODE_NAME,
    PROCESS_HISTORY_NODE_NAME,
  );
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
  let staleOrdersNodeStatus = "skipped-co-only";
  let staleOrdersConnectionStatus = "skipped-co-only";
  let staleOrdersNodeId = null;

  if (workflowTarget.pais === "CO") {
    const dropiLoginFinalNode = findNode(workflow, DROPI_LOGIN_FINAL_NODE_NAME);

    if (!dropiLoginFinalNode) {
      throw new Error(`Node "${DROPI_LOGIN_FINAL_NODE_NAME}" was not found.`);
    }

    const staleOrdersNodeChange = createOrUpdateStaleOrdersNode(
      workflow,
      dropiLoginFinalNode,
      config,
    );

    staleOrdersNodeStatus = staleOrdersNodeChange.status;
    staleOrdersConnectionStatus = ensureMainConnection(
      workflow,
      DROPI_LOGIN_FINAL_NODE_NAME,
      STALE_ORDERS_NODE_NAME,
    );
    staleOrdersNodeId = staleOrdersNodeChange.node.id;
  }

  return {
    nodeStatus: nodeChange.status,
    connectionStatus,
    singleStateConnectionStatus,
    activeOrdersSelectStatus: activeOrdersSelectPatch.reconciliationStatus,
    activeOrdersLatestHistoryStatus: activeOrdersSelectPatch.latestHistoryStatus,
    compareFilterCodeStatus,
    historyFilterNodeStatus: historyFilterNodeChange.status,
    processHistoryNodeStatus: processHistoryNodeChange.status,
    historyFilterConnectionStatus,
    processHistoryConnectionStatus,
    updateOrderJsonBodyStatus,
    registerHistoryJsonBodyStatus: registerHistoryJsonBodyPatch.status,
    registerHistoryJsonBodyBefore: registerHistoryJsonBodyPatch.beforeJsonBody,
    registerHistoryJsonBodyAfter: registerHistoryJsonBodyPatch.afterJsonBody,
    walletMappingNodeStatus: walletMappingNodeChange.status,
    walletInsertNodeStatus: walletInsertNodeChange.status,
    walletInsertOnConflictStatus: walletInsertNodeChange.onConflictStatus,
    walletSourceConnectionStatus,
    walletInsertConnectionStatus,
    staleOrdersNodeStatus,
    staleOrdersConnectionStatus,
    walletInsertUrl: walletInsertNodeChange.node.parameters.url,
    supabaseAuthSourceNodeName: supabaseSourceNode.name,
    retryStyle,
    settingsSummary: getFilteredWorkflowSettings(workflow),
    webhookNodeId: nodeChange.node.id,
    historyFilterNodeId: historyFilterNodeChange.node.id,
    processHistoryNodeId: processHistoryNodeChange.node.id,
    walletMappingNodeId: walletMappingNodeChange.node.id,
    walletInsertNodeId: walletInsertNodeChange.node.id,
    staleOrdersNodeId,
  };
}

function printChangeSummary(workflow, workflowTarget, patchResult, config) {
  console.log(`\n[${workflowTarget.name}] ${workflowTarget.id}`);
  console.log(`Workflow: ${workflow.name ?? "(unnamed)"}`);
  console.log(
    `- "${UPDATE_ORDER_NODE_NAME}" JSON body: ${patchResult.updateOrderJsonBodyStatus}`,
  );
  console.log(
    `- "${REGISTER_HISTORY_NODE_NAME}" JSON body: ${patchResult.registerHistoryJsonBodyStatus}`,
  );
  console.log(`  before:\n${indentBlock(patchResult.registerHistoryJsonBodyBefore)}`);
  console.log(`  after:\n${indentBlock(patchResult.registerHistoryJsonBodyAfter)}`);
  console.log(`- node "${WEBHOOK_NODE_NAME}": ${patchResult.nodeStatus}`);
  console.log(
    `- existing connection "${COMPARE_FILTER_NODE_NAME}" -> "${UPDATE_ORDER_NODE_NAME}": ${patchResult.singleStateConnectionStatus}`,
  );
  console.log(
    `- connection "${UPDATE_ORDER_NODE_NAME}" -> "${WEBHOOK_NODE_NAME}": ${patchResult.connectionStatus}`,
  );
  console.log(
    `- "${ACTIVE_ORDERS_NODE_NAME}" select ${RECONCILIATION_SELECT_COLUMN}: ${patchResult.activeOrdersSelectStatus}`,
  );
  console.log(
    `- "${ACTIVE_ORDERS_NODE_NAME}" latest status_history.registrado_en: ${patchResult.activeOrdersLatestHistoryStatus}`,
  );
  console.log(
    `- "${COMPARE_FILTER_NODE_NAME}" full-history comparison code: ${patchResult.compareFilterCodeStatus}`,
  );
  console.log(
    `- node "${FILTER_HISTORY_NODE_NAME}": ${patchResult.historyFilterNodeStatus}`,
  );
  console.log(
    `- node "${PROCESS_HISTORY_NODE_NAME}": ${patchResult.processHistoryNodeStatus}`,
  );
  console.log(
    `- connection "${COMPARE_FILTER_NODE_NAME}" -> "${FILTER_HISTORY_NODE_NAME}": ${patchResult.historyFilterConnectionStatus}`,
  );
  console.log(
    `- connection "${FILTER_HISTORY_NODE_NAME}" -> "${PROCESS_HISTORY_NODE_NAME}": ${patchResult.processHistoryConnectionStatus}`,
  );
  console.log(
    `- node "${MAP_WALLET_NODE_NAME}": ${patchResult.walletMappingNodeStatus}`,
  );
  console.log(
    `- node "${INSERT_WALLET_NODE_NAME}": ${patchResult.walletInsertNodeStatus}`,
  );
  console.log(
    `- "${INSERT_WALLET_NODE_NAME}" on_conflict param: ${patchResult.walletInsertOnConflictStatus}`,
  );
  console.log(
    `- connection "${DROPI_WALLET_NODE_NAME}" -> "${MAP_WALLET_NODE_NAME}": ${patchResult.walletSourceConnectionStatus}`,
  );
  console.log(
    `- connection "${MAP_WALLET_NODE_NAME}" -> "${INSERT_WALLET_NODE_NAME}": ${patchResult.walletInsertConnectionStatus}`,
  );
  console.log(
    `- node "${STALE_ORDERS_NODE_NAME}" (CO-only): ${patchResult.staleOrdersNodeStatus}`,
  );
  console.log(
    `- connection "${DROPI_LOGIN_FINAL_NODE_NAME}" -> "${STALE_ORDERS_NODE_NAME}" (CO-only): ${patchResult.staleOrdersConnectionStatus}`,
  );
  console.log(`- stale orders cron url: ${STALE_ORDERS_CRON_URL}`);
  console.log("- stale orders Authorization header: Bearer <from CRON_SECRET>");
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
  console.log(`- process-history webhook url: ${config.processHistoryWebhookUrl}`);
  console.log("- process-history x-webhook-secret: <from WEBHOOK_SHARED_SECRET>");
  console.log(`- webhook node id: ${patchResult.webhookNodeId}`);
  console.log(`- history filter node id: ${patchResult.historyFilterNodeId}`);
  console.log(`- process history node id: ${patchResult.processHistoryNodeId}`);
  console.log(`- wallet map node id: ${patchResult.walletMappingNodeId}`);
  console.log(`- wallet insert node id: ${patchResult.walletInsertNodeId}`);
  console.log(
    `- stale orders node id: ${patchResult.staleOrdersNodeId ?? "(not added; CO-only)"}`,
  );
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
