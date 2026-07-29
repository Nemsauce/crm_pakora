import type { Database } from "../../src/lib/supabase/database.types";

export type FixtureCountry = Database["public"]["Enums"]["pais_enum"];
export type FixtureRisk = "alto" | "medio" | "bajo" | "sin_datos";
export type FixtureCrmState =
  Database["public"]["Enums"]["estado_crm_enum"];
export type FixtureStatusCategory =
  Database["public"]["Enums"]["categoria_estado_enum"];
export type FixtureTaskType =
  Database["public"]["Enums"]["tipo_tarea_enum"];
export type FixtureTaskState =
  Database["public"]["Enums"]["estado_tarea_enum"];
export type FixtureNotificationType =
  Database["public"]["Enums"]["notificacion_tipo_enum"];
export type FixtureAbandonedState =
  | "nuevo"
  | "contactado"
  | "recuperado"
  | "descartado";

export interface DropiHistoryInput {
  readonly totalOrders: number | null;
  readonly deliveredOrders?: number | null;
  readonly returnedOrders?: number | null;
}

export interface DropiHistoryStats {
  readonly hasHistory: boolean;
  readonly totalOrders: number;
  readonly deliveredOrders: number;
  readonly returnedOrders: number;
  readonly otherOrders: number;
  readonly returnRate: number | null;
  readonly risk: FixtureRisk;
}

export interface FixtureStatusCatalogRow {
  readonly key: string;
  readonly estado: string;
  readonly transportadora: string | null;
  readonly category: FixtureStatusCategory;
  readonly active: boolean;
}

export interface FixtureStreetMoneyOrder {
  readonly key: string;
  readonly country: FixtureCountry;
  readonly productKey: string;
  readonly expectedProfit: number | null;
  readonly currentStatus: Readonly<{
    estado: string;
    transportadora: string | null;
    expectedCategory: FixtureStatusCategory;
  }>;
}

export interface FixtureStreetMoneyRow {
  readonly country: FixtureCountry;
  readonly productKey: string;
  readonly pendingOrders: number;
  readonly amount: number;
}

export interface WalletMovement {
  readonly key: string;
  readonly externalMovementKey: string;
  readonly country: FixtureCountry;
  readonly identificationCode: string;
  readonly direction: "ENTRADA" | "SALIDA";
  readonly amount: number;
  readonly occurredAt: string;
}

export interface WalletCatalogRow {
  readonly key: string;
  readonly identificationCode: string;
  readonly category: Database["public"]["Enums"]["tipo_movimiento_wallet_enum"];
}

export interface WalletPeriod {
  readonly key: string;
  readonly from: string;
  readonly toExclusive: string;
  readonly inclusiveCalendarDays: number;
}

export interface WalletCountryTotals {
  readonly operationalEntries: number;
  readonly operationalExits: number;
  readonly operationalNet: number;
  readonly topUps: number;
  readonly withdrawals: number;
}

export type WalletTotals = Readonly<
  Record<FixtureCountry, Readonly<WalletCountryTotals>>
>;

export interface CosteoInput {
  readonly supplierPrice: number;
  readonly baseShipping: number;
  readonly effectivenessRate: number;
  readonly administrativeCosts: number;
  readonly fulfillment: number;
  readonly adCpa: number;
  readonly cancellationRate: number;
  readonly salePrice: number;
  readonly discountRate?: number;
  readonly adSpend?: number | null;
}

export interface CosteoProjection {
  readonly totalOrders: number;
  readonly billedValue: number;
  readonly dispatchedOrders: number;
  readonly dispatchedValue: number;
  readonly deliveredOrders: number;
  readonly deliveredValue: number;
  readonly netProfit: number;
  readonly realCpa: number | null;
  readonly realCpaRate: number | null;
}

export interface CosteoMetrics {
  readonly adjustedShipping: number;
  readonly adjustedCpa: number;
  readonly totalCosts: number;
  readonly deliveredOrderProfit: number;
  readonly averageShopifyOrderProfit: number;
  readonly breakEvenCpa: number;
  readonly roas: number;
  readonly comparisonPrice: number;
  readonly projection: Readonly<CosteoProjection> | null;
}

export interface FixtureTask {
  readonly key: string;
  readonly orderKey: string;
  readonly type: FixtureTaskType;
  readonly state: FixtureTaskState;
  readonly deadline: string | null;
  readonly snoozedUntil: string | null;
  readonly assigneeKey: string | null;
  readonly completedAt?: string;
  readonly result: string | null;
  readonly expectedTemporal: string;
}

export interface FixtureTaskTiming {
  readonly isOpen: boolean;
  readonly isActivelySnoozed: boolean;
  readonly isOverdue: boolean;
  readonly isToday: boolean;
  readonly isFuture: boolean;
  readonly isCompleted: boolean;
  readonly isUnassigned: boolean;
}

export interface FixtureContract {
  readonly version: "crm-pakora-v4-fixtures-v1";
  readonly namespace: "FX";
  readonly timeZone: "America/Bogota";
  readonly anchor: Readonly<{
    instant: string;
    operationalDate: string;
    dayStart: string;
    nextDayStart: string;
  }>;
  readonly mutableAdapter: Readonly<{
    status: "blocked";
    enabled: false;
    reason: string;
    requiredEvidence: readonly string[];
  }>;
  readonly verificationScope: Readonly<{
    productionParity: readonly [
      "dropi-history-counts",
      "task-result-options",
      "whatsapp-phone-formatting",
    ];
    scenarioOnly: readonly [
      "dropi-risk",
      "status-resolution",
      "task-timing",
      "notification-destinations",
      "wallet-arithmetic",
      "costeo-formulas",
      "street-money",
      "product-metrics",
    ];
  }>;
  readonly profiles: readonly Readonly<{
    key: string;
    email: string;
    active: boolean;
  }>[];
  readonly products: readonly Readonly<{
    key: string;
    country: FixtureCountry;
    name: string;
    hasOrderMetrics: boolean;
  }>[];
  readonly orders: readonly Readonly<{
    key: string;
    adapterNaturalKey: string;
    numeroOrden: string;
    country: FixtureCountry;
    crmState: FixtureCrmState;
    active: boolean;
    expectedRisk: FixtureRisk;
    history: Readonly<DropiHistoryInput>;
    currentStatus: Readonly<{
      estado: string;
      transportadora: string | null;
      expectedCategory: FixtureStatusCategory;
    }>;
    customer: Readonly<{
      name: string | null;
      surname: string | null;
      phone: string | null;
    }>;
    logistics: Readonly<{
      address: string | null;
      city: string | null;
      guide: string | null;
      carrier: string | null;
    }>;
    productKey: string;
    expectedProfit: number | null;
    orderDate: string;
  }>[];
  readonly statusCatalog: readonly Readonly<FixtureStatusCatalogRow>[];
  readonly statusHistory: readonly Readonly<{
    key: string;
    orderKey: string;
    estado: string;
    transportadora: string | null;
    expectedCategory: FixtureStatusCategory;
    occurredAt: string;
  }>[];
  readonly tasks: readonly Readonly<FixtureTask>[];
  readonly comments: readonly Readonly<{
    key: string;
    orderKey: string;
    origin: string;
    message: string;
  }>[];
  readonly notifications: readonly Readonly<{
    key: string;
    userKey: string;
    type: FixtureNotificationType;
    read: boolean;
    orderKey: string | null;
    taskKey: string | null;
    createdAt: string;
  }>[];
  readonly whatsapp: Readonly<{
    incoming: readonly Readonly<{
      key: string;
      orderKey: string;
      phone: string;
      message: string;
      aiSuggestion: string | null;
      occurredAt: string;
    }>[];
    outgoing: readonly Readonly<{
      key: string;
      orderKey: string;
      phone: string;
      message: string;
      occurredAt: string;
    }>[];
  }>;
  readonly abandonedOrders: readonly Readonly<{
    key: string;
    externalCode: string;
    country: FixtureCountry;
    state: FixtureAbandonedState;
    phone: string | null;
    productKey: string | null;
    price: number | null;
  }>[];
  readonly wallet: Readonly<{
    catalog: readonly Readonly<WalletCatalogRow>[];
    periods: Readonly<{ current: Readonly<WalletPeriod>; previous: Readonly<WalletPeriod> }>;
    movements: readonly Readonly<WalletMovement>[];
    expected: Readonly<{ current: WalletTotals; previous: WalletTotals }>;
    streetMoney: readonly Readonly<{
      key: string;
      country: FixtureCountry;
      productKey: string;
      pendingOrders: number;
      amount: number;
    }>[];
  }>;
  readonly costeos: readonly Readonly<{
    key: string;
    country: FixtureCountry;
    productKey: string;
    input: Readonly<CosteoInput>;
    expectedProfitTone: "positive" | "negative";
  }>[];
}

export interface FixtureContractIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export type FixtureContractInspection =
  | Readonly<{
      ok: true;
      errors: readonly [];
      summary: Readonly<{
        fixtureKeys: number;
        orders: number;
        tasks: number;
        notifications: number;
        adminUnreadNotifications: number;
      }>;
    }>
  | Readonly<{
      ok: false;
      errors: readonly FixtureContractIssue[];
      summary: Readonly<{
        fixtureKeys: number;
        orders: number;
        tasks: number;
        notifications: number;
        adminUnreadNotifications: number;
      }> | null;
    }>;

export const TASK_RESULT_OPTIONS_SCENARIO: Readonly<
  Record<FixtureTaskType, readonly string[]>
>;

/** Scenario oracle only; production parity is asserted separately. */
export function calculateDropiHistoryScenario(
  history: Readonly<DropiHistoryInput>,
): Readonly<DropiHistoryStats>;

/** Scenario oracle only; does not execute the production Supabase lookup. */
export function resolveStatusCategoryScenario(
  catalog: readonly Readonly<FixtureStatusCatalogRow>[],
  estado: string | null | undefined,
  transportadora?: string | null,
): FixtureStatusCategory;

/** Scenario oracle for the exact status/carrier join used by dinero_en_la_calle. */
export function calculateStreetMoneyScenario(
  orders: readonly Readonly<FixtureStreetMoneyOrder>[],
  catalog: readonly Readonly<FixtureStatusCatalogRow>[],
): readonly Readonly<FixtureStreetMoneyRow>[];

/** Scenario oracle only; does not execute or verify the production RPC. */
export function calculateWalletScenarioTotals(
  movements: readonly Readonly<WalletMovement>[],
  catalog: readonly Readonly<WalletCatalogRow>[],
  period: Readonly<Pick<WalletPeriod, "from" | "toExclusive">>,
): WalletTotals;

/** Scenario oracle only; does not execute the private UI formulas. */
export function calculateCosteoScenarioMetrics(
  input: Readonly<CosteoInput>,
): Readonly<CosteoMetrics>;

/** Scenario oracle only; production Today/task timing is characterized later. */
export function classifyTaskTimeScenario(
  task: Readonly<FixtureTask>,
  anchor: Date | string | number,
  timeZone?: "America/Bogota",
): Readonly<FixtureTaskTiming>;

export function createFixtureContract(
  anchor: Date | string | number,
): Readonly<FixtureContract>;

export function inspectFixtureContract(
  contract: unknown,
): FixtureContractInspection;

export class FixtureContractError extends Error {
  readonly issues: readonly FixtureContractIssue[];
  constructor(
    message: string,
    issues?: readonly FixtureContractIssue[],
    options?: ErrorOptions,
  );
}

export function assertFixtureContract<T extends FixtureContract>(
  contract: T,
): T;
