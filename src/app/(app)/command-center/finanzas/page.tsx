import { CapitalMovementsCard } from "@/components/command-center/CapitalMovementsCard";
import { DateRangeSelector } from "@/components/command-center/DateRangeSelector";
import {
  DineroEnLaCalleTable,
  type DineroEnLaCalleRow,
} from "@/components/command-center/DineroEnLaCalleTable";
import {
  MovementBreakdownTable,
  type WalletSummaryRow,
} from "@/components/command-center/MovementBreakdownTable";
import {
  NetProfitCard,
  type NetProfitTrendPoint,
} from "@/components/command-center/NetProfitCard";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  range?: string;
  from?: string;
  to?: string;
};

type CommandCenterFinanzasPageProps = {
  searchParams: Promise<SearchParams>;
};

type Pais = "CO" | "MX";

type WalletDailySummaryRow = {
  pais: Pais;
  dia: string;
  entradas: number | string | null;
  salidas: number | string | null;
  neto: number | string | null;
};

type WalletDailySummaryRpcClient = {
  rpc: (
    functionName: "wallet_daily_summary",
    args: { p_date_from: string; p_date_to: string },
  ) => PromiseLike<{
    data: WalletDailySummaryRow[] | null;
    error: { message: string } | null;
  }>;
};

type DineroEnLaCalleRpcClient = {
  rpc: (functionName: "dinero_en_la_calle") => PromiseLike<{
    data: DineroEnLaCalleRow[] | null;
    error: { message: string } | null;
  }>;
};

const validRanges = new Set(["7", "30", "90"]);
const countries = ["CO", "MX"] as const;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;

function getRange(value: string | undefined) {
  return value && validRanges.has(value) ? value : "30";
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange(days: number) {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateTo.getDate() - days);

  return {
    dateFrom: formatDateInput(dateFrom),
    dateTo: formatDateInput(dateTo),
  };
}

function parseDateInput(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && formatDateInput(date) === value
    ? date
    : null;
}

function getSelectedDateRange(params: SearchParams) {
  const customFrom = parseDateInput(params.from);
  const customTo = parseDateInput(params.to);

  if (
    params.range === "custom" &&
    customFrom &&
    customTo &&
    customFrom.getTime() <= customTo.getTime()
  ) {
    return {
      currentRange: "custom",
      dateFrom: formatDateInput(customFrom),
      dateTo: formatDateInput(customTo),
    };
  }

  const currentRange = getRange(params.range);

  return {
    currentRange,
    ...getDateRange(Number(currentRange)),
  };
}

function getPreviousDateRange(dateFrom: string, dateTo: string) {
  const currentFrom = parseDateInput(dateFrom)!;
  const currentTo = parseDateInput(dateTo)!;
  const periodLength =
    Math.floor(
      (currentTo.getTime() - currentFrom.getTime()) / DAY_IN_MILLISECONDS,
    ) + 1;
  const previousTo = new Date(currentFrom.getTime() - DAY_IN_MILLISECONDS);
  const previousFrom = new Date(
    previousTo.getTime() - (periodLength - 1) * DAY_IN_MILLISECONDS,
  );

  return {
    dateFrom: formatDateInput(previousFrom),
    dateTo: formatDateInput(previousTo),
  };
}

function toNumber(value: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getRowsByCountry(rows: WalletSummaryRow[], pais: Pais) {
  return rows.filter((row) => row.pais === pais);
}

function getCountryTotals(rows: WalletSummaryRow[]) {
  return rows.reduce(
    (totals, row) => {
      const total = toNumber(row.total);
      const tipo = row.tipo?.toUpperCase();

      if (row.categoria === "recarga") {
        totals.recargas += total;
        totals.hasCapitalMovements = true;
        return totals;
      }

      if (row.categoria === "retiro") {
        totals.retiros += total;
        totals.hasCapitalMovements = true;
        return totals;
      }

      if (tipo === "ENTRADA") {
        totals.entradasOperativas += total;
        totals.hasOperationalMovements = true;
      }

      if (tipo === "SALIDA") {
        totals.salidasOperativas += total;
        totals.hasOperationalMovements = true;
      }

      return totals;
    },
    {
      entradasOperativas: 0,
      salidasOperativas: 0,
      recargas: 0,
      retiros: 0,
      hasOperationalMovements: false,
      hasCapitalMovements: false,
    },
  );
}

function getCountryDailyNet(rows: WalletDailySummaryRow[], pais: Pais) {
  return rows.reduce(
    (total, row) => total + (row.pais === pais ? toNumber(row.neto) : 0),
    0,
  );
}

function getComparisonPercentage(currentNet: number, previousNet: number) {
  if (previousNet === 0) {
    return currentNet === 0 ? 0 : null;
  }

  return ((currentNet - previousNet) / Math.abs(previousNet)) * 100;
}

function getCountryTrend(
  rows: WalletDailySummaryRow[],
  pais: Pais,
  dateFrom: string,
  dateTo: string,
): NetProfitTrendPoint[] {
  const valuesByDate = new Map(
    rows
      .filter((row) => row.pais === pais)
      .map((row) => [row.dia, toNumber(row.neto)]),
  );
  const firstDate = parseDateInput(dateFrom)!;
  const lastDate = parseDateInput(dateTo)!;
  const trend: NetProfitTrendPoint[] = [];

  for (
    let timestamp = firstDate.getTime();
    timestamp <= lastDate.getTime();
    timestamp += DAY_IN_MILLISECONDS
  ) {
    const dia = formatDateInput(new Date(timestamp));
    trend.push({ dia, neto: valuesByDate.get(dia) ?? 0 });
  }

  return trend;
}

function getWalletDailySummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dateFrom: string,
  dateTo: string,
) {
  return (supabase as unknown as WalletDailySummaryRpcClient).rpc(
    "wallet_daily_summary",
    {
      p_date_from: dateFrom,
      p_date_to: dateTo,
    },
  );
}

function getDineroEnLaCalle(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  return (supabase as unknown as DineroEnLaCalleRpcClient).rpc(
    "dinero_en_la_calle",
  );
}

export default async function CommandCenterFinanzasPage({
  searchParams,
}: CommandCenterFinanzasPageProps) {
  const params = await searchParams;
  const { currentRange, dateFrom, dateTo } = getSelectedDateRange(params);
  const previousDateRange = getPreviousDateRange(dateFrom, dateTo);
  const supabase = await createClient();
  const [
    walletSummaryResult,
    dailySummaryResult,
    previousDailySummaryResult,
    dineroEnLaCalleResult,
  ] = await Promise.all([
    supabase.rpc("wallet_summary", {
      p_date_from: dateFrom,
      p_date_to: dateTo,
    }),
    getWalletDailySummary(supabase, dateFrom, dateTo),
    getWalletDailySummary(
      supabase,
      previousDateRange.dateFrom,
      previousDateRange.dateTo,
    ),
    getDineroEnLaCalle(supabase),
  ]);

  if (walletSummaryResult.error) {
    throw new Error(
      `No se pudo cargar el resumen financiero: ${walletSummaryResult.error.message}`,
    );
  }

  if (dailySummaryResult.error) {
    throw new Error(
      `No se pudo cargar la tendencia financiera: ${dailySummaryResult.error.message}`,
    );
  }

  if (previousDailySummaryResult.error) {
    throw new Error(
      `No se pudo cargar el período anterior: ${previousDailySummaryResult.error.message}`,
    );
  }

  if (dineroEnLaCalleResult.error) {
    throw new Error(
      `No se pudo cargar el dinero en la calle: ${dineroEnLaCalleResult.error.message}`,
    );
  }

  const summaryRows = walletSummaryResult.data ?? [];
  const dailySummaryRows = dailySummaryResult.data ?? [];
  const previousDailySummaryRows = previousDailySummaryResult.data ?? [];
  const dineroEnLaCalleRows = dineroEnLaCalleResult.data ?? [];

  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Torre de control
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            Finanzas
          </h1>
          <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
            Utilidad operativa por país, separada de las recargas y retiros de
            capital.
          </p>
          <p className="mt-2 font-mono text-xs tabular-nums text-text-secondary">
            {dateFrom} - {dateTo}
          </p>
        </div>

        <DateRangeSelector
          currentRange={currentRange}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      </div>

      <section className="mt-6" aria-labelledby="operational-profit-heading">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Operación
          </p>
          <h2
            id="operational-profit-heading"
            className="mt-2 font-display text-xl font-semibold text-text-primary"
          >
            Utilidad operativa neta
          </h2>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {countries.map((pais) => {
            const totals = getCountryTotals(
              getRowsByCountry(summaryRows, pais),
            );
            const currentDailyNet = getCountryDailyNet(dailySummaryRows, pais);
            const previousDailyNet = getCountryDailyNet(
              previousDailySummaryRows,
              pais,
            );

            return (
              <NetProfitCard
                key={pais}
                pais={pais}
                entradasOperativas={totals.entradasOperativas}
                salidasOperativas={totals.salidasOperativas}
                hasMovements={totals.hasOperationalMovements}
                trendData={getCountryTrend(
                  dailySummaryRows,
                  pais,
                  dateFrom,
                  dateTo,
                )}
                comparisonPercentage={getComparisonPercentage(
                  currentDailyNet,
                  previousDailyNet,
                )}
              />
            );
          })}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="street-money-heading">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Foto actual, sin filtro de fechas
          </p>
          <h2
            id="street-money-heading"
            className="mt-2 font-display text-xl font-semibold text-text-primary"
          >
            Dinero en la calle
          </h2>
          <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
            Ganancia esperada de los pedidos confirmados que siguen en tránsito.
            Este snapshot no cambia con el rango de fechas seleccionado.
          </p>
        </div>

        <div className="mt-4">
          <DineroEnLaCalleTable rows={dineroEnLaCalleRows} />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="capital-movements-heading">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Fuera de la operación
          </p>
          <h2
            id="capital-movements-heading"
            className="mt-2 font-display text-xl font-semibold text-text-primary"
          >
            Movimientos de capital (no cuentan como ganancia)
          </h2>
          <p className="mt-2 font-body text-sm text-text-secondary">
            Dinero ingresado o retirado por el dueño, mostrado sin mezclarlo
            con la utilidad operativa.
          </p>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {countries.map((pais) => {
            const totals = getCountryTotals(
              getRowsByCountry(summaryRows, pais),
            );

            return (
              <CapitalMovementsCard
                key={pais}
                pais={pais}
                recargas={totals.recargas}
                retiros={totals.retiros}
                hasMovements={totals.hasCapitalMovements}
              />
            );
          })}
        </div>
      </section>

      <div className="mt-8 grid gap-4 xl:grid-cols-2">
        {countries.map((pais) => (
          <MovementBreakdownTable
            key={pais}
            pais={pais}
            rows={getRowsByCountry(summaryRows, pais)}
          />
        ))}
      </div>
    </section>
  );
}
