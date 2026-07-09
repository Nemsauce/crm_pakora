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
const ORDERS_PAGE_SIZE = 50;
const WALLET_PAGE_SIZE = 200;
const MAX_WINDOW_SPAN_DAYS = 85;
// Only the LAST computed window uses this dynamic n8n expression for "until",
// evaluated at actual workflow-execution time (not frozen at patch-script-run
// time). Earlier/historical windows keep static "until" dates since those are
// fixed points in the past. Explicitly pinned to America/Bogota to match
// getTodayDateString() below, independent of the n8n instance/workflow
// timezone setting.
const LAST_WINDOW_UNTIL_EXPRESSION =
  "{{ $now.setZone('America/Bogota').toFormat('yyyy-MM-dd') }}";
const DROPI_HISTORICAL_ORDERS_NODE_NAME = "Dropi Consultar Historico";
const DROPI_WALLET_TEMPLATE_NODE_NAME = "Dropi Consultar Wallet";
const DROPI_WALLET_HISTORICAL_NODE_NAME = "Dropi Consultar Wallet Historico";
const PREPARE_HISTORICAL_NODE_NAME = "Preparar datos historico";
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

function getTodayDateString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${byType.year}-${byType.month}-${byType.day}`;
}

function parseDateString(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);

  if (!match) {
    throw new Error(`Invalid date string "${dateString}". Expected YYYY-MM-DD.`);
  }

  const [, year, month, day] = match;

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatDateString(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate;
}

function daysBetween(startDate, endDate) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);
}

function computeDateWindows(fromDateString, toDateString = getTodayDateString()) {
  const finalDate = parseDateString(toDateString);
  let currentDate = parseDateString(fromDateString);

  if (currentDate > finalDate) {
    throw new Error(
      `Historical from date ${fromDateString} is after target date ${toDateString}.`,
    );
  }

  const windows = [];

  while (currentDate <= finalDate) {
    const maxUntilDate = addDays(currentDate, MAX_WINDOW_SPAN_DAYS);
    const untilDate = maxUntilDate < finalDate ? maxUntilDate : finalDate;

    windows.push({
      index: windows.length + 1,
      from: formatDateString(currentDate),
      until: formatDateString(untilDate),
      spanDays: daysBetween(currentDate, untilDate),
    });

    currentDate = addDays(untilDate, 1);
  }

  return windows.map((window, arrayIndex) => {
    const isLastWindow = arrayIndex === windows.length - 1;

    return {
      ...window,
      // "until" stays the static computed date for display/window-math
      // purposes. "untilForUrl" is what actually gets embedded in the n8n
      // node URL: for every window except the last, that's the same static
      // date (its end date is a fixed point in the past). For the last
      // window, it's a live n8n expression so re-running the migration on a
      // future day picks up everything up to that day, without re-patching.
      untilIsDynamic: isLastWindow,
      untilForUrl: isLastWindow ? LAST_WINDOW_UNTIL_EXPRESSION : window.until,
    };
  });
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
  const leadingWhitespace = urlValue.slice(0, urlValue.length - trimmed.length);

  if (!trimmed.includes("{{") && trimmed.startsWith("=")) {
    return `${leadingWhitespace}${trimmed.slice(1)}`;
  }

  if (!trimmed.includes("{{") || trimmed.startsWith("=")) {
    return urlValue;
  }

  return `=${urlValue}`;
}

function patchDropiDateWindowUrl(urlValue, pageSize, fromDate, untilDate) {
  let nextUrl = urlValue;
  nextUrl = setQueryParamRaw(nextUrl, "from", fromDate);
  nextUrl = setQueryParamRaw(nextUrl, "until", untilDate);
  nextUrl = setQueryParamRaw(nextUrl, "result_number", String(pageSize));
  nextUrl = removeQueryParam(nextUrl, "start");
  nextUrl = ensureExpressionUrlPrefix(nextUrl);

  return nextUrl;
}

function getWindowNodeName(baseNodeName, windowIndex) {
  return `${baseNodeName} Ventana ${windowIndex}`;
}

function getWindowIndexFromNodeName(baseNodeName, nodeName) {
  const prefix = `${baseNodeName} Ventana `;

  if (!nodeName.startsWith(prefix)) {
    return undefined;
  }

  const rawIndex = nodeName.slice(prefix.length);

  return /^\d+$/.test(rawIndex) ? Number(rawIndex) : undefined;
}

function findFirstWindowNode(workflow, baseNodeName) {
  return [...workflow.nodes]
    .filter((node) => getWindowIndexFromNodeName(baseNodeName, node.name) !== undefined)
    .sort(
      (left, right) =>
        getWindowIndexFromNodeName(baseNodeName, left.name) -
        getWindowIndexFromNodeName(baseNodeName, right.name),
    )[0];
}

function getStaleWindowNodeNames(workflow, baseNodeName, desiredNodeNames) {
  const desired = new Set(desiredNodeNames);

  return workflow.nodes
    .map((node) => node.name)
    .filter(
      (nodeName) =>
        getWindowIndexFromNodeName(baseNodeName, nodeName) !== undefined &&
        !desired.has(nodeName),
    );
}

function removeNodesAndConnections(workflow, nodeNames) {
  const namesToRemove = new Set(
    nodeNames.filter((nodeName) => workflow.nodes.some((node) => node.name === nodeName)),
  );

  if (namesToRemove.size === 0) {
    return [];
  }

  workflow.nodes = workflow.nodes.filter((node) => !namesToRemove.has(node.name));

  for (const sourceNodeName of Object.keys(workflow.connections ?? {})) {
    if (namesToRemove.has(sourceNodeName)) {
      delete workflow.connections[sourceNodeName];
      continue;
    }

    const mainOutputs = workflow.connections[sourceNodeName]?.main;

    if (!Array.isArray(mainOutputs)) {
      continue;
    }

    for (const outputConnections of mainOutputs) {
      if (!Array.isArray(outputConnections)) {
        continue;
      }

      const keptConnections = outputConnections.filter(
        (connection) => !namesToRemove.has(connection.node),
      );
      outputConnections.splice(0, outputConnections.length, ...keptConnections);
    }
  }

  return [...namesToRemove];
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

function buildDropiWindowParameters(baseNode, pageSize, window) {
  const parameters = clone(baseNode.parameters ?? {});

  parameters.url = patchDropiDateWindowUrl(
    getHttpRequestUrl(baseNode),
    pageSize,
    window.from,
    window.untilForUrl,
  );
  parameters.options ??= {};
  parameters.options.pagination = {
    pagination: buildPagination(pageSize),
  };

  return parameters;
}

function buildDropiWindowNode({
  baseNode,
  sourceNode,
  nodeName,
  pageSize,
  window,
  offsetX,
  offsetY,
}) {
  const node = clone(baseNode);
  node.id = randomUUID();
  node.name = nodeName;
  node.parameters = buildDropiWindowParameters(baseNode, pageSize, window);
  node.position = getPositionNear(sourceNode, offsetX, offsetY);

  return node;
}

function createOrUpdateDropiWindowNode({
  workflow,
  baseNode,
  sourceNode,
  nodeName,
  pageSize,
  window,
  offsetX,
  offsetY,
}) {
  const existingNode = findNode(workflow, nodeName);

  if (!existingNode) {
    const newNode = buildDropiWindowNode({
      baseNode,
      sourceNode,
      nodeName,
      pageSize,
      window,
      offsetX,
      offsetY,
    });
    workflow.nodes.push(newNode);

    return {
      node: newNode,
      status: "added",
      urlStatus: "added",
      paginationStatus: "added",
      url: newNode.parameters.url,
      pagination: newNode.parameters.options.pagination.pagination,
      window,
    };
  }

  if (existingNode.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${nodeName}" exists but is not an HTTP Request node. Found type: ${existingNode.type ?? "(missing)"}.`,
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

  existingNode.parameters = buildDropiWindowParameters(baseNode, pageSize, window);
  applyNodeCredentialsFromSource(existingNode, baseNode);
  applyRetrySettingsFromTemplate(existingNode, baseNode);

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
    window,
  };
}

function createOrUpdateDropiWindowNodes({
  workflow,
  baseNode,
  sourceNode,
  baseNodeName,
  pageSize,
  windows,
  offsetX,
  offsetY,
}) {
  return windows.map((window) =>
    createOrUpdateDropiWindowNode({
      workflow,
      baseNode,
      sourceNode,
      nodeName: getWindowNodeName(baseNodeName, window.index),
      pageSize,
      window,
      offsetX,
      offsetY: offsetY + (window.index - 1) * 180,
    }),
  );
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

function buildPrepareHistoricalCode(pais) {
  return `const orders = [];

function getObjects(payload) {
  if (Array.isArray(payload?.objects)) return payload.objects;
  if (Array.isArray(payload?.data?.objects)) return payload.data.objects;
  if (Array.isArray(payload?.body?.objects)) return payload.body.objects;
  return [];
}

for (const item of $input.all()) {
  orders.push(...getObjects(item.json));
}
const estadosCerrados = ['ENTREGADO', 'CANCELADO', 'DEVOLUCION'];
const estadosNovedad = ['DESTINATARIO SE REHUSA A RECIBIR', 'Se visita, no se logra entrega', 'PARA NUEVO INTENTO ENTREGA', 'EN CONFIRMACIÓN TELEFÓNICA', 'NOVEDAD', 'CERRADO POR INCIDENCIA, VER CAUSA', 'RECLAME EN OFICINA'];
const sanitize = (val) => {
  if (!val) return '';
  return String(val).replace(/[\\x00-\\x1F\\x7F]/g, ' ').trim();
};
const ALEJO_LOCAL_UTC_OFFSET_HOURS = -5;
const ALEJO_LOCAL_UTC_OFFSET_MS = ALEJO_LOCAL_UTC_OFFSET_HOURS * 60 * 60 * 1000;
function getAlejoLocalDateFromDropiCreatedAt(value) {
  if (!value) return null;

  const utcDate = new Date(value);
  if (Number.isNaN(utcDate.getTime())) return null;

  const shiftedDate = new Date(utcDate.getTime() + ALEJO_LOCAL_UTC_OFFSET_MS);
  const year = shiftedDate.getUTCFullYear();
  const month = String(shiftedDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shiftedDate.getUTCDate()).padStart(2, '0');

  return \`\${year}-\${month}-\${day}\`;
}
return orders.map(o => {
  const cerrado = estadosCerrados.includes(o.status);
  const totalPedidos = o.client_total_orders || 0;
  const devoluciones = o.client_total_orders_returneds || 0;
  let nivelRiesgo = 'sin_datos';
  if (totalPedidos > 0) {
    const tasa = devoluciones / totalPedidos;
    if (tasa >= 0.5) nivelRiesgo = 'alto';
    else if (tasa >= 0.25) nivelRiesgo = 'medio';
    else nivelRiesgo = 'bajo';
  }
  let estadoCrm = 'nuevo';
  if (cerrado) {
    if (o.status === 'ENTREGADO') estadoCrm = 'entregado';
    else if ((o.status || '').includes('DEVOLUCION')) estadoCrm = 'devolucion';
    else estadoCrm = 'cancelado';
  } else if (o.shipping_guide) {
    estadoCrm = 'en_ruta';
  }
  let accion = null;
  if (!cerrado) {
    if (o.status === 'GUIA_GENERADA') accion = 'notificar_guia';
    else if (estadosNovedad.includes(o.status)) accion = 'presionar_entrega';
    else if (['PENDIENTE CONFIRMACION', 'PENDIENTE'].includes(o.status)) accion = 'llamar_confirmacion';
  }

  const orderDetail = (o.orderdetails || [])[0] || {};
  const costoProducto = parseFloat(orderDetail.supplier_price || 0);
  const costoEnvio = parseFloat(o.shipping_amount || 0);

  return {
    json: {
      order: {
        id_orden_dropi: o.id,
        id_orden_shopify: o.shop_order_id ? String(o.shop_order_id) : null,
        numero_orden: o.shop_order_number ? '#' + o.shop_order_number : null,
        fecha: getAlejoLocalDateFromDropiCreatedAt(o.created_at),
        nombre: sanitize(o.name),
        apellido: sanitize(o.surname),
        telefono: sanitize(o.phone),
        direccion: sanitize(o.dir),
        ciudad: sanitize(o.city),
        departamento: sanitize(o.state),
        nombre_producto: sanitize((o.orderdetails && o.orderdetails[0] && o.orderdetails[0].product && o.orderdetails[0].product.name) || ''),
        total: parseFloat(o.total_order || 0),
        guia_envio: o.shipping_guide || null,
        transportadora: o.distribution_company?.name || null,
        estado_dropi: o.status,
        estado_crm: estadoCrm,
        activo: !cerrado,
        nivel_riesgo: nivelRiesgo,
        pais: '${pais}',
        total_pedidos_cliente: o.client_total_orders,
        pedidos_entregados_cliente: o.client_total_orders_delivered,
        pedidos_devueltos_cliente: devoluciones,
        costo_producto: costoProducto,
        costo_envio: costoEnvio,
        comision_cod: 0
      },
      history: (o.history || []).map(h => ({
        estado: h.status,
        transportadora: o.distribution_company?.name || null,
        registrado_en: h.created_at
      })),
      accion,
      nombre: sanitize(o.name),
      apellido: sanitize(o.surname),
      telefono: sanitize(o.phone),
      guia: o.shipping_guide,
      transportadora: o.distribution_company?.name || null,
      numero_orden: o.shop_order_number ? '#' + o.shop_order_number : '#' + o.id
    }
  };
});`;
}

function patchPrepareHistoricalNode(workflow, pais) {
  const node = findNode(workflow, PREPARE_HISTORICAL_NODE_NAME);

  if (!node) {
    throw new Error(`Node "${PREPARE_HISTORICAL_NODE_NAME}" was not found.`);
  }

  if (node.type !== "n8n-nodes-base.code") {
    throw new Error(
      `"${PREPARE_HISTORICAL_NODE_NAME}" is not a Code node. Found type: ${node.type ?? "(missing)"}.`,
    );
  }

  const beforeCode = node.parameters?.jsCode;

  if (typeof beforeCode !== "string") {
    throw new Error(`"${PREPARE_HISTORICAL_NODE_NAME}" has no jsCode string.`);
  }

  const nextCode = buildPrepareHistoricalCode(pais);
  node.parameters = {
    ...(node.parameters ?? {}),
    jsCode: nextCode,
  };

  return {
    node,
    status: beforeCode === nextCode ? "confirmed" : "updated",
    beforeJsCode: beforeCode,
    afterJsCode: nextCode,
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

function findMigrationSourceNodeName(workflow) {
  const targetNodeNames = [
    DROPI_HISTORICAL_ORDERS_NODE_NAME,
    getWindowNodeName(DROPI_HISTORICAL_ORDERS_NODE_NAME, 1),
    DROPI_WALLET_HISTORICAL_NODE_NAME,
    getWindowNodeName(DROPI_WALLET_HISTORICAL_NODE_NAME, 1),
  ];

  for (const targetNodeName of targetNodeNames) {
    const sourceNodeName = findSourceNodeNameForTarget(workflow, targetNodeName);

    if (sourceNodeName) {
      return sourceNodeName;
    }
  }

  return findFallbackTriggerNode(workflow)?.name;
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

function patchWorkflow(workflow, templateWorkflow, workflowTarget) {
  if (!Array.isArray(workflow.nodes)) {
    throw new Error("Workflow response does not include a nodes array.");
  }

  if (!Array.isArray(templateWorkflow.nodes)) {
    throw new Error("Template workflow response does not include a nodes array.");
  }

  const historicalOrdersBaseNode =
    findNode(workflow, DROPI_HISTORICAL_ORDERS_NODE_NAME) ??
    findFirstWindowNode(workflow, DROPI_HISTORICAL_ORDERS_NODE_NAME);

  if (!historicalOrdersBaseNode) {
    throw new Error(
      `Node "${DROPI_HISTORICAL_ORDERS_NODE_NAME}" or its windowed replacement was not found.`,
    );
  }

  if (historicalOrdersBaseNode.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${historicalOrdersBaseNode.name}" is not an HTTP Request node. Found type: ${historicalOrdersBaseNode.type ?? "(missing)"}.`,
    );
  }

  const sourceNodeName = findMigrationSourceNodeName(workflow);

  if (!sourceNodeName) {
    throw new Error(
      "Could not find the source/manual trigger node for the migration branches.",
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

  const walletHistoricalBaseNode =
    findNode(workflow, DROPI_WALLET_HISTORICAL_NODE_NAME) ??
    findFirstWindowNode(workflow, DROPI_WALLET_HISTORICAL_NODE_NAME) ??
    templateWalletNode;

  if (walletHistoricalBaseNode.type !== "n8n-nodes-base.httpRequest") {
    throw new Error(
      `"${walletHistoricalBaseNode.name}" is not an HTTP Request node. Found type: ${walletHistoricalBaseNode.type ?? "(missing)"}.`,
    );
  }

  const supabaseSourceNode = findSupabaseRestSourceNode(workflow);

  if (!supabaseSourceNode) {
    throw new Error(
      "No existing Supabase REST HTTP Request node was found to infer URL/auth headers.",
    );
  }

  const windows = computeDateWindows(HISTORY_FROM_DATE);
  const prepareHistoricalPatch = patchPrepareHistoricalNode(workflow, workflowTarget.pais);
  const orderWindowChanges = createOrUpdateDropiWindowNodes({
    workflow,
    baseNode: historicalOrdersBaseNode,
    sourceNode,
    baseNodeName: DROPI_HISTORICAL_ORDERS_NODE_NAME,
    pageSize: ORDERS_PAGE_SIZE,
    windows,
    offsetX: 420,
    offsetY: 0,
  });
  const walletWindowChanges = createOrUpdateDropiWindowNodes({
    workflow,
    baseNode: walletHistoricalBaseNode,
    sourceNode,
    baseNodeName: DROPI_WALLET_HISTORICAL_NODE_NAME,
    pageSize: WALLET_PAGE_SIZE,
    windows,
    offsetX: 780,
    offsetY: -160,
  });
  const walletMappingNodeChange = createOrUpdateWalletMappingNode(
    workflow,
    walletWindowChanges[0].node,
    workflowTarget.pais,
  );
  const walletInsertNodeChange = createOrUpdateWalletInsertNode(
    workflow,
    walletMappingNodeChange.node,
    supabaseSourceNode,
  );
  const orderWindowConnectionStatuses = orderWindowChanges.map((change) => ({
    nodeName: change.node.name,
    sourceConnectionStatus: ensureMainConnection(
      workflow,
      sourceNodeName,
      change.node.name,
    ),
    prepareConnectionStatus: ensureMainConnection(
      workflow,
      change.node.name,
      PREPARE_HISTORICAL_NODE_NAME,
    ),
  }));
  const walletWindowConnectionStatuses = walletWindowChanges.map((change) => ({
    nodeName: change.node.name,
    sourceConnectionStatus: ensureMainConnection(
      workflow,
      sourceNodeName,
      change.node.name,
    ),
    mappingConnectionStatus: ensureMainConnection(
      workflow,
      change.node.name,
      MAP_WALLET_NODE_NAME,
    ),
  }));
  const walletInsertConnectionStatus = ensureMainConnection(
    workflow,
    MAP_WALLET_NODE_NAME,
    INSERT_WALLET_NODE_NAME,
  );
  const desiredOrderWindowNodeNames = windows.map((window) =>
    getWindowNodeName(DROPI_HISTORICAL_ORDERS_NODE_NAME, window.index),
  );
  const desiredWalletWindowNodeNames = windows.map((window) =>
    getWindowNodeName(DROPI_WALLET_HISTORICAL_NODE_NAME, window.index),
  );
  const removedNodeNames = removeNodesAndConnections(workflow, [
    DROPI_HISTORICAL_ORDERS_NODE_NAME,
    DROPI_WALLET_HISTORICAL_NODE_NAME,
    ...getStaleWindowNodeNames(
      workflow,
      DROPI_HISTORICAL_ORDERS_NODE_NAME,
      desiredOrderWindowNodeNames,
    ),
    ...getStaleWindowNodeNames(
      workflow,
      DROPI_WALLET_HISTORICAL_NODE_NAME,
      desiredWalletWindowNodeNames,
    ),
  ]);

  return {
    sourceNodeName,
    windows,
    maxWindowSpanDays: MAX_WINDOW_SPAN_DAYS,
    orderWindowChanges: orderWindowChanges.map((change) => ({
      nodeName: change.node.name,
      status: change.status,
      urlStatus: change.urlStatus,
      paginationStatus: change.paginationStatus,
      url: change.url,
      urlStartsWithEquals: urlStartsWithExpressionPrefix(change.url),
      pagination: change.pagination,
      window: change.window,
      ...orderWindowConnectionStatuses.find(
        (connection) => connection.nodeName === change.node.name,
      ),
    })),
    walletWindowChanges: walletWindowChanges.map((change) => ({
      nodeName: change.node.name,
      status: change.status,
      urlStatus: change.urlStatus,
      paginationStatus: change.paginationStatus,
      url: change.url,
      urlStartsWithEquals: urlStartsWithExpressionPrefix(change.url),
      pagination: change.pagination,
      window: change.window,
      ...walletWindowConnectionStatuses.find(
        (connection) => connection.nodeName === change.node.name,
      ),
    })),
    prepareHistoricalStatus: prepareHistoricalPatch.status,
    prepareHistoricalJsCodeBefore: prepareHistoricalPatch.beforeJsCode,
    prepareHistoricalJsCodeAfter: prepareHistoricalPatch.afterJsCode,
    walletMappingNodeStatus: walletMappingNodeChange.status,
    walletInsertNodeStatus: walletInsertNodeChange.status,
    walletInsertOnConflictStatus: walletInsertNodeChange.onConflictStatus,
    walletInsertUrl: walletInsertNodeChange.node.parameters.url,
    walletInsertConnectionStatus,
    removedNodeNames,
    walletTemplateWorkflowId: workflowTarget.walletTemplateWorkflowId,
    walletTemplateNodeId: templateWalletNode.id,
    walletMappingNodeId: walletMappingNodeChange.node.id,
    walletInsertNodeId: walletInsertNodeChange.node.id,
    supabaseAuthSourceNodeName: supabaseSourceNode.name,
    settingsSummary: getFilteredWorkflowSettings(workflow),
  };
}

function printChangeSummary(workflow, workflowTarget, patchResult) {
  console.log(`\n[${workflowTarget.name}] ${workflowTarget.id}`);
  console.log(`Workflow: ${workflow.name ?? "(unnamed)"}`);
  console.log(`- source/manual branch node: ${patchResult.sourceNodeName}`);
  console.log(
    `- computed windows (${patchResult.windows.length}, max ${patchResult.maxWindowSpanDays} days apart):`,
  );
  for (const window of patchResult.windows) {
    const untilLabel = window.untilIsDynamic
      ? `${window.until} (static reference only — actual "until" is DYNAMIC: ${window.untilForUrl})`
      : window.until;
    console.log(
      `  - Window ${window.index}: ${window.from} to ${untilLabel} (${window.spanDays} days apart)`,
    );
  }
  console.log("- orders historical window nodes:");
  for (const change of patchResult.orderWindowChanges) {
    console.log(
      `  - ${change.nodeName}: node=${change.status}; url=${change.urlStatus}; pagination=${change.paginationStatus}; source->node=${change.sourceConnectionStatus}; node->prep=${change.prepareConnectionStatus}; startsWithEquals=${change.urlStartsWithEquals}`,
    );
    console.log(`    window: ${change.window.from} to ${change.window.until}`);
    console.log(`    url: ${change.url}`);
  }
  console.log("- orders pagination JSON template:");
  console.log(formatPagination(patchResult.orderWindowChanges[0]?.pagination ?? {}));
  console.log(
    `- "${PREPARE_HISTORICAL_NODE_NAME}" patch (input aggregation + costo_producto/costo_envio/comision_cod + fecha UTC-5 for pais=${workflowTarget.pais}): ${patchResult.prepareHistoricalStatus}`,
  );
  console.log(`- "${PREPARE_HISTORICAL_NODE_NAME}" jsCode before:`);
  console.log(patchResult.prepareHistoricalJsCodeBefore);
  console.log(`- "${PREPARE_HISTORICAL_NODE_NAME}" jsCode after:`);
  console.log(patchResult.prepareHistoricalJsCodeAfter);
  console.log("- wallet historical window nodes:");
  for (const change of patchResult.walletWindowChanges) {
    console.log(
      `  - ${change.nodeName}: node=${change.status}; url=${change.urlStatus}; pagination=${change.paginationStatus}; source->node=${change.sourceConnectionStatus}; node->map=${change.mappingConnectionStatus}; startsWithEquals=${change.urlStartsWithEquals}`,
    );
    console.log(`    window: ${change.window.from} to ${change.window.until}`);
    console.log(`    url: ${change.url}`);
  }
  console.log("- wallet pagination JSON template:");
  console.log(formatPagination(patchResult.walletWindowChanges[0]?.pagination ?? {}));
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
    `- connection "${MAP_WALLET_NODE_NAME}" -> "${INSERT_WALLET_NODE_NAME}": ${patchResult.walletInsertConnectionStatus}`,
  );
  console.log(
    `- removed/replaced old single-window nodes: ${formatKeys(patchResult.removedNodeNames)}`,
  );
  console.log(`- wallet pais literal: ${workflowTarget.pais}`);
  console.log(`- wallet template workflow id: ${patchResult.walletTemplateWorkflowId}`);
  console.log(`- wallet template node id: ${patchResult.walletTemplateNodeId}`);
  console.log(
    `- Supabase auth/header source node for wallet insert: ${patchResult.supabaseAuthSourceNodeName}`,
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
