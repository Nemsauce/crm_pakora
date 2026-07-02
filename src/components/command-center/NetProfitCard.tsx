import { TrendingUp, WalletCards } from "lucide-react";

type Pais = "CO" | "MX";

type NetProfitCardProps = {
  pais: Pais;
  entradas: number;
  salidas: number;
  hasMovements: boolean;
};

const countryLabel: Record<Pais, string> = {
  CO: "Colombia",
  MX: "México",
};

const currencyFormatter = {
  CO: new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }),
  MX: new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }),
} satisfies Record<Pais, Intl.NumberFormat>;

function formatCurrency(pais: Pais, value: number) {
  return currencyFormatter[pais].format(value);
}

export function NetProfitCard({
  pais,
  entradas,
  salidas,
  hasMovements,
}: NetProfitCardProps) {
  const net = entradas - salidas;
  const netTone = net < 0 ? "text-negative" : "text-positive";

  return (
    <article className="rounded-2xl border border-border bg-bg-surface p-5 text-text-primary shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            {countryLabel[pais]}
          </p>
          <h2 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Ganancia neta
          </h2>
        </div>
        <div
          className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden="true"
        >
          {hasMovements ? (
            <TrendingUp className="h-5 w-5" />
          ) : (
            <WalletCards className="h-5 w-5" />
          )}
        </div>
      </div>

      {hasMovements ? (
        <>
          <p
            className={`mt-6 font-mono text-3xl font-semibold tabular-nums ${netTone}`}
          >
            {formatCurrency(pais, net)}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-risk-low-bg p-3">
              <p className="font-body text-xs font-medium text-risk-low">
                Entradas
              </p>
              <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-risk-low">
                {formatCurrency(pais, entradas)}
              </p>
            </div>
            <div className="rounded-2xl bg-risk-high-bg p-3">
              <p className="font-body text-xs font-medium text-risk-high">
                Salidas
              </p>
              <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-risk-high">
                {formatCurrency(pais, salidas)}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-2xl bg-bg-page p-4">
          <p className="font-body text-sm font-medium text-text-primary">
            Sin movimientos en este rango
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-text-secondary">
            {formatCurrency(pais, 0)}
          </p>
        </div>
      )}
    </article>
  );
}
