import { Landmark } from "lucide-react";

type Pais = "CO" | "MX";

type CapitalMovementsCardProps = {
  pais: Pais;
  recargas: number;
  retiros: number;
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

export function CapitalMovementsCard({
  pais,
  recargas,
  retiros,
  hasMovements,
}: CapitalMovementsCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-bg-surface p-5 text-text-primary shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            {countryLabel[pais]}
          </p>
          <h3 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Capital
          </h3>
        </div>
        <div
          className="flex size-11 items-center justify-center rounded-full bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)] ring-1 ring-[var(--color-badge-nuevo-bg)]"
          aria-hidden="true"
        >
          <Landmark className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-risk-low-bg p-4">
          <p className="font-body text-xs font-medium text-risk-low">
            Recargas a la billetera
          </p>
          <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-risk-low">
            {formatCurrency(pais, recargas)}
          </p>
        </div>
        <div className="rounded-2xl bg-risk-high-bg p-4">
          <p className="font-body text-xs font-medium text-risk-high">
            Retiros de la billetera
          </p>
          <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-risk-high">
            {formatCurrency(pais, retiros)}
          </p>
        </div>
      </div>

      {!hasMovements ? (
        <p className="mt-4 font-body text-sm text-text-secondary">
          Sin movimientos de capital en este rango.
        </p>
      ) : null}
    </article>
  );
}
