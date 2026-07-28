import { expect, test } from "@playwright/test";

import {
  assertFixtureContract,
  calculateCosteoScenarioMetrics,
  calculateDropiHistoryScenario,
  calculateWalletScenarioTotals,
  classifyTaskTimeScenario,
  createFixtureContract,
  inspectFixtureContract,
  resolveStatusCategoryScenario,
  TASK_RESULT_OPTIONS_SCENARIO,
  type FixtureContract,
} from "../../../scripts/e2e/fixture-contract.mjs";
import { getCustomerHistoryStats } from "../../../src/lib/orders/getCustomerHistoryStats";
import {
  isValidResultado,
  resultadoOptions,
} from "../../../src/lib/tasks/resultadoOptions";
import { formatPhoneForWhatsApp } from "../../../src/lib/whatsapp/formatPhoneForWhatsApp";

const ANCHOR = "2026-07-28T15:00:00.000Z"; // 10:00 in America/Bogota.

function mutableCopy(contract: FixtureContract) {
  return structuredClone(contract) as FixtureContract;
}

function collectPropertyNames(value: unknown, names: string[] = []) {
  if (!value || typeof value !== "object") return names;
  if (Array.isArray(value)) {
    for (const child of value) collectPropertyNames(child, names);
    return names;
  }
  for (const [name, child] of Object.entries(value)) {
    names.push(name);
    collectPropertyNames(child, names);
  }
  return names;
}

test("fixture contract is deterministic, deeply immutable, and mutation-blocked", () => {
  const first = createFixtureContract(ANCHOR);
  const second = createFixtureContract(new Date(ANCHOR));

  expect(first).toEqual(second);
  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.orders)).toBe(true);
  expect(Object.isFrozen(first.orders[0].history)).toBe(true);
  expect(first.mutableAdapter).toMatchObject({ status: "blocked", enabled: false });
  expect(first.verificationScope).toEqual({
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
  });
  expect(first.mutableAdapter.requiredEvidence).toEqual(
    expect.arrayContaining([
      "AUDITED_STAGING_SCHEMA_DUMP",
      "REGENERATED_SUPABASE_TYPES",
      "VERIFIED_RLS_POLICIES",
    ]),
  );
  expect(assertFixtureContract(first)).toBe(first);
  expect(inspectFixtureContract(first)).toMatchObject({ ok: true });
});

test("all logical fixtures use globally stable FX keys without database primary keys", () => {
  const contract = createFixtureContract(ANCHOR);
  const propertyNames = collectPropertyNames(contract);
  const inspection = inspectFixtureContract(contract);

  expect(propertyNames).not.toContain("id");
  expect(propertyNames.filter((name) => /_id$/i.test(name))).toEqual([]);
  expect(inspection.ok).toBe(true);
  expect(inspection.summary?.fixtureKeys).toBeGreaterThan(150);
  expect(
    contract.orders.every(
      ({ key, adapterNaturalKey }) =>
        key.startsWith("FX-") && adapterNaturalKey.startsWith("e2e:"),
    ),
  ).toBe(true);
  expect(
    contract.wallet.movements.every(
      ({ key, externalMovementKey }) =>
        key.startsWith("FX-") && externalMovementKey.startsWith("e2e:"),
    ),
  ).toBe(true);
});

test("orders cover both countries, five CRM states, four risks, null, zero, and #1007", () => {
  const contract = createFixtureContract(ANCHOR);

  expect(new Set(contract.orders.map(({ country }) => country))).toEqual(
    new Set(["CO", "MX"]),
  );
  expect(new Set(contract.orders.map(({ crmState }) => crmState))).toEqual(
    new Set(["nuevo", "en_ruta", "entregado", "cancelado", "devolucion"]),
  );
  expect(new Set(contract.orders.map(({ expectedRisk }) => expectedRisk))).toEqual(
    new Set(["alto", "medio", "bajo", "sin_datos"]),
  );

  const order1007 = contract.orders.find(
    ({ key }) => key === "FX-ORD-CO-1007-DROPI",
  );
  expect(order1007?.numeroOrden).toBe("#1007");
  expect(calculateDropiHistoryScenario(order1007!.history)).toEqual({
    hasHistory: true,
    totalOrders: 118,
    deliveredOrders: 39,
    returnedOrders: 78,
    otherOrders: 1,
    returnRate: 78 / 118,
    risk: "alto",
  });

  const nullStats = calculateDropiHistoryScenario({ totalOrders: null });
  const zeroStats = calculateDropiHistoryScenario({
    totalOrders: 0,
    deliveredOrders: 0,
    returnedOrders: 0,
  });
  expect(nullStats).toMatchObject({ hasHistory: false, returnRate: null });
  expect(zeroStats).toMatchObject({ hasHistory: true, returnRate: 0 });
  expect(() =>
    calculateDropiHistoryScenario({
      totalOrders: 5,
      deliveredOrders: 4,
      returnedOrders: 2,
    }),
  ).toThrow(/cannot exceed total/i);
});

test("available pure production contracts agree with their fixture scenarios", () => {
  const contract = createFixtureContract(ANCHOR);

  for (const order of contract.orders) {
    const scenario = calculateDropiHistoryScenario(order.history);
    const production = getCustomerHistoryStats({
      total_pedidos_cliente: order.history.totalOrders,
      pedidos_entregados_cliente: order.history.deliveredOrders ?? null,
      pedidos_devueltos_cliente: order.history.returnedOrders ?? null,
    });

    expect(production, `Dropi history drifted for ${order.key}`).toEqual({
      hasHistory: scenario.hasHistory,
      totalOrders: scenario.totalOrders,
      deliveredOrders: scenario.deliveredOrders,
      returnedOrders: scenario.returnedOrders,
      otherOrders: scenario.otherOrders,
    });
  }

  expect(new Set(contract.tasks.map(({ type }) => type))).toEqual(
    new Set(Object.keys(resultadoOptions)),
  );
  expect(TASK_RESULT_OPTIONS_SCENARIO).toEqual(resultadoOptions);
  for (const task of contract.tasks) {
    if (task.result !== null) {
      expect(
        isValidResultado(task.type, task.result),
        `Task result drifted for ${task.key}`,
      ).toBe(true);
    }
  }

  const coOrder = contract.orders.find(
    ({ key }) => key === "FX-ORD-CO-1007-DROPI",
  );
  const mxOrder = contract.orders.find(
    ({ key }) => key === "FX-ORD-MX-LOW",
  );
  expect(formatPhoneForWhatsApp(coOrder!.customer.phone!, "CO")).toBe(
    "573005551007",
  );
  expect(formatPhoneForWhatsApp(mxOrder!.customer.phone!, "MX")).toBe(
    "5213005551007",
  );
  expect(formatPhoneForWhatsApp("", "CO")).toBe("");
  expect(formatPhoneForWhatsApp("", "MX")).toBe("");
});

test("status scenario oracle covers 13 categories with carrier precedence and safe fallback", () => {
  const contract = createFixtureContract(ANCHOR);
  const categories = new Set(contract.statusCatalog.map(({ category }) => category));

  expect(categories).toEqual(
    new Set([
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
    ]),
  );
  expect(contract.statusCatalog).toHaveLength(13);
  expect(
    resolveStatusCategoryScenario(contract.statusCatalog, "E2E INCIDENCIA", "E2E Carrier"),
  ).toBe("intento_fallido");
  expect(
    resolveStatusCategoryScenario(contract.statusCatalog, "E2E INCIDENCIA", "Otra"),
  ).toBe("novedad");
  expect(resolveStatusCategoryScenario(contract.statusCatalog, "NO EXISTE", null)).toBe(
    "sin_clasificar",
  );
});

test("task scenario oracle covers five types, four states, time classes, unassigned, and multiples", () => {
  const contract = createFixtureContract(ANCHOR);
  const timing = new Map(
    contract.tasks.map((task) => [
      task.key,
      classifyTaskTimeScenario(task, contract.anchor.instant),
    ]),
  );

  expect(new Set(contract.tasks.map(({ type }) => type))).toEqual(
    new Set([
      "llamar_confirmacion",
      "notificar_guia",
      "presionar_entrega",
      "notificar_proximo_llegar",
      "resolver_novedad",
    ]),
  );
  expect(new Set(contract.tasks.map(({ state }) => state))).toEqual(
    new Set(["pendiente", "en_progreso", "completada", "cancelada"]),
  );
  expect(timing.get("FX-TSK-OVERDUE-NOVEDAD")?.isOverdue).toBe(true);
  expect(timing.get("FX-TSK-TODAY-CONFIRM")?.isToday).toBe(true);
  expect(timing.get("FX-TSK-FUTURE-GUIDE")?.isFuture).toBe(true);
  expect(timing.get("FX-TSK-SNOOZED-DELIVERY")).toMatchObject({
    isActivelySnoozed: true,
    isOverdue: false,
  });
  expect(timing.get("FX-TSK-COMPLETED-ARRIVAL")?.isCompleted).toBe(true);
  expect(timing.get("FX-TSK-TODAY-CONFIRM")?.isUnassigned).toBe(true);
  expect(
    contract.tasks.filter(
      ({ orderKey }) => orderKey === "FX-ORD-CO-1007-DROPI",
    ).length,
  ).toBeGreaterThan(1);
});

test("notifications cover all types, read states, destination shapes, isolation, and 99+", () => {
  const contract = createFixtureContract(ANCHOR);
  const canonical = contract.notifications.filter(
    ({ key }) => !key.startsWith("FX-NOTIF-BULK-"),
  );
  const admin = contract.notifications.filter(
    ({ userKey }) => userKey === "FX-PROFILE-ADMIN",
  );

  expect(new Set(canonical.map(({ type }) => type))).toEqual(
    new Set([
      "tarea_urgente_asignada",
      "tarea_vencida",
      "pedido_nuevo",
      "novedad",
      "pedido_entregado",
      "pedido_devolucion",
      "pedido_en_reparto",
    ]),
  );
  expect(admin.filter(({ read }) => !read)).toHaveLength(101);
  expect(admin.some(({ read }) => read)).toBe(true);
  expect(
    admin.some(({ orderKey, taskKey }) => orderKey !== null && taskKey !== null),
  ).toBe(true);
  expect(
    admin.some(({ orderKey, taskKey }) => orderKey !== null && taskKey === null),
  ).toBe(true);
  expect(
    admin.some(({ orderKey, taskKey }) => orderKey === null && taskKey === null),
  ).toBe(true);
  expect(
    contract.notifications.some(({ userKey }) => userKey === "FX-PROFILE-OTHER"),
  ).toBe(true);
});

test("logical WhatsApp, abandoned, and product scenarios are complete", () => {
  const contract = createFixtureContract(ANCHOR);

  expect(contract.whatsapp.incoming).toHaveLength(4);
  expect(contract.whatsapp.outgoing).toHaveLength(2);
  expect(
    contract.whatsapp.incoming.some(({ aiSuggestion }) => Boolean(aiSuggestion)),
  ).toBe(true);
  const samePhoneCountries = new Set(
    contract.whatsapp.incoming
      .filter(({ phone }) => phone === "3005551007")
      .map(({ orderKey }) =>
        contract.orders.find(({ key }) => key === orderKey)?.country,
      ),
  );
  expect(samePhoneCountries).toEqual(new Set(["CO", "MX"]));
  expect(new Set(contract.abandonedOrders.map(({ state }) => state))).toEqual(
    new Set(["nuevo", "contactado", "recuperado", "descartado"]),
  );
  expect(contract.abandonedOrders.some(({ phone }) => phone === null)).toBe(true);
  expect(contract.products.some(({ hasOrderMetrics }) => hasOrderMetrics)).toBe(true);
  expect(contract.products.some(({ hasOrderMetrics }) => !hasOrderMetrics)).toBe(
    true,
  );
});

test("wallet scenario oracle preserves Bogota periods and declared arithmetic", () => {
  const contract = createFixtureContract(ANCHOR);
  expect(contract.timeZone).toBe("America/Bogota");
  expect(contract.anchor).toEqual({
    instant: ANCHOR,
    operationalDate: "2026-07-28",
    dayStart: "2026-07-28T05:00:00.000Z",
    nextDayStart: "2026-07-29T05:00:00.000Z",
  });
  expect(contract.wallet.periods.current).toMatchObject({
    from: "2026-07-21T05:00:00.000Z",
    toExclusive: "2026-07-29T05:00:00.000Z",
    inclusiveCalendarDays: 8,
  });
  expect(contract.wallet.periods.previous).toMatchObject({
    from: "2026-07-13T05:00:00.000Z",
    toExclusive: "2026-07-21T05:00:00.000Z",
    inclusiveCalendarDays: 8,
  });

  const current = calculateWalletScenarioTotals(
    contract.wallet.movements,
    contract.wallet.catalog,
    contract.wallet.periods.current,
  );
  const previous = calculateWalletScenarioTotals(
    contract.wallet.movements,
    contract.wallet.catalog,
    contract.wallet.periods.previous,
  );
  expect(current).toEqual(contract.wallet.expected.current);
  expect(previous).toEqual(contract.wallet.expected.previous);
  expect(current.CO).toEqual({
    operationalEntries: 1_050_000,
    operationalExits: 300_000,
    operationalNet: 750_000,
    topUps: 500_000,
    withdrawals: 100_000,
  });
  expect(current.MX).toEqual({
    operationalEntries: 12_500,
    operationalExits: 3_000,
    operationalNet: 9_500,
    topUps: 5_000,
    withdrawals: 1_500,
  });
  expect(contract.wallet.streetMoney).toEqual([
    expect.objectContaining({ country: "CO", pendingOrders: 2, amount: 150_000 }),
    expect.objectContaining({ country: "MX", pendingOrders: 1, amount: 700 }),
  ]);
});

test("costeo scenario oracle covers CO/MX projections and negative margin", () => {
  const contract = createFixtureContract(ANCHOR);
  const co = calculateCosteoScenarioMetrics(
    contract.costeos.find(({ key }) => key === "FX-COST-CO-POSITIVE")!.input,
  );
  const mx = calculateCosteoScenarioMetrics(
    contract.costeos.find(({ key }) => key === "FX-COST-MX-POSITIVE")!.input,
  );
  const negative = calculateCosteoScenarioMetrics(
    contract.costeos.find(({ key }) => key === "FX-COST-MX-NEGATIVE")!.input,
  );

  expect(co.adjustedShipping).toBeCloseTo(12_500, 8);
  expect(co.adjustedCpa).toBeCloseTo(12_500, 8);
  expect(co.totalCosts).toBeCloseTo(50_000, 8);
  expect(co.deliveredOrderProfit).toBeCloseTo(30_000, 8);
  expect(co.averageShopifyOrderProfit).toBeCloseTo(19_200, 8);
  expect(co.breakEvenCpa).toBeCloseTo(27_200, 8);
  expect(co.roas).toBeCloseTo(3.4, 8);
  expect(co.comparisonPrice).toBeCloseTo(100_000, 8);
  expect(co.projection?.totalOrders).toBeCloseTo(8, 8);
  expect(co.projection?.dispatchedOrders).toBeCloseTo(6.4, 8);
  expect(co.projection?.deliveredOrders).toBeCloseTo(5.12, 8);
  expect(co.projection?.netProfit).toBeCloseTo(153_600, 8);
  expect(co.projection?.realCpa).toBeCloseTo(12_500, 8);
  expect(co.projection?.realCpaRate).toBeCloseTo(0.15625, 8);
  expect(mx.adjustedShipping).toBeCloseTo(200, 8);
  expect(mx.adjustedCpa).toBeCloseTo(125, 8);
  expect(mx.totalCosts).toBeCloseTo(575, 8);
  expect(mx.deliveredOrderProfit).toBeCloseTo(225, 8);
  expect(mx.averageShopifyOrderProfit).toBeCloseTo(90, 8);
  expect(mx.breakEvenCpa).toBeCloseTo(140, 8);
  expect(mx.roas).toBeCloseTo(2.8, 8);
  expect(mx.projection?.totalOrders).toBeCloseTo(10, 8);
  expect(mx.projection?.dispatchedOrders).toBeCloseTo(8, 8);
  expect(mx.projection?.deliveredOrders).toBeCloseTo(4, 8);
  expect(mx.projection?.netProfit).toBeCloseTo(900, 8);
  expect(mx.projection?.realCpa).toBeCloseTo(125, 8);
  expect(negative.deliveredOrderProfit).toBeLessThan(0);
  expect(() =>
    calculateCosteoScenarioMetrics({
      ...contract.costeos[0].input,
      effectivenessRate: 0,
    }),
  ).toThrow(/effectivenessRate/);
});

test("inspection rejects drift instead of silently accepting broken fixtures", () => {
  const drifted = mutableCopy(createFixtureContract(ANCHOR));
  (drifted.mutableAdapter as { status: string }).status = "ready";
  (drifted.orders[0].history as { returnedOrders: number }).returnedOrders = 120;

  const inspection = inspectFixtureContract(drifted);
  expect(inspection.ok).toBe(false);
  expect(inspection.errors.map(({ code }) => code)).toEqual(
    expect.arrayContaining([
      "MUTABLE_ADAPTER_NOT_BLOCKED",
      "CONTRACT_INSPECTION_FAILED",
    ]),
  );
  expect(() => assertFixtureContract(drifted)).toThrow(/failed validation/i);
});
