#!/usr/bin/env node

import { randomUUID } from "node:crypto";

const MIGRATION_WORKFLOWS = [
  {
    id: "YrWPu8mLMLCalkFa",
    name: "Dropi migracion (CO)",
    pais: "CO",
    walletTemplateWorkflowId: "9p1gvbDxdYqugkMT",
  },
  {
    id: "EBAU2dcasgMNFHDV",
    name: "Dropi migracion MEX",
    pais: "MX",
    walletTemplateWorkflowId: "BQ7G5rSntIoszmJ3",
  },
];

const HISTORY_FROM_DATE = "2026-03-01";
const DEFAULT_UNTIL_EXPRESSION = "{{ $now.toFormat('yyyy-MM-dd') }}";
const ORDERS_PAGE_SIZE = 50;
const WALLET_PAGE_SIZE = 200;
const DROPI_HISTORICAL_ORDERS_NODE_NAME = "Dropi Consultar Historico";
const DROPI_WALLET_TEMPLATE_NODE_NAME = "Dropi Consultar Wallet";
const DROPI_WALLET_HISTORICAL_NODE_NAME = "Dropi Consultar Wallet Historico";
const MAP_WALLET_NODE_NAME = "Mapear movimientos wallet completo";
const INSERT_WALLET_NODE_NAME = "Insertar movimientos wallet";
const WALLET_ON_CONFLICT_PARAM = "on_conflict=pais,id_movimiento_dropi";
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
    throw new Error(
      "N8N_BASE_URL must be a full URL, for example https://n8n.example.com",
    );
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

function clone(value) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

function getPositionNear(sourceNode, offsetX = 420, offsetY = 150) {
  const [x = 0, y = 0] = Array.isArray(sourceNode.position)
    ? sourceNode.position
    : [0, 0];

  return [x + offsetX, y + offsetY];
}

function getHttpRequestUrl(node) {
  return typeof node?.parameters?.url === "string" ? node.parameters.url : "";
}

function getQueryParamRaw(urlValue, name) {
  if (typeof urlValue !== "string") {
    return undefined;
  }

  const queryStart = urlValue.indexOf("?");

  if (queryStart === -1) {
    return undefined;
  }

  const hashStart = urlValue.indexOf("#", queryStart);
  const query = urlValue.slice(
    queryStart + 1,
    hashStart === -1 ? urlValue.length : hashStart,
  );
  const parts = query.split("&").filter(Boolean);

  for (const part of parts) {
    const [rawKey, ...rawValueParts] = part.split("=");

    if (rawKey === name) {
      return rawValueParts.join("=");
    }
  }

  return undefined;
}

function setQueryParamRaw(urlValue, name, value) {
  if (typeof urlValue !== "string" || urlValue.length === 0) {
    throw new Error("Expected a non-empty URL string.");
  }

  const hashIndex = urlValue.indexOf("#");
  const withoutHash = hashIndex === -1 ? urlValue : urlValue.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : urlValue.slice(hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  const base = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : withoutHash.slice(queryIndex + 1);
  const parts = query ? query.split("&").filter(Boolean) : [];
  const nextPart = `${name}=${value}`;
  const existingIndex = parts.findIndex((part) => part.split("=")[0] === name);

  if (existingIndex >= 0) {
    parts[existingIndex] = nextPart;
  } else {
    parts.push(nextPart);
  }

  return `${base}?${parts.join("&")}${hash}`;
}

function removeQueryParam(urlValue, name) {
  if (typeof urlValue !== "string" || !urlValue.includes("?")) {
    return urlValue;
  }

  const hashIndex = urlValue.indexOf("#");
  const withoutHash = hashIndex === -1 ? urlValue : urlValue.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : urlValue.slice(hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  const base = withoutHash.slice(0, queryIndex);
  const query = withoutHash.slice(queryIndex + 1);
  const parts = query
    .split("&")
    .filter(Boolean)
    .filter((part) => part.split("=")[0] !== name);

  return parts.length > 0 ? `${base}?${parts.join("&")}${hash}` : `${base}${hash}`;
}

function ensureExpressionUrlPrefix(urlValue) {
  if (typeof urlValue !== "string") {
    return urlValue;
  }

  const trimmed = urlValue.trimStart();

  if (!trimmed.includes("{{") || trimmed.startsWith("=")) {
    return urlValue;
  }

  return `=${urlValue}`;
}

function patchDropiDateWindowUrl(urlValue, pageSize, untilExpression) {
  let nextUrl = urlValue;
  nextUrl = setQueryParamRaw(nextUrl, "from", HISTORY_FROM_DATE);
  nextUrl = setQueryParamRaw(nextUrl, "until", untilExpression);
  nextUrl = setQueryParamRaw(nextUrl, "result_number", String(pageSize));
  nextUrl = removeQueryParam(nextUrl, "start");
  nextUrl = ensureExpressionUrlPrefix(nextUrl);

  return nextUrl;
}

function buildPagination(pageSize) {
  return {
    paginationMode: "updateAParameterInEachRequest",
    parameters: {
      parameters: [
        {
          type: "qs",
          name: "start",
          value: `={{ $pageCount * ${pageSize} }}`,
        },
      ],
    },
    paginationCompleteWhen: "other",
    statusCodesWhenComplete: "",
    completeExpression: `={{ !Array.isArray($response.body?.objects) || $response.body.objects.length < ${pageSize} }}`,
    limitPagesFetched: true,
    maxRequests: 100,
    requestInterval: 500,
  };
}

function ensureNativePagination(node, pageSize) {
  if (!node.parameters || typeof node.parameters !== "object") {
    node.parameters = {};
  }

  node.parameters.options ??= {};
  const before = JSON.stringify(node.parameters.options.pagination ?? null);
  node.parameters.options.pagination = {
    pagination: buildPagination(pageSize),
  };
  const after = JSON.stringify(node.parameters.options.pagination);

  return before === after ? "confirmed" : "updated";
}

function patchHistoricalOrdersNode(workflow, untilExpression) {
  const node = findNode(workflow, DROPI_HISTORICAL_ORDERS_NODE_NAME);

  if (!node) {
    throw new Error(`Node "${DROPI_HISTORICAL_ORDERS_NODE_NAME}" was not found.`);
  }

  if (node.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${DROPI_HISTORICAL_ORDERS_NODE_NAME}" is not an HTTP Request node. Found type: ${node.type ?? "(missing)"}.`,
    );
  }

  const beforeUrl = getHttpRequestUrl(node);
  const nextUrl = patchDropiDateWindowUrl(
    beforeUrl,
    ORDERS_PAGE_SIZE,
    untilExpression,
  );
  node.parameters.url = nextUrl;
  const urlStatus = beforeUrl === nextUrl ? "confirmed" : "updated";
  const paginationStatus = ensureNativePagination(node, ORDERS_PAGE_SIZE);

  return {
    node,
    urlStatus,
    paginationStatus,
    url: nextUrl,
    pagination: node.parameters.options.pagination.pagination,
  };
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

function isSupabaseRestNode(node) {
  return (
    node?.type === "n8n-nodes-base.httpRequest" &&
    getHttpRequestUrl(node).includes("/rest/v1/")
  );
}

function findSupabaseRestSourceNode(workflow) {
  const preferredNodeNames = [
    "Insertar orden Supabase",
    "Actualizar orden Supabase",
    "Insertar historial Supabase",
    "Registrar historial",
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

function ensureWalletOnConflictParam(urlValue) {
  if (urlValue.includes("on_conflict=")) {
    return urlValue;
  }

  const separator = urlValue.includes("?") ? "&" : "?";
  return `${urlValue}${separator}${WALLET_ON_CONFLICT_PARAM}`;
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

function applyNodeCredentialsFromSource(targetNode, sourceNode) {
  if (Object.hasOwn(sourceNode, "credentials")) {
    targetNode.credentials = clone(sourceNode.credentials);
    return;
  }

  delete targetNode.credentials;
}

function applyRetrySettingsFromTemplate(targetNode, templateNode) {
  for (const key of ["retryOnFail", "maxTries", "waitBetweenTries"]) {
    if (Object.hasOwn(templateNode, key)) {
      targetNode[key] = clone(templateNode[key]);
    } else {
      delete targetNode[key];
    }
  }

  if (templateNode.parameters?.options) {
    targetNode.parameters ??= {};
    targetNode.parameters.options ??= {};

    for (const key of ["retryOnFail", "maxTries", "waitBetweenTries"]) {
      if (Object.hasOwn(templateNode.parameters.options, key)) {
        targetNode.parameters.options[key] = clone(templateNode.parameters.options[key]);
      } else {
        delete targetNode.parameters.options[key];
      }
    }
  }
}

function buildWalletHistoricalParameters(templateNode, untilExpression) {
  const parameters = clone(templateNode.parameters ?? {});

  parameters.url = patchDropiDateWindowUrl(
    getHttpRequestUrl(templateNode),
    WALLET_PAGE_SIZE,
    untilExpression,
  );
  parameters.options ??= {};
  parameters.options.pagination = {
    pagination: buildPagination(WALLET_PAGE_SIZE),
  };

  return parameters;
}

function buildWalletHistoricalNode(templateNode, sourceNode, untilExpression) {
  const node = clone(templateNode);
  node.id = randomUUID();
  node.name = DROPI_WALLET_HISTORICAL_NODE_NAME;
  node.parameters = buildWalletHistoricalParameters(templateNode, untilExpression);
  node.position = getPositionNear(sourceNode, 420, -160);

  return node;
}

function createOrUpdateWalletHistoricalNode(
  workflow,
  templateNode,
  sourceNode,
  untilExpression,
) {
  const existingNode = findNode(workflow, DROPI_WALLET_HISTORICAL_NODE_NAME);

  if (!existingNode) {
    const newNode = buildWalletHistoricalNode(templateNode, sourceNode, untilExpression);
    workflow.nodes.push(newNode);

    return {
      node: newNode,
      status: "added",
      urlStatus: "added",
      paginationStatus: "added",
      url: newNode.parameters.url,
      pagination: newNode.parameters.options.pagination.pagination,
    };
  }

  if (existingNode.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${DROPI_WALLET_HISTORICAL_NODE_NAME}" exists but is not an HTTP Request node. Found type: ${existingNode.type ?? "(missing)"}.`,
    );
  }

  const before = JSON.stringify({
    parameters: existingNode.parameters,
    credentials: existingNode.credentials,
    retryOnFail: existingNode.retryOnFail,
    maxTries: existingNode.maxTries,
    waitBetweenTries: existingNode.waitBetweenTries,
  });
  const beforeUrl = getHttpRequestUrl(existingNode);
  const beforePagination = JSON.stringify(
    existingNode.parameters?.options?.pagination ?? null,
  );

  existingNode.parameters = buildWalletHistoricalParameters(
    templateNode,
    untilExpression,
  );
  applyNodeCredentialsFromSource(existingNode, templateNode);
  applyRetrySettingsFromTemplate(existingNode, templateNode);

  const after = JSON.stringify({
    parameters: existingNode.parameters,
    credentials: existingNode.credentials,
    retryOnFail: existingNode.retryOnFail,
    maxTries: existingNode.maxTries,
    waitBetweenTries: existingNode.waitBetweenTries,
  });
  const afterPagination = JSON.stringify(
    existingNode.parameters?.options?.pagination ?? null,
  );

  return {
    node: existingNode,
    status: before === after ? "confirmed" : "updated",
    urlStatus: beforeUrl === existingNode.parameters.url ? "confirmed" : "updated",
    paginationStatus: beforePagination === afterPagination ? "confirmed" : "updated",
    url: existingNode.parameters.url,
    pagination: existingNode.parameters.options.pagination.pagination,
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

function buildWalletInsertNode(walletMappingNode, supabaseSourceNode) {
  const node = {
    parameters: buildWalletInsertParameters(supabaseSourceNode),
    id: randomUUID(),
    name: INSERT_WALLET_NODE_NAME,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.4,
    position: getPositionNear(walletMappingNode),
  };

  applyNodeCredentialsFromSource(node, supabaseSourceNode);

  return node;
}

function createOrUpdateWalletInsertNode(workflow, walletMappingNode, supabaseSourceNode) {
  const existingNode = findNode(workflow, INSERT_WALLET_NODE_NAME);

  if (!existingNode) {
    const newNode = buildWalletInsertNode(walletMappingNode, supabaseSourceNode);
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
  });
  const onConflictStatus = getHttpRequestUrl(existingNode).includes("on_conflict=")
    ? "confirmed"
    : "added";

  existingNode.parameters = buildWalletInsertParameters(supabaseSourceNode);
  applyNodeCredentialsFromSource(existingNode, supabaseSourceNode);

  const after = JSON.stringify({
    parameters: existingNode.parameters,
    credentials: existingNode.credentials,
  });

  return {
    node: existingNode,
    status: before === after ? "confirmed" : "updated",
    onConflictStatus,
  };
}

function findSourceNodeNameForTarget(workflow, targetNodeName) {
  const connections = workflow.connections ?? {};

  for (const [sourceNodeName, connectionGroups] of Object.entries(connections)) {
    const mainOutputs = connectionGroups?.main;

    if (!Array.isArray(mainOutputs)) {
      continue;
    }

    for (const outputConnections of mainOutputs) {
      if (!Array.isArray(outputConnections)) {
        continue;
      }

      if (outputConnections.some((connection) => connection.node === targetNodeName)) {
        return sourceNodeName;
      }
    }
  }

  return undefined;
}

function findFallbackTriggerNode(workflow) {
  return workflow.nodes.find((node) => {
    const type = node.type ?? "";
    const name = node.name ?? "";

    return (
      type === "n8n-nodes-base.manualTrigger" ||
      type.endsWith(".manualTrigger") ||
      type.includes("Trigger") ||
      /manual|trigger|inicio/i.test(name)
    );
  });
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

function formatPagination(pagination) {
  return JSON.stringify(pagination, null, 2);
}

function urlStartsWithExpressionPrefix(urlValue) {
  return typeof urlValue === "string" && urlValue.trimStart().startsWith("=");
}

function getUntilExpressionFromTemplate(templateWalletNode) {
  return (
    getQueryParamRaw(getHttpRequestUrl(templateWalletNode), "until") ??
    DEFAULT_UNTIL_EXPRESSION
  );
}

function patchWorkflow(workflow, templateWorkflow, workflowTarget) {
  if (!Array.isArray(workflow.nodes)) {
    throw new Error("Workflow response does not include a nodes array.");
  }

  if (!Array.isArray(templateWorkflow.nodes)) {
    throw new Error("Template workflow response does not include a nodes array.");
  }

  const historicalOrdersNode = findNode(workflow, DROPI_HISTORICAL_ORDERS_NODE_NAME);

  if (!historicalOrdersNode) {
    throw new Error(`Node "${DROPI_HISTORICAL_ORDERS_NODE_NAME}" was not found.`);
  }

  const sourceNodeName =
    findSourceNodeNameForTarget(workflow, DROPI_HISTORICAL_ORDERS_NODE_NAME) ??
    findFallbackTriggerNode(workflow)?.name;

  if (!sourceNodeName) {
    throw new Error(
      `Could not find the source/manual trigger node for "${DROPI_HISTORICAL_ORDERS_NODE_NAME}".`,
    );
  }

  const sourceNode = findNode(workflow, sourceNodeName);
  const templateWalletNode = findNode(
    templateWorkflow,
    DROPI_WALLET_TEMPLATE_NODE_NAME,
  );

  if (!templateWalletNode) {
    throw new Error(
      `Template node "${DROPI_WALLET_TEMPLATE_NODE_NAME}" was not found in workflow ${workflowTarget.walletTemplateWorkflowId}.`,
    );
  }

  if (templateWalletNode.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${DROPI_WALLET_TEMPLATE_NODE_NAME}" template is not an HTTP Request node. Found type: ${templateWalletNode.type ?? "(missing)"}.`,
    );
  }

  const supabaseSourceNode = findSupabaseRestSourceNode(workflow);

  if (!supabaseSourceNode) {
    throw new Error(
      "No existing Supabase REST HTTP Request node was found to infer URL/auth headers.",
    );
  }

  const untilExpression = getUntilExpressionFromTemplate(templateWalletNode);
  const historicalOrdersPatch = patchHistoricalOrdersNode(workflow, untilExpression);
  const walletHistoricalNodeChange = createOrUpdateWalletHistoricalNode(
    workflow,
    templateWalletNode,
    sourceNode,
    untilExpression,
  );
  const walletMappingNodeChange = createOrUpdateWalletMappingNode(
    workflow,
    walletHistoricalNodeChange.node,
    workflowTarget.pais,
  );
  const walletInsertNodeChange = createOrUpdateWalletInsertNode(
    workflow,
    walletMappingNodeChange.node,
    supabaseSourceNode,
  );
  const walletSourceConnectionStatus = ensureMainConnection(
    workflow,
    sourceNodeName,
    DROPI_WALLET_HISTORICAL_NODE_NAME,
  );
  const walletMappingConnectionStatus = ensureMainConnection(
    workflow,
    DROPI_WALLET_HISTORICAL_NODE_NAME,
    MAP_WALLET_NODE_NAME,
  );
  const walletInsertConnectionStatus = ensureMainConnection(
    workflow,
    MAP_WALLET_NODE_NAME,
    INSERT_WALLET_NODE_NAME,
  );

  return {
    sourceNodeName,
    historicalOrdersUrlStatus: historicalOrdersPatch.urlStatus,
    historicalOrdersPaginationStatus: historicalOrdersPatch.paginationStatus,
    historicalOrdersUrl: historicalOrdersPatch.url,
    historicalOrdersUrlStartsWithEquals: urlStartsWithExpressionPrefix(
      historicalOrdersPatch.url,
    ),
    historicalOrdersPagination: historicalOrdersPatch.pagination,
    walletHistoricalNodeStatus: walletHistoricalNodeChange.status,
    walletHistoricalUrlStatus: walletHistoricalNodeChange.urlStatus,
    walletHistoricalPaginationStatus: walletHistoricalNodeChange.paginationStatus,
    walletHistoricalUrl: walletHistoricalNodeChange.url,
    walletHistoricalUrlStartsWithEquals: urlStartsWithExpressionPrefix(
      walletHistoricalNodeChange.url,
    ),
    walletHistoricalPagination: walletHistoricalNodeChange.pagination,
    walletMappingNodeStatus: walletMappingNodeChange.status,
    walletInsertNodeStatus: walletInsertNodeChange.status,
    walletInsertOnConflictStatus: walletInsertNodeChange.onConflictStatus,
    walletInsertUrl: walletInsertNodeChange.node.parameters.url,
    walletSourceConnectionStatus,
    walletMappingConnectionStatus,
    walletInsertConnectionStatus,
    walletTemplateWorkflowId: workflowTarget.walletTemplateWorkflowId,
    walletTemplateNodeId: templateWalletNode.id,
    walletHistoricalNodeId: walletHistoricalNodeChange.node.id,
    walletMappingNodeId: walletMappingNodeChange.node.id,
    walletInsertNodeId: walletInsertNodeChange.node.id,
    supabaseAuthSourceNodeName: supabaseSourceNode.name,
    untilExpression,
    settingsSummary: getFilteredWorkflowSettings(workflow),
  };
}

function printChangeSummary(workflow, workflowTarget, patchResult) {
  console.log(`\n[${workflowTarget.name}] ${workflowTarget.id}`);
  console.log(`Workflow: ${workflow.name ?? "(unnamed)"}`);
  console.log(`- source/manual branch node: ${patchResult.sourceNodeName}`);
  console.log(
    `- "${DROPI_HISTORICAL_ORDERS_NODE_NAME}" date/result URL: ${patchResult.historicalOrdersUrlStatus}`,
  );
  console.log(
    `- "${DROPI_HISTORICAL_ORDERS_NODE_NAME}" native pagination: ${patchResult.historicalOrdersPaginationStatus}`,
  );
  console.log(`- orders historical url: ${patchResult.historicalOrdersUrl}`);
  console.log(
    `- orders historical url starts with '=': ${patchResult.historicalOrdersUrlStartsWithEquals}`,
  );
  console.log("- orders pagination JSON:");
  console.log(formatPagination(patchResult.historicalOrdersPagination));
  console.log(
    `- node "${DROPI_WALLET_HISTORICAL_NODE_NAME}": ${patchResult.walletHistoricalNodeStatus}`,
  );
  console.log(
    `- "${DROPI_WALLET_HISTORICAL_NODE_NAME}" date/result URL: ${patchResult.walletHistoricalUrlStatus}`,
  );
  console.log(
    `- "${DROPI_WALLET_HISTORICAL_NODE_NAME}" native pagination: ${patchResult.walletHistoricalPaginationStatus}`,
  );
  console.log(`- wallet historical url: ${patchResult.walletHistoricalUrl}`);
  console.log(
    `- wallet historical url starts with '=': ${patchResult.walletHistoricalUrlStartsWithEquals}`,
  );
  console.log("- wallet pagination JSON:");
  console.log(formatPagination(patchResult.walletHistoricalPagination));
  console.log(
    `- node "${MAP_WALLET_NODE_NAME}": ${patchResult.walletMappingNodeStatus}`,
  );
  console.log(
    `- node "${INSERT_WALLET_NODE_NAME}": ${patchResult.walletInsertNodeStatus}`,
  );
  console.log(
    `- "${INSERT_WALLET_NODE_NAME}" on_conflict param: ${patchResult.walletInsertOnConflictStatus}`,
  );
  console.log(`- wallet insert url: ${patchResult.walletInsertUrl}`);
  console.log(
    `- connection "${patchResult.sourceNodeName}" -> "${DROPI_WALLET_HISTORICAL_NODE_NAME}": ${patchResult.walletSourceConnectionStatus}`,
  );
  console.log(
    `- connection "${DROPI_WALLET_HISTORICAL_NODE_NAME}" -> "${MAP_WALLET_NODE_NAME}": ${patchResult.walletMappingConnectionStatus}`,
  );
  console.log(
    `- connection "${MAP_WALLET_NODE_NAME}" -> "${INSERT_WALLET_NODE_NAME}": ${patchResult.walletInsertConnectionStatus}`,
  );
  console.log(`- wallet pais literal: ${workflowTarget.pais}`);
  console.log(`- wallet template workflow id: ${patchResult.walletTemplateWorkflowId}`);
  console.log(`- wallet template node id: ${patchResult.walletTemplateNodeId}`);
  console.log(
    `- Supabase auth/header source node for wallet insert: ${patchResult.supabaseAuthSourceNodeName}`,
  );
  console.log(`- until expression: ${patchResult.untilExpression}`);
  console.log(
    `- workflow.settings keys returned: ${formatKeys(patchResult.settingsSummary.presentKeys)}`,
  );
  console.log(
    `- workflow.settings keys sent: ${formatKeys(patchResult.settingsSummary.keptKeys)}`,
  );
  console.log(
    `- workflow.settings keys dropped: ${formatKeys(patchResult.settingsSummary.droppedKeys)}`,
  );
  console.log(`- wallet historical node id: ${patchResult.walletHistoricalNodeId}`);
  console.log(`- wallet map node id: ${patchResult.walletMappingNodeId}`);
  console.log(`- wallet insert node id: ${patchResult.walletInsertNodeId}`);
}

async function processWorkflow(workflowTarget, config, confirm) {
  const url = workflowUrl(config, workflowTarget.id);
  const templateUrl = workflowUrl(config, workflowTarget.walletTemplateWorkflowId);
  console.log(`\nGET ${url}`);
  const workflow = await requestJson(url, config);
  console.log(`GET ${templateUrl} (wallet template only)`);
  const templateWorkflow = await requestJson(templateUrl, config);
  const patchResult = patchWorkflow(workflow, templateWorkflow, workflowTarget);

  printChangeSummary(workflow, workflowTarget, patchResult);

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
  console.log(`Target migration date window: ${HISTORY_FROM_DATE} -> today`);

  for (const workflowTarget of MIGRATION_WORKFLOWS) {
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
