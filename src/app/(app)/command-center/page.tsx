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

type CommandCenterPageProps = {
  searchParams: Promise<SearchParams>;
};

type Pais = "CO" | "MX";

type WalletSummaryRpc = (
  fn: "wallet_summary",
  args: { p_date_from: string; p_date_to: string },
) => PromiseLike<{
  data: WalletSummaryRow[] | null;
  error: { message: string } | null;
}>;

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

      if (tipo === "ENTRADA") {
        totals.entradas += total;
      }

      if (tipo === "SALIDA") {
        totals.salidas += total;
      }

      return totals;
    },
    { entradas: 0, salidas: 0 },
  );
}

export default async function CommandCenterPage({
  searchParams,
}: CommandCenterPageProps) {
  const params = await searchParams;
  const range = getRange(params.range);
  const { dateFrom, dateTo } = getDateRange(Number(range));
  const supabase = await createClient();
  const { data, error } = await (
    supabase as unknown as { rpc: WalletSummaryRpc }
  ).rpc("wallet_summary", {
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });

  if (error) {
    throw new Error(`No se pudo cargar el resumen financiero: ${error.message}`);
  }

  const summaryRows = data ?? [];

  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Command Center
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            Resumen financiero
          </h1>
          <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
            Ganancia neta por país: entradas menos salidas agrupadas por
            categoría.
          </p>
          <p className="mt-2 font-mono text-xs tabular-nums text-text-secondary">
            {dateFrom} - {dateTo}
          </p>
        </div>

        <DateRangeSelector currentRange={range} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {countries.map((pais) => {
          const rows = getRowsByCountry(summaryRows, pais);
          const totals = getCountryTotals(rows);

          return (
            <NetProfitCard
              key={pais}
              pais={pais}
              entradas={totals.entradas}
              salidas={totals.salidas}
              hasMovements={rows.length > 0}
            />
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
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
