/**
 * Deterministic scenario manifest for future staging seeds.
 *
 * The exported `*Scenario*` helpers are internal-consistency oracles. They do
 * not prove that private UI formulas, database RPCs, or status queries behave
 * the same way in production. Product parity is asserted separately wherever
 * a real pure production function is already available.
 */
const TIME_ZONE = "America/Bogota";
const CONTRACT_VERSION = "crm-pakora-v4-fixtures-v1";
const DAY_MS = 24 * 60 * 60 * 1_000;
const OPEN_TASK_STATES = new Set(["pendiente", "en_progreso"]);
const STREET_MONEY_EXCLUDED_CATEGORIES = new Set([
  "nuevo",
  "entregado",
  "cancelado",
  "devolucion",
]);
const CRM_STATES = ["nuevo", "en_ruta", "entregado", "cancelado", "devolucion"];
const STATUS_CATEGORIES = [
  "nuevo",
  "confirmado",
  "guia_generada",
  "en_ruta",
  "novedad",
  "proximo_a_llegar",
  "entregado",
  "cancelado",
  "devolucion",
  "sin_clasificar",
  "en_reparto",
  "recoger_oficina",
  "intento_fallido",
];
const TASK_TYPES = [
  "llamar_confirmacion",
  "notificar_guia",
  "presionar_entrega",
  "notificar_proximo_llegar",
  "resolver_novedad",
];
const TASK_STATES = ["pendiente", "en_progreso", "completada", "cancelada"];
const NOTIFICATION_TYPES = [
  "tarea_urgente_asignada",
  "tarea_vencida",
  "pedido_nuevo",
  "novedad",
  "pedido_entregado",
  "pedido_devolucion",
  "pedido_en_reparto",
];
const ABANDONED_STATES = ["nuevo", "contactado", "recuperado", "descartado"];
export const TASK_RESULT_OPTIONS_SCENARIO = Object.freeze({
  llamar_confirmacion: Object.freeze([
    "Confirmado",
    "No contesta / no se pudo comunicar",
    "Cliente pidió cambios (dirección/producto)",
    "Cliente canceló",
    "Número equivocado",
    "Mensaje enviado, esperando respuesta",
  ]),
  notificar_guia: Object.freeze([
    "Notificado exitosamente",
    "No se pudo contactar",
  ]),
  presionar_entrega: Object.freeze(["Notificado"]),
  notificar_proximo_llegar: Object.freeze(["Notificado exitosamente"]),
  resolver_novedad: Object.freeze([
    "Novedad resuelta",
    "Cliente decidió cancelar",
    "Devolución",
    "Escalado a transportadora/Dropi",
    "Esperando respuesta de cliente",
  ]),
});

const zonedPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
}

function parseAnchor(anchor) {
  const parsed = anchor instanceof Date ? new Date(anchor) : new Date(anchor);
  if (!Number.isFinite(parsed.getTime())) {
    throw new TypeError("Fixture anchor must be a valid Date, ISO string, or epoch value.");
  }
  return parsed;
}

function getZonedParts(value) {
  const entries = zonedPartsFormatter
    .formatToParts(value)
    .filter(({ type }) => type !== "literal")
    .map(({ type, value: partValue }) => [type, Number(partValue)]);
  return Object.fromEntries(entries);
}

function getOffsetAt(timestamp) {
  const date = new Date(timestamp);
  const parts = getZonedParts(date);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - Math.floor(timestamp / 1_000) * 1_000;
}

function zonedDateTimeToUtc(parts) {
  const base = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
    parts.millisecond ?? 0,
  );
  let result = base - getOffsetAt(base);
  result = base - getOffsetAt(result);
  return new Date(result);
}

function localDayStart(value, dayOffset = 0) {
  const parts = getZonedParts(value);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  return zonedDateTimeToUtc({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

function localDateKey(value) {
  const parts = getZonedParts(value);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function isoAt(base, offsetMilliseconds = 0) {
  return new Date(base.getTime() + offsetMilliseconds).toISOString();
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer.`);
  }
  return value;
}

export function calculateDropiHistoryScenario(history) {
  const total = history?.totalOrders ?? null;
  if (total === null) {
    return Object.freeze({
      hasHistory: false,
      totalOrders: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      otherOrders: 0,
      returnRate: null,
      risk: "sin_datos",
    });
  }

  const totalOrders = requireNonNegativeInteger(total, "totalOrders");
  const deliveredOrders = requireNonNegativeInteger(
    history.deliveredOrders ?? 0,
    "deliveredOrders",
  );
  const returnedOrders = requireNonNegativeInteger(
    history.returnedOrders ?? 0,
    "returnedOrders",
  );
  const otherOrders = totalOrders - deliveredOrders - returnedOrders;
  if (otherOrders < 0) {
    throw new RangeError("Dropi delivered and returned orders cannot exceed total orders.");
  }

  const returnRate = totalOrders === 0 ? 0 : returnedOrders / totalOrders;
  const risk =
    totalOrders === 0
      ? "sin_datos"
      : returnRate >= 0.5
        ? "alto"
        : returnRate >= 0.25
          ? "medio"
          : "bajo";

  return Object.freeze({
    hasHistory: true,
    totalOrders,
    deliveredOrders,
    returnedOrders,
    otherOrders,
    returnRate,
    risk,
  });
}

export function resolveStatusCategoryScenario(
  catalog,
  estado,
  transportadora = null,
) {
  if (!estado) {
    return "sin_clasificar";
  }

  const activeRows = Array.isArray(catalog)
    ? catalog.filter((row) => row?.active !== false && row?.estado === estado)
    : [];
  if (transportadora) {
    const specific = activeRows.find((row) => row.transportadora === transportadora);
    if (specific) {
      return specific.category;
    }
  }
  return activeRows.find((row) => row.transportadora === null)?.category ?? "sin_clasificar";
}

/**
 * Mirrors the exact status/category join used by dinero_en_la_calle. Unlike
 * the operational status resolver above, this intentionally has no generic
 * carrier fallback: the RPC joins the order and catalog carrier exactly,
 * including null-to-null.
 */
export function calculateStreetMoneyScenario(orders, catalog) {
  const groups = new Map();

  for (const order of orders) {
    const currentStatus = order?.currentStatus;
    const exactCatalogRow = catalog.find(
      (row) =>
        row?.active !== false &&
        row?.estado === currentStatus?.estado &&
        row?.transportadora === currentStatus?.transportadora,
    );

    if (
      !exactCatalogRow ||
      STREET_MONEY_EXCLUDED_CATEGORIES.has(exactCatalogRow.category)
    ) {
      continue;
    }

    if (!Number.isFinite(order.expectedProfit)) {
      throw new RangeError(
        `Street-money order ${order.key} must declare a finite expected profit.`,
      );
    }

    const groupKey = `${order.country}\u0000${order.productKey}`;
    const currentGroup = groups.get(groupKey) ?? {
      country: order.country,
      productKey: order.productKey,
      pendingOrders: 0,
      amount: 0,
    };
    currentGroup.pendingOrders += 1;
    currentGroup.amount += order.expectedProfit;
    groups.set(groupKey, currentGroup);
  }

  return Object.freeze(
    [...groups.values()]
      .sort(
        (left, right) =>
          left.country.localeCompare(right.country, "en") ||
          left.productKey.localeCompare(right.productKey, "en"),
      )
      .map((row) => Object.freeze(row)),
  );
}

export function calculateWalletScenarioTotals(movements, catalog, period) {
  const categoryByCode = new Map(catalog.map((row) => [row.identificationCode, row.category]));
  const from = new Date(period.from).getTime();
  const toExclusive = new Date(period.toExclusive).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(toExclusive) || from >= toExclusive) {
    throw new RangeError("Wallet period must have valid ascending boundaries.");
  }

  const totals = {
    CO: {
      operationalEntries: 0,
      operationalExits: 0,
      operationalNet: 0,
      topUps: 0,
      withdrawals: 0,
    },
    MX: {
      operationalEntries: 0,
      operationalExits: 0,
      operationalNet: 0,
      topUps: 0,
      withdrawals: 0,
    },
  };

  for (const movement of movements) {
    const occurredAt = new Date(movement.occurredAt).getTime();
    if (occurredAt < from || occurredAt >= toExclusive) {
      continue;
    }
    if (!(movement.country in totals)) {
      throw new RangeError(`Unsupported wallet country: ${movement.country}`);
    }
    if (!Number.isFinite(movement.amount) || movement.amount < 0) {
      throw new RangeError(`Invalid wallet amount for ${movement.key}.`);
    }
    const category = categoryByCode.get(movement.identificationCode);
    if (!category) {
      throw new RangeError(`Unknown wallet identification code: ${movement.identificationCode}`);
    }
    const countryTotals = totals[movement.country];
    if (category === "recarga") {
      countryTotals.topUps += movement.amount;
    } else if (category === "retiro") {
      countryTotals.withdrawals += movement.amount;
    } else if (movement.direction === "ENTRADA") {
      countryTotals.operationalEntries += movement.amount;
    } else if (movement.direction === "SALIDA") {
      countryTotals.operationalExits += movement.amount;
    } else {
      throw new RangeError(`Unsupported wallet direction for ${movement.key}.`);
    }
  }

  for (const countryTotals of Object.values(totals)) {
    countryTotals.operationalNet =
      countryTotals.operationalEntries - countryTotals.operationalExits;
    Object.freeze(countryTotals);
  }
  return Object.freeze(totals);
}

export function calculateCosteoScenarioMetrics(input) {
  const numericFields = [
    "supplierPrice",
    "baseShipping",
    "effectivenessRate",
    "administrativeCosts",
    "fulfillment",
    "adCpa",
    "cancellationRate",
    "salePrice",
  ];
  for (const field of numericFields) {
    if (!Number.isFinite(input?.[field])) {
      throw new RangeError(`${field} must be finite.`);
    }
  }
  if (input.effectivenessRate <= 0 || input.effectivenessRate > 1) {
    throw new RangeError("effectivenessRate must be greater than zero and at most one.");
  }
  if (input.cancellationRate < 0 || input.cancellationRate >= 1) {
    throw new RangeError("cancellationRate must be at least zero and below one.");
  }
  if (input.adCpa <= 0) {
    throw new RangeError("adCpa must be greater than zero for deterministic projections.");
  }

  const adjustedShipping = input.baseShipping / input.effectivenessRate;
  const adjustedCpa =
    input.adCpa / (input.effectivenessRate * (1 - input.cancellationRate));
  const totalCosts =
    input.supplierPrice +
    adjustedShipping +
    input.administrativeCosts +
    input.fulfillment +
    adjustedCpa;
  const deliveredOrderProfit = input.salePrice - totalCosts;
  const averageShopifyOrderProfit =
    deliveredOrderProfit * input.effectivenessRate * (1 - input.cancellationRate);
  const breakEvenCpa = input.adCpa + averageShopifyOrderProfit;
  const roas = deliveredOrderProfit / adjustedCpa + 1;
  const discountRate = input.discountRate ?? 0;
  const comparisonPrice =
    discountRate <= 0 ? input.salePrice : input.salePrice / (1 - discountRate);

  let projection = null;
  if (input.adSpend !== null && input.adSpend !== undefined) {
    if (!Number.isFinite(input.adSpend) || input.adSpend < 0) {
      throw new RangeError("adSpend must be null or a non-negative finite number.");
    }
    const totalOrders = input.adSpend / input.adCpa;
    const dispatchedOrders = totalOrders * (1 - input.cancellationRate);
    const deliveredOrders = dispatchedOrders * input.effectivenessRate;
    const billedValue = totalOrders * input.salePrice;
    const dispatchedValue = dispatchedOrders * input.salePrice;
    const deliveredValue = deliveredOrders * input.salePrice;
    const netProfit = deliveredValue - deliveredOrders * totalCosts;
    projection = Object.freeze({
      totalOrders,
      billedValue,
      dispatchedOrders,
      dispatchedValue,
      deliveredOrders,
      deliveredValue,
      netProfit,
      realCpa: deliveredOrders === 0 ? null : input.adSpend / deliveredOrders,
      realCpaRate: deliveredValue === 0 ? null : input.adSpend / deliveredValue,
    });
  }

  return Object.freeze({
    adjustedShipping,
    adjustedCpa,
    totalCosts,
    deliveredOrderProfit,
    averageShopifyOrderProfit,
    breakEvenCpa,
    roas,
    comparisonPrice,
    projection,
  });
}

export function classifyTaskTimeScenario(task, anchor, timeZone = TIME_ZONE) {
  if (timeZone !== TIME_ZONE) {
    throw new RangeError(`Fixture contract only supports ${TIME_ZONE}.`);
  }
  const now = parseAnchor(anchor);
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const snoozedUntil = task.snoozedUntil ? new Date(task.snoozedUntil) : null;
  const isOpen = OPEN_TASK_STATES.has(task.state);
  const isActivelySnoozed =
    isOpen && snoozedUntil !== null && snoozedUntil.getTime() > now.getTime();
  const actionable = isOpen && !isActivelySnoozed;
  return Object.freeze({
    isOpen,
    isActivelySnoozed,
    isOverdue:
      actionable && deadline !== null && deadline.getTime() < now.getTime(),
    isToday:
      actionable &&
      deadline !== null &&
      localDateKey(deadline) === localDateKey(now),
    isFuture:
      actionable &&
      deadline !== null &&
      deadline.getTime() >= localDayStart(now, 1).getTime(),
    isCompleted: task.state === "completada",
    isUnassigned: task.assigneeKey === null,
  });
}

function orderFixtures(dayStart) {
  return [
    {
      key: "FX-ORD-CO-1007-DROPI",
      adapterNaturalKey: "e2e:order:co:1007",
      numeroOrden: "#1007",
      country: "CO",
      crmState: "nuevo",
      active: true,
      expectedRisk: "alto",
      history: { totalOrders: 118, deliveredOrders: 39, returnedOrders: 78 },
      currentStatus: {
        estado: "E2E ESTADO CONFIRMADO",
        transportadora: "E2E Carrier",
        expectedCategory: "confirmado",
      },
      customer: { name: "María", surname: "Control", phone: "3005551007" },
      logistics: {
        address: "Calle 100 # 7-18",
        city: "Bogotá",
        guide: "E2E-GUIA-1007",
        carrier: "E2E Carrier",
      },
      productKey: "FX-PROD-METRICS-CO",
      expectedProfit: 80_000,
      orderDate: localDateKey(dayStart),
    },
    {
      key: "FX-ORD-CO-MEDIUM",
      adapterNaturalKey: "e2e:order:co:medium",
      numeroOrden: "#E2E-CO-MEDIUM",
      country: "CO",
      crmState: "en_ruta",
      active: true,
      expectedRisk: "medio",
      history: { totalOrders: 20, deliveredOrders: 10, returnedOrders: 6 },
      currentStatus: {
        estado: "E2E EN RUTA",
        transportadora: null,
        expectedCategory: "en_ruta",
      },
      customer: { name: "Camilo", surname: "Riesgo", phone: "3015552001" },
      logistics: { address: "Carrera 20 # 10-40", city: "Cali", guide: null, carrier: null },
      productKey: "FX-PROD-METRICS-CO",
      expectedProfit: 70_000,
      orderDate: localDateKey(dayStart),
    },
    {
      key: "FX-ORD-MX-LOW",
      adapterNaturalKey: "e2e:order:mx:low",
      numeroOrden: "#E2E-MX-LOW",
      country: "MX",
      crmState: "entregado",
      active: false,
      expectedRisk: "bajo",
      history: { totalOrders: 20, deliveredOrders: 18, returnedOrders: 1 },
      currentStatus: {
        estado: "E2E ENTREGADO",
        transportadora: "E2E Carrier MX",
        expectedCategory: "entregado",
      },
      customer: { name: "Lucía", surname: "Entrega", phone: "3005551007" },
      logistics: { address: "Av. Reforma 100", city: "CDMX", guide: "E2E-MX-LOW", carrier: "E2E Carrier MX" },
      productKey: "FX-PROD-METRICS-MX",
      expectedProfit: 700,
      orderDate: localDateKey(localDayStart(dayStart, -1)),
    },
    {
      key: "FX-ORD-MX-STREET",
      adapterNaturalKey: "e2e:order:mx:street",
      numeroOrden: "#E2E-MX-STREET",
      country: "MX",
      crmState: "en_ruta",
      active: true,
      expectedRisk: "bajo",
      history: { totalOrders: 10, deliveredOrders: 8, returnedOrders: 1 },
      currentStatus: {
        estado: "E2E GUIA GENERADA",
        transportadora: null,
        expectedCategory: "guia_generada",
      },
      customer: { name: "Sofía", surname: "En Ruta", phone: "5515550700" },
      logistics: {
        address: "Av. Insurgentes 700",
        city: "CDMX",
        guide: "E2E-MX-STREET",
        carrier: null,
      },
      productKey: "FX-PROD-METRICS-MX",
      expectedProfit: 700,
      orderDate: localDateKey(dayStart),
    },
    {
      key: "FX-ORD-MX-HISTORY-NULL",
      adapterNaturalKey: "e2e:order:mx:null-history",
      numeroOrden: "#E2E-MX-NULL",
      country: "MX",
      crmState: "cancelado",
      active: false,
      expectedRisk: "sin_datos",
      history: { totalOrders: null, deliveredOrders: null, returnedOrders: null },
      currentStatus: {
        estado: "E2E CANCELADO",
        transportadora: null,
        expectedCategory: "cancelado",
      },
      customer: { name: "Cliente", surname: "Antiguo", phone: null },
      logistics: { address: null, city: null, guide: null, carrier: null },
      productKey: "FX-PROD-METRICS-MX",
      expectedProfit: null,
      orderDate: localDateKey(localDayStart(dayStart, -2)),
    },
    {
      key: "FX-ORD-CO-HISTORY-ZERO",
      adapterNaturalKey: "e2e:order:co:zero-history",
      numeroOrden: "#E2E-CO-ZERO",
      country: "CO",
      crmState: "devolucion",
      active: false,
      expectedRisk: "sin_datos",
      history: { totalOrders: 0, deliveredOrders: 0, returnedOrders: 0 },
      currentStatus: {
        estado: "E2E DEVOLUCION",
        transportadora: "E2E Carrier",
        expectedCategory: "devolucion",
      },
      customer: { name: null, surname: null, phone: "3025550000" },
      logistics: { address: null, city: "Medellín", guide: "E2E-ZERO", carrier: "E2E Carrier" },
      productKey: "FX-PROD-METRICS-CO",
      expectedProfit: null,
      orderDate: localDateKey(localDayStart(dayStart, -3)),
    },
  ];
}

function statusFixtures() {
  return [
    ["FX-STATUS-NUEVO", "E2E ESTADO NUEVO", null, "nuevo"],
    ["FX-STATUS-CONFIRMADO", "E2E ESTADO CONFIRMADO", "E2E Carrier", "confirmado"],
    ["FX-STATUS-GUIA-GENERADA", "E2E GUIA GENERADA", null, "guia_generada"],
    ["FX-STATUS-EN-RUTA", "E2E EN RUTA", null, "en_ruta"],
    ["FX-STATUS-EN-REPARTO", "E2E EN REPARTO", null, "en_reparto"],
    ["FX-STATUS-RECOGER-OFICINA", "E2E RECOGER OFICINA", null, "recoger_oficina"],
    ["FX-STATUS-NOVEDAD-FALLBACK", "E2E INCIDENCIA", null, "novedad"],
    ["FX-STATUS-INTENTO-CARRIER", "E2E INCIDENCIA", "E2E Carrier", "intento_fallido"],
    ["FX-STATUS-PROXIMO", "E2E PROXIMO A LLEGAR", null, "proximo_a_llegar"],
    ["FX-STATUS-ENTREGADO", "E2E ENTREGADO", "E2E Carrier MX", "entregado"],
    ["FX-STATUS-CANCELADO", "E2E CANCELADO", null, "cancelado"],
    ["FX-STATUS-DEVOLUCION", "E2E DEVOLUCION", "E2E Carrier", "devolucion"],
    ["FX-STATUS-SIN-CLASIFICAR", "E2E SIN CLASIFICAR", null, "sin_clasificar"],
  ].map(([key, estado, transportadora, category]) => ({
    key,
    estado,
    transportadora,
    category,
    active: true,
  }));
}

function taskFixtures(anchor, dayStart, nextDayStart) {
  return [
    {
      key: "FX-TSK-OVERDUE-NOVEDAD",
      orderKey: "FX-ORD-CO-1007-DROPI",
      type: "resolver_novedad",
      state: "pendiente",
      deadline: isoAt(anchor, -3 * 60 * 60 * 1_000),
      snoozedUntil: null,
      assigneeKey: "FX-PROFILE-ADMIN",
      result: null,
      expectedTemporal: "overdue",
    },
    {
      key: "FX-TSK-TODAY-CONFIRM",
      orderKey: "FX-ORD-CO-1007-DROPI",
      type: "llamar_confirmacion",
      state: "pendiente",
      deadline: isoAt(dayStart, 14 * 60 * 60 * 1_000),
      snoozedUntil: null,
      assigneeKey: null,
      result: null,
      expectedTemporal: "today",
    },
    {
      key: "FX-TSK-FUTURE-GUIDE",
      orderKey: "FX-ORD-CO-MEDIUM",
      type: "notificar_guia",
      state: "en_progreso",
      deadline: isoAt(nextDayStart, 12 * 60 * 60 * 1_000),
      snoozedUntil: null,
      assigneeKey: "FX-PROFILE-OPERATOR",
      result: null,
      expectedTemporal: "future",
    },
    {
      key: "FX-TSK-SNOOZED-DELIVERY",
      orderKey: "FX-ORD-CO-MEDIUM",
      type: "presionar_entrega",
      state: "pendiente",
      deadline: isoAt(anchor, -6 * 60 * 60 * 1_000),
      snoozedUntil: isoAt(nextDayStart, 9 * 60 * 60 * 1_000),
      assigneeKey: "FX-PROFILE-ADMIN",
      result: null,
      expectedTemporal: "snoozed",
    },
    {
      key: "FX-TSK-COMPLETED-ARRIVAL",
      orderKey: "FX-ORD-CO-1007-DROPI",
      type: "notificar_proximo_llegar",
      state: "completada",
      deadline: isoAt(dayStart, -2 * 60 * 60 * 1_000),
      snoozedUntil: null,
      assigneeKey: "FX-PROFILE-OPERATOR",
      completedAt: isoAt(anchor, -60 * 60 * 1_000),
      result: "Notificado exitosamente",
      expectedTemporal: "completed",
    },
    {
      key: "FX-TSK-CANCELLED",
      orderKey: "FX-ORD-MX-HISTORY-NULL",
      type: "resolver_novedad",
      state: "cancelada",
      deadline: null,
      snoozedUntil: null,
      assigneeKey: "FX-PROFILE-ADMIN",
      result: null,
      expectedTemporal: "cancelled",
    },
  ];
}

function notificationFixtures(anchor) {
  const canonical = [
    ["FX-NOTIF-URGENT", "tarea_urgente_asignada", false, "FX-ORD-CO-1007-DROPI", "FX-TSK-TODAY-CONFIRM"],
    ["FX-NOTIF-OVERDUE", "tarea_vencida", false, "FX-ORD-CO-1007-DROPI", "FX-TSK-OVERDUE-NOVEDAD"],
    ["FX-NOTIF-NEW-ORDER", "pedido_nuevo", true, "FX-ORD-CO-1007-DROPI", null],
    ["FX-NOTIF-NOVEDAD", "novedad", false, "FX-ORD-CO-1007-DROPI", "FX-TSK-OVERDUE-NOVEDAD"],
    ["FX-NOTIF-DELIVERED", "pedido_entregado", true, "FX-ORD-MX-LOW", null],
    ["FX-NOTIF-RETURNED", "pedido_devolucion", false, "FX-ORD-CO-HISTORY-ZERO", null],
    ["FX-NOTIF-OUT-FOR-DELIVERY", "pedido_en_reparto", false, "FX-ORD-CO-MEDIUM", "FX-TSK-SNOOZED-DELIVERY"],
  ].map(([key, type, read, orderKey, taskKey], index) => ({
    key,
    userKey: "FX-PROFILE-ADMIN",
    type,
    read,
    orderKey,
    taskKey,
    createdAt: isoAt(anchor, -(index + 1) * 60_000),
  }));
  const noDestination = {
    key: "FX-NOTIF-NO-DESTINATION",
    userKey: "FX-PROFILE-ADMIN",
    type: "pedido_nuevo",
    read: false,
    orderKey: null,
    taskKey: null,
    createdAt: isoAt(anchor, -8 * 60_000),
  };
  const otherUser = {
    key: "FX-NOTIF-OTHER-USER",
    userKey: "FX-PROFILE-OTHER",
    type: "pedido_nuevo",
    read: false,
    orderKey: "FX-ORD-MX-LOW",
    taskKey: null,
    createdAt: isoAt(anchor, -9 * 60_000),
  };
  const bulk = Array.from({ length: 95 }, (_, index) => ({
    key: `FX-NOTIF-BULK-${String(index + 1).padStart(3, "0")}`,
    userKey: "FX-PROFILE-ADMIN",
    type: "pedido_nuevo",
    read: false,
    orderKey: null,
    taskKey: null,
    createdAt: isoAt(anchor, -(24 * 60 + index) * 60_000),
  }));
  return [...canonical, noDestination, otherUser, ...bulk];
}

function walletFixtures(dayStart, nextDayStart) {
  const catalog = [
    ["FX-WALLET-CATALOG-GAIN", "E2E_GAIN", "ganancia"],
    ["FX-WALLET-CATALOG-FREIGHT", "E2E_FREIGHT", "costo_flete"],
    ["FX-WALLET-CATALOG-INDEMNITY", "E2E_INDEMNITY", "indemnizacion"],
    ["FX-WALLET-CATALOG-FULFILLMENT", "E2E_FULFILLMENT", "fulfillment"],
    ["FX-WALLET-CATALOG-SOFTWARE", "E2E_SOFTWARE", "software"],
    ["FX-WALLET-CATALOG-TOPUP", "E2E_TOPUP", "recarga"],
    ["FX-WALLET-CATALOG-WITHDRAWAL", "E2E_WITHDRAWAL", "retiro"],
  ].map(([key, identificationCode, category]) => ({ key, identificationCode, category }));
  const current = {
    key: "FX-WALLET-PERIOD-CURRENT",
    from: localDayStart(dayStart, -7).toISOString(),
    toExclusive: nextDayStart.toISOString(),
    inclusiveCalendarDays: 8,
  };
  const previous = {
    key: "FX-WALLET-PERIOD-PREVIOUS",
    from: localDayStart(dayStart, -15).toISOString(),
    toExclusive: localDayStart(dayStart, -7).toISOString(),
    inclusiveCalendarDays: 8,
  };
  const movement = (key, country, code, direction, amount, occurredAt) => ({
    key,
    externalMovementKey: `e2e:${key.toLowerCase()}`,
    country,
    identificationCode: code,
    direction,
    amount,
    occurredAt,
  });
  const currentAt = isoAt(dayStart, 10 * 60 * 60 * 1_000);
  const previousAt = isoAt(localDayStart(dayStart, -10), 10 * 60 * 60 * 1_000);
  const movements = [
    movement("FX-WALLET-CO-GAIN", "CO", "E2E_GAIN", "ENTRADA", 1_000_000, currentAt),
    movement("FX-WALLET-CO-INDEMNITY", "CO", "E2E_INDEMNITY", "ENTRADA", 50_000, currentAt),
    movement("FX-WALLET-CO-FREIGHT", "CO", "E2E_FREIGHT", "SALIDA", 200_000, currentAt),
    movement("FX-WALLET-CO-FULFILLMENT", "CO", "E2E_FULFILLMENT", "SALIDA", 80_000, currentAt),
    movement("FX-WALLET-CO-SOFTWARE", "CO", "E2E_SOFTWARE", "SALIDA", 20_000, currentAt),
    movement("FX-WALLET-CO-TOPUP", "CO", "E2E_TOPUP", "ENTRADA", 500_000, currentAt),
    movement("FX-WALLET-CO-WITHDRAWAL", "CO", "E2E_WITHDRAWAL", "SALIDA", 100_000, currentAt),
    movement("FX-WALLET-MX-GAIN", "MX", "E2E_GAIN", "ENTRADA", 12_000, currentAt),
    movement("FX-WALLET-MX-INDEMNITY", "MX", "E2E_INDEMNITY", "ENTRADA", 500, currentAt),
    movement("FX-WALLET-MX-FREIGHT", "MX", "E2E_FREIGHT", "SALIDA", 2_000, currentAt),
    movement("FX-WALLET-MX-FULFILLMENT", "MX", "E2E_FULFILLMENT", "SALIDA", 800, currentAt),
    movement("FX-WALLET-MX-SOFTWARE", "MX", "E2E_SOFTWARE", "SALIDA", 200, currentAt),
    movement("FX-WALLET-MX-TOPUP", "MX", "E2E_TOPUP", "ENTRADA", 5_000, currentAt),
    movement("FX-WALLET-MX-WITHDRAWAL", "MX", "E2E_WITHDRAWAL", "SALIDA", 1_500, currentAt),
    movement("FX-WALLET-PREV-CO-GAIN", "CO", "E2E_GAIN", "ENTRADA", 820_000, previousAt),
    movement("FX-WALLET-PREV-CO-FREIGHT", "CO", "E2E_FREIGHT", "SALIDA", 250_000, previousAt),
    movement("FX-WALLET-PREV-MX-GAIN", "MX", "E2E_GAIN", "ENTRADA", 10_000, previousAt),
    movement("FX-WALLET-PREV-MX-FREIGHT", "MX", "E2E_FREIGHT", "SALIDA", 2_500, previousAt),
    movement(
      "FX-WALLET-OUTSIDE-BOUNDARY",
      "CO",
      "E2E_GAIN",
      "ENTRADA",
      999_999,
      isoAt(new Date(previous.from), -1),
    ),
  ];
  return {
    catalog,
    periods: { current, previous },
    movements,
    expected: {
      current: {
        CO: { operationalEntries: 1_050_000, operationalExits: 300_000, operationalNet: 750_000, topUps: 500_000, withdrawals: 100_000 },
        MX: { operationalEntries: 12_500, operationalExits: 3_000, operationalNet: 9_500, topUps: 5_000, withdrawals: 1_500 },
      },
      previous: {
        CO: { operationalEntries: 820_000, operationalExits: 250_000, operationalNet: 570_000, topUps: 0, withdrawals: 0 },
        MX: { operationalEntries: 10_000, operationalExits: 2_500, operationalNet: 7_500, topUps: 0, withdrawals: 0 },
      },
    },
    streetMoney: [
      { key: "FX-STREET-CO", country: "CO", productKey: "FX-PROD-METRICS-CO", pendingOrders: 2, amount: 150_000 },
      { key: "FX-STREET-MX", country: "MX", productKey: "FX-PROD-METRICS-MX", pendingOrders: 1, amount: 700 },
    ],
  };
}

function costeoFixtures() {
  return [
    {
      key: "FX-COST-CO-POSITIVE",
      country: "CO",
      productKey: "FX-PROD-METRICS-CO",
      input: { supplierPrice: 20_000, baseShipping: 10_000, effectivenessRate: 0.8, administrativeCosts: 2_000, fulfillment: 3_000, adCpa: 8_000, cancellationRate: 0.2, salePrice: 80_000, discountRate: 0.2, adSpend: 64_000 },
      expectedProfitTone: "positive",
    },
    {
      key: "FX-COST-MX-POSITIVE",
      country: "MX",
      productKey: "FX-PROD-METRICS-MX",
      input: { supplierPrice: 200, baseShipping: 100, effectivenessRate: 0.5, administrativeCosts: 20, fulfillment: 30, adCpa: 50, cancellationRate: 0.2, salePrice: 800, discountRate: 0, adSpend: 500 },
      expectedProfitTone: "positive",
    },
    {
      key: "FX-COST-MX-NEGATIVE",
      country: "MX",
      productKey: "FX-PROD-NO-METRICS",
      input: { supplierPrice: 500, baseShipping: 200, effectivenessRate: 0.5, administrativeCosts: 30, fulfillment: 20, adCpa: 100, cancellationRate: 0.25, salePrice: 800, discountRate: 0, adSpend: 1_000 },
      expectedProfitTone: "negative",
    },
  ];
}

export function createFixtureContract(anchor) {
  const parsedAnchor = parseAnchor(anchor);
  const dayStart = localDayStart(parsedAnchor);
  const nextDayStart = localDayStart(parsedAnchor, 1);
  const orders = orderFixtures(dayStart);
  const statusCatalog = statusFixtures();
  const tasks = taskFixtures(parsedAnchor, dayStart, nextDayStart);
  const wallet = walletFixtures(dayStart, nextDayStart);

  return deepFreeze({
    version: CONTRACT_VERSION,
    namespace: "FX",
    timeZone: TIME_ZONE,
    anchor: {
      instant: parsedAnchor.toISOString(),
      operationalDate: localDateKey(parsedAnchor),
      dayStart: dayStart.toISOString(),
      nextDayStart: nextDayStart.toISOString(),
    },
    mutableAdapter: {
      status: "blocked",
      enabled: false,
      reason: "Mutable fixture adapter is blocked until the staging schema is audited and generated types are refreshed.",
      requiredEvidence: [
        "AUDITED_STAGING_SCHEMA_DUMP",
        "REGENERATED_SUPABASE_TYPES",
        "STAGING_AUTH_USERS",
        "VERIFIED_RLS_POLICIES",
        "STAGING_ONLY_MARKER",
      ],
    },
    verificationScope: {
      productionParity: [
        "dropi-history-counts",
        "task-result-options",
        "whatsapp-phone-formatting",
      ],
      scenarioOnly: [
        "dropi-risk",
        "status-resolution",
        "task-timing",
        "notification-destinations",
        "wallet-arithmetic",
        "costeo-formulas",
        "street-money",
        "product-metrics",
      ],
    },
    profiles: [
      { key: "FX-PROFILE-ADMIN", email: "admin.e2e@pakora.invalid", active: true },
      { key: "FX-PROFILE-OPERATOR", email: "operator.e2e@pakora.invalid", active: true },
      { key: "FX-PROFILE-OTHER", email: "isolated.e2e@pakora.invalid", active: true },
    ],
    products: [
      { key: "FX-PROD-METRICS-CO", country: "CO", name: "[E2E] Control COD CO", hasOrderMetrics: true },
      { key: "FX-PROD-METRICS-MX", country: "MX", name: "[E2E] Control COD MX", hasOrderMetrics: true },
      { key: "FX-PROD-NO-METRICS", country: "MX", name: "[E2E] Sin métricas", hasOrderMetrics: false },
    ],
    orders,
    statusCatalog,
    statusHistory: statusCatalog.map((row, index) => ({
      key: `FX-HISTORY-${String(index + 1).padStart(2, "0")}`,
      orderKey: orders[index % orders.length].key,
      estado: row.estado,
      transportadora: row.transportadora,
      expectedCategory: row.category,
      occurredAt: isoAt(parsedAnchor, -(index + 1) * 60 * 60 * 1_000),
    })),
    tasks,
    comments: [
      { key: "FX-COMMENT-ORDER-1007", orderKey: "FX-ORD-CO-1007-DROPI", origin: "e2e", message: "Cliente pidió confirmar antes del despacho." },
    ],
    notifications: notificationFixtures(parsedAnchor),
    whatsapp: {
      incoming: [
        { key: "FX-WA-IN-001", orderKey: "FX-ORD-CO-1007-DROPI", phone: "3005551007", message: "Hola, ¿cuándo llega mi pedido?", aiSuggestion: null, occurredAt: isoAt(parsedAnchor, -45 * 60_000) },
        { key: "FX-WA-IN-002", orderKey: "FX-ORD-CO-1007-DROPI", phone: "3005551007", message: "Sí lo voy a recibir.", aiSuggestion: "Perfecto, estaremos atentos a la entrega.", occurredAt: isoAt(parsedAnchor, -30 * 60_000) },
        { key: "FX-WA-IN-003", orderKey: "FX-ORD-CO-1007-DROPI", phone: "3005551007", message: "Gracias.", aiSuggestion: null, occurredAt: isoAt(parsedAnchor, -15 * 60_000) },
        { key: "FX-WA-IN-MX-SAME-PHONE", orderKey: "FX-ORD-MX-LOW", phone: "3005551007", message: "Pedido de México, identidad separada.", aiSuggestion: null, occurredAt: isoAt(parsedAnchor, -10 * 60_000) },
      ],
      outgoing: [
        { key: "FX-WA-OUT-001", orderKey: "FX-ORD-CO-1007-DROPI", phone: "3005551007", message: "Tu pedido está en camino.", occurredAt: isoAt(parsedAnchor, -40 * 60_000) },
        { key: "FX-WA-OUT-002", orderKey: "FX-ORD-CO-1007-DROPI", phone: "3005551007", message: "Gracias por confirmar.", occurredAt: isoAt(parsedAnchor, -20 * 60_000) },
      ],
    },
    abandonedOrders: [
      { key: "FX-ABAN-NUEVO", externalCode: "E2E-ABAN-NUEVO", country: "CO", state: "nuevo", phone: "3001110001", productKey: "FX-PROD-METRICS-CO", price: 80_000 },
      { key: "FX-ABAN-CONTACTADO", externalCode: "E2E-ABAN-CONTACTADO", country: "MX", state: "contactado", phone: "5511110002", productKey: "FX-PROD-METRICS-MX", price: 800 },
      { key: "FX-ABAN-RECUPERADO", externalCode: "E2E-ABAN-RECUPERADO", country: "CO", state: "recuperado", phone: "3001110003", productKey: "FX-PROD-METRICS-CO", price: 80_000 },
      { key: "FX-ABAN-DESCARTADO", externalCode: "E2E-ABAN-DESCARTADO", country: "MX", state: "descartado", phone: null, productKey: null, price: null },
    ],
    wallet,
    costeos: costeoFixtures(),
  });
}

function issue(code, path, message) {
  return Object.freeze({ code, path, message });
}

function sameSet(values, expected) {
  return values.size === expected.length && expected.every((value) => values.has(value));
}

function stableKeys(contract, errors) {
  const collections = [
    contract.profiles,
    contract.products,
    contract.orders,
    contract.statusCatalog,
    contract.statusHistory,
    contract.tasks,
    contract.comments,
    contract.notifications,
    contract.whatsapp?.incoming,
    contract.whatsapp?.outgoing,
    contract.abandonedOrders,
    contract.wallet?.catalog,
    contract.wallet?.movements,
    contract.wallet?.streetMoney,
    contract.costeos,
  ];
  const seen = new Set();
  for (const collection of collections) {
    if (!Array.isArray(collection)) {
      errors.push(issue("COLLECTION_MISSING", "contract", "Every fixture collection must be an array."));
      continue;
    }
    for (const row of collection) {
      if (typeof row?.key !== "string" || !row.key.startsWith("FX-")) {
        errors.push(issue("KEY_INVALID", "fixture.key", "Every fixture key must start with FX-."));
      } else if (seen.has(row.key)) {
        errors.push(issue("KEY_DUPLICATE", row.key, "Fixture keys must be globally unique."));
      } else {
        seen.add(row.key);
      }
      if (Object.prototype.hasOwnProperty.call(row ?? {}, "id")) {
        errors.push(issue("HARDCODED_PRIMARY_KEY", row?.key ?? "fixture", "Logical fixtures must not contain database primary keys."));
      }
    }
  }
  return seen;
}

export function inspectFixtureContract(contract) {
  const errors = [];
  try {
    if (!contract || typeof contract !== "object") {
      return Object.freeze({ ok: false, errors: [issue("CONTRACT_INVALID", "contract", "Fixture contract must be an object.")], summary: null });
    }
    if (contract.version !== CONTRACT_VERSION || contract.timeZone !== TIME_ZONE) {
      errors.push(issue("CONTRACT_METADATA_INVALID", "version/timeZone", "Fixture version and timezone must match the v1 contract."));
    }
    if (contract.mutableAdapter?.status !== "blocked" || contract.mutableAdapter?.enabled !== false) {
      errors.push(issue("MUTABLE_ADAPTER_NOT_BLOCKED", "mutableAdapter", "Database mutation must remain blocked until staging evidence exists."));
    }
    const allKeys = stableKeys(contract, errors);
    const orderKeys = new Set(contract.orders?.map(({ key }) => key));
    const profileKeys = new Set(contract.profiles?.map(({ key }) => key));
    const productKeys = new Set(contract.products?.map(({ key }) => key));
    const taskKeys = new Set(contract.tasks?.map(({ key }) => key));

    if (!sameSet(new Set(contract.orders?.map(({ country }) => country)), ["CO", "MX"])) {
      errors.push(issue("COUNTRY_COVERAGE", "orders", "Orders must cover CO and MX."));
    }
    if (!sameSet(new Set(contract.orders?.map(({ crmState }) => crmState)), CRM_STATES)) {
      errors.push(issue("CRM_STATE_COVERAGE", "orders", "Orders must cover all five CRM states."));
    }
    if (!sameSet(new Set(contract.statusCatalog?.map(({ category }) => category)), STATUS_CATEGORIES)) {
      errors.push(issue("STATUS_CATEGORY_COVERAGE", "statusCatalog", "Status catalog must cover all 13 categories."));
    }
    for (const row of contract.statusCatalog ?? []) {
      if (resolveStatusCategoryScenario(contract.statusCatalog, row.estado, row.transportadora) !== row.category) {
        errors.push(issue("SCENARIO_STATUS_RESOLUTION", row.key, "Status category resolution does not match the fixture expectation."));
      }
    }
    if (
      resolveStatusCategoryScenario(contract.statusCatalog, "E2E INCIDENCIA", "E2E Carrier") !== "intento_fallido" ||
      resolveStatusCategoryScenario(contract.statusCatalog, "E2E INCIDENCIA", "Otra") !== "novedad" ||
      resolveStatusCategoryScenario(contract.statusCatalog, "E2E UNKNOWN", null) !== "sin_clasificar"
    ) {
      errors.push(issue("SCENARIO_STATUS_PRECEDENCE", "statusCatalog", "Status resolver must prefer carrier-specific, then fallback, then sin_clasificar."));
    }

    const risks = new Set();
    for (const order of contract.orders ?? []) {
      const exactStatus = (contract.statusCatalog ?? []).find(
        (row) =>
          row?.active !== false &&
          row?.estado === order.currentStatus?.estado &&
          row?.transportadora === order.currentStatus?.transportadora,
      );
      if (
        !exactStatus ||
        exactStatus.category !== order.currentStatus?.expectedCategory
      ) {
        errors.push(
          issue(
            "ORDER_CURRENT_STATUS_MAPPING",
            order.key,
            "Order current status must map to its expected category through an exact status/carrier catalog row.",
          ),
        );
      }
      if (order.logistics?.carrier !== order.currentStatus?.transportadora) {
        errors.push(
          issue(
            "ORDER_CURRENT_CARRIER_MISMATCH",
            order.key,
            "Order logistics carrier and current-status carrier must match exactly.",
          ),
        );
      }
      if (typeof order.active !== "boolean") {
        errors.push(
          issue(
            "ORDER_ACTIVE_INVALID",
            order.key,
            "Every order must explicitly declare whether it is active.",
          ),
        );
      }
      const stats = calculateDropiHistoryScenario(order.history);
      risks.add(stats.risk);
      if (stats.risk !== order.expectedRisk) {
        errors.push(issue("SCENARIO_DROPI_RISK", order.key, "Dropi risk does not match the declared fixture risk."));
      }
      if (!productKeys.has(order.productKey)) {
        errors.push(issue("ORDER_PRODUCT_REFERENCE", order.key, "Order references an unknown product."));
      }
    }
    if (!sameSet(risks, ["alto", "medio", "bajo", "sin_datos"])) {
      errors.push(issue("RISK_COVERAGE", "orders", "Orders must cover high, medium, low, and no-data risk."));
    }
    const order1007 = contract.orders?.find(({ key }) => key === "FX-ORD-CO-1007-DROPI");
    const stats1007 = calculateDropiHistoryScenario(order1007?.history);
    if (order1007?.numeroOrden !== "#1007" || stats1007.totalOrders !== 118 || stats1007.deliveredOrders !== 39 || stats1007.returnedOrders !== 78 || stats1007.otherOrders !== 1) {
      errors.push(issue("DROPI_1007", "FX-ORD-CO-1007-DROPI", "Order #1007 must preserve 118 = 39 + 78 + 1."));
    }
    if (!(contract.orders ?? []).some(({ history }) => history.totalOrders === null) || !(contract.orders ?? []).some(({ history }) => history.totalOrders === 0)) {
      errors.push(issue("DROPI_EMPTY_ZERO_COVERAGE", "orders", "Fixtures must distinguish null history from a valid zero history."));
    }

    const declaredStreetMoney = (contract.wallet?.streetMoney ?? [])
      .map(({ country, productKey, pendingOrders, amount }) => ({
        country,
        productKey,
        pendingOrders,
        amount,
      }))
      .sort(
        (left, right) =>
          left.country.localeCompare(right.country, "en") ||
          left.productKey.localeCompare(right.productKey, "en"),
      );
    const calculatedStreetMoney = calculateStreetMoneyScenario(
      contract.orders ?? [],
      contract.statusCatalog ?? [],
    );
    if (JSON.stringify(calculatedStreetMoney) !== JSON.stringify(declaredStreetMoney)) {
      errors.push(
        issue(
          "SCENARIO_STREET_MONEY",
          "wallet.streetMoney",
          "Street-money expectations must be derivable from exact current order statuses and expected profits.",
        ),
      );
    }

    if (!sameSet(new Set(contract.tasks?.map(({ type }) => type)), TASK_TYPES) || !sameSet(new Set(contract.tasks?.map(({ state }) => state)), TASK_STATES)) {
      errors.push(issue("TASK_COVERAGE", "tasks", "Tasks must cover five types and four states."));
    }
    const temporalCoverage = new Set();
    const taskCountByOrder = new Map();
    for (const task of contract.tasks ?? []) {
      if (!orderKeys.has(task.orderKey)) {
        errors.push(issue("TASK_ORDER_REFERENCE", task.key, "Task references an unknown order."));
      }
      if (task.assigneeKey !== null && !profileKeys.has(task.assigneeKey)) {
        errors.push(issue("TASK_ASSIGNEE_REFERENCE", task.key, "Task references an unknown assignee."));
      }
      if (task.result !== null && !TASK_RESULT_OPTIONS_SCENARIO[task.type]?.includes(task.result)) {
        errors.push(issue("TASK_RESULT_INVALID", task.key, "Task result is not valid for its type."));
      }
      const timing = classifyTaskTimeScenario(task, contract.anchor.instant);
      if (timing.isOverdue) temporalCoverage.add("overdue");
      if (timing.isToday) temporalCoverage.add("today");
      if (timing.isFuture) temporalCoverage.add("future");
      if (timing.isActivelySnoozed) temporalCoverage.add("snoozed");
      if (timing.isCompleted) temporalCoverage.add("completed");
      if (timing.isUnassigned) temporalCoverage.add("unassigned");
      taskCountByOrder.set(task.orderKey, (taskCountByOrder.get(task.orderKey) ?? 0) + 1);
    }
    for (const expected of ["overdue", "today", "future", "snoozed", "completed", "unassigned"]) {
      if (!temporalCoverage.has(expected)) {
        errors.push(issue("TASK_TEMPORAL_COVERAGE", "tasks", `Missing task temporal scenario: ${expected}.`));
      }
    }
    if (![...taskCountByOrder.values()].some((count) => count > 1)) {
      errors.push(issue("TASK_MULTIPLE_PER_ORDER", "tasks", "At least one order must have multiple tasks."));
    }

    if (!sameSet(new Set(contract.notifications?.filter(({ key }) => !key.startsWith("FX-NOTIF-BULK-")).map(({ type }) => type)), NOTIFICATION_TYPES)) {
      errors.push(issue("NOTIFICATION_TYPE_COVERAGE", "notifications", "Canonical notifications must cover all seven types."));
    }
    for (const notification of contract.notifications ?? []) {
      if (!profileKeys.has(notification.userKey) || (notification.orderKey !== null && !orderKeys.has(notification.orderKey)) || (notification.taskKey !== null && !taskKeys.has(notification.taskKey))) {
        errors.push(issue("NOTIFICATION_REFERENCE", notification.key, "Notification contains an invalid logical reference."));
      }
    }
    const adminNotifications = (contract.notifications ?? []).filter(({ userKey }) => userKey === "FX-PROFILE-ADMIN");
    if (adminNotifications.filter(({ read }) => !read).length <= 99 || !adminNotifications.some(({ read }) => read) || !adminNotifications.some(({ orderKey, taskKey }) => orderKey === null && taskKey === null) || !(contract.notifications ?? []).some(({ userKey }) => userKey === "FX-PROFILE-OTHER")) {
      errors.push(issue("NOTIFICATION_STATE_COVERAGE", "notifications", "Notifications must cover read/unread, 99+, no destination, and another user."));
    }

    for (const message of [...(contract.whatsapp?.incoming ?? []), ...(contract.whatsapp?.outgoing ?? [])]) {
      if (!orderKeys.has(message.orderKey)) errors.push(issue("WHATSAPP_ORDER_REFERENCE", message.key, "WhatsApp message references an unknown order."));
    }
    if (!(contract.whatsapp?.incoming ?? []).some(({ aiSuggestion }) => Boolean(aiSuggestion))) {
      errors.push(issue("WHATSAPP_AI_COVERAGE", "whatsapp.incoming", "One incoming message must include a preloaded AI suggestion."));
    }
    if (!sameSet(new Set(contract.abandonedOrders?.map(({ state }) => state)), ABANDONED_STATES)) {
      errors.push(issue("ABANDONED_STATE_COVERAGE", "abandonedOrders", "Abandoned orders must cover all four states."));
    }

    const currentTotals = calculateWalletScenarioTotals(contract.wallet.movements, contract.wallet.catalog, contract.wallet.periods.current);
    const previousTotals = calculateWalletScenarioTotals(contract.wallet.movements, contract.wallet.catalog, contract.wallet.periods.previous);
    if (JSON.stringify(currentTotals) !== JSON.stringify(contract.wallet.expected.current) || JSON.stringify(previousTotals) !== JSON.stringify(contract.wallet.expected.previous)) {
      errors.push(issue("SCENARIO_WALLET_ARITHMETIC", "wallet", "Wallet operational/capital totals do not match declared expectations."));
    }
    if (contract.wallet.periods.current.inclusiveCalendarDays !== 8 || contract.wallet.periods.previous.inclusiveCalendarDays !== 8 || new Date(contract.wallet.periods.current.from).getTime() - new Date(contract.wallet.periods.previous.from).getTime() !== 8 * DAY_MS) {
      errors.push(issue("SCENARIO_WALLET_PERIODS", "wallet.periods", "Current and previous finance periods must each preserve eight inclusive calendar days for range=7."));
    }

    const tones = new Set();
    for (const costeo of contract.costeos ?? []) {
      if (!productKeys.has(costeo.productKey)) errors.push(issue("COSTEO_PRODUCT_REFERENCE", costeo.key, "Costeo references an unknown product."));
      const metrics = calculateCosteoScenarioMetrics(costeo.input);
      const tone = metrics.deliveredOrderProfit >= 0 ? "positive" : "negative";
      tones.add(tone);
      if (tone !== costeo.expectedProfitTone) errors.push(issue("SCENARIO_COSTEO_TONE", costeo.key, "Costeo profit tone does not match calculations."));
    }
    if (!sameSet(new Set(contract.costeos?.map(({ country }) => country)), ["CO", "MX"]) || !tones.has("negative")) {
      errors.push(issue("COSTEO_COVERAGE", "costeos", "Costeos must cover CO, MX, and a negative-margin case."));
    }
    if (!(contract.products ?? []).some(({ hasOrderMetrics }) => hasOrderMetrics) || !(contract.products ?? []).some(({ hasOrderMetrics }) => !hasOrderMetrics)) {
      errors.push(issue("PRODUCT_METRIC_COVERAGE", "products", "Products must include with-metrics and without-metrics cases."));
    }

    return Object.freeze({
      ok: errors.length === 0,
      errors: Object.freeze(errors),
      summary: Object.freeze({
        fixtureKeys: allKeys.size,
        orders: contract.orders?.length ?? 0,
        tasks: contract.tasks?.length ?? 0,
        notifications: contract.notifications?.length ?? 0,
        adminUnreadNotifications: adminNotifications.filter(({ read }) => !read).length,
      }),
    });
  } catch (error) {
    errors.push(issue("CONTRACT_INSPECTION_FAILED", "contract", error instanceof Error ? error.message : "Unknown fixture inspection failure."));
    return Object.freeze({ ok: false, errors: Object.freeze(errors), summary: null });
  }
}

export class FixtureContractError extends Error {
  constructor(message, issues = [], options) {
    super(message, options);
    this.name = "FixtureContractError";
    this.issues = Object.freeze([...issues]);
  }
}

export function assertFixtureContract(contract) {
  const inspection = inspectFixtureContract(contract);
  if (!inspection.ok) {
    const detail = inspection.errors.map(({ code, path, message }) => `[${code}] ${path}: ${message}`).join("\n");
    throw new FixtureContractError(`Fixture contract failed validation.${detail ? `\n${detail}` : ""}`, inspection.errors);
  }
  return contract;
}
