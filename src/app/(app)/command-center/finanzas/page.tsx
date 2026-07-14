import { CapitalMovementsCard } from "@/components/command-center/CapitalMovementsCard";
import { DateRangeSelector } from "@/components/command-center/DateRangeSelector";
import {
  MovementBreakdownTable,
  type WalletSummaryRow,
} from "@/components/command-center/MovementBreakdownTable";
import { NetProfitCard } from "@/components/command-center/NetProfitCard";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  range?: string;
};

type CommandCenterFinanzasPageProps = {
  searchParams: Promise<SearchParams>;
};

type Pais = "CO" | "MX";

const validRanges = new Set(["7", "30", "90"]);
const countries = ["CO", "MX"] as const;

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

export default async function CommandCenterFinanzasPage({
  searchParams,
}: CommandCenterFinanzasPageProps) {
  const params = await searchParams;
  const range = getRange(params.range);
  const { dateFrom, dateTo } = getDateRange(Number(range));
  const supabase = await createClient();
  const { data: walletSummaryData, error: walletSummaryError } =
    await supabase.rpc("wallet_summary", {
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

  if (walletSummaryError) {
    throw new Error(
      `No se pudo cargar el resumen financiero: ${walletSummaryError.message}`,
    );
  }

  const summaryRows = walletSummaryData ?? [];

  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Command Center
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

        <DateRangeSelector currentRange={range} />
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

            return (
              <NetProfitCard
                key={pais}
                pais={pais}
                entradasOperativas={totals.entradasOperativas}
                salidasOperativas={totals.salidasOperativas}
                hasMovements={totals.hasOperationalMovements}
              />
            );
          })}
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
