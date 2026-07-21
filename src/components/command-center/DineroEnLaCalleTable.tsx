type Pais = "CO" | "MX";

export type DineroEnLaCalleRow = {
  pais: Pais;
  nombre_producto: string;
  pedidos_por_entregar: number | string | null;
  dinero_en_la_calle: number | string | null;
};

type DineroEnLaCalleTableProps = {
  rows: DineroEnLaCalleRow[];
};

const countries = ["CO", "MX"] as const;

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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
} satisfies Record<Pais, Intl.NumberFormat>;

const orderCountFormatter = {
  CO: new Intl.NumberFormat("es-CO"),
  MX: new Intl.NumberFormat("es-MX"),
} satisfies Record<Pais, Intl.NumberFormat>;

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

function formatCurrency(pais: Pais, value: number) {
  return currencyFormatter[pais].format(value);
}

function CountryStreetMoneyCard({
  pais,
  rows,
}: {
  pais: Pais;
  rows: DineroEnLaCalleRow[];
}) {
  const sortedRows = rows
    .filter((row) => row.pais === pais)
    .sort(
      (a, b) =>
        toNumber(b.dinero_en_la_calle) -
        toNumber(a.dinero_en_la_calle),
    );
  const total = sortedRows.reduce(
    (sum, row) => sum + toNumber(row.dinero_en_la_calle),
    0,
  );
  const headingId = `dinero-en-la-calle-${pais.toLowerCase()}`;

  return (
    <section
      className="min-w-0 rounded-2xl border border-border bg-bg-surface p-5 text-text-primary shadow-lg"
      aria-labelledby={headingId}
    >
      <div>
        <p className="font-body text-xs uppercase text-text-secondary">
          {countryLabel[pais]}
        </p>
        <h3
          id={headingId}
          className="mt-2 font-display text-lg font-semibold text-text-primary"
        >
          Dinero en la calle
        </h3>
      </div>

      <p className="mt-5 font-mono text-3xl font-semibold tabular-nums text-text-primary">
        {formatCurrency(pais, total)}
      </p>
      <p className="mt-1 font-body text-sm text-text-secondary">
        Total actual pendiente de entrega
      </p>

      {sortedRows.length > 0 ? (
        <div className="mt-5">
          <div className="hidden grid-cols-[minmax(0,1fr)_9.5rem_10.5rem] gap-4 border-b border-border pb-3 font-body text-xs uppercase text-text-secondary sm:grid">
            <p>Producto</p>
            <p className="text-right">Pedidos por entregar</p>
            <p className="text-right">Dinero en la calle</p>
          </div>

          <ul
            className="divide-y divide-border"
            aria-label={`Pedidos y dinero en la calle por producto en ${countryLabel[pais]}`}
          >
            {sortedRows.map((row) => (
              <li
                key={`${row.pais}-${row.nombre_producto}`}
                className="py-4 first:pt-0 sm:grid sm:grid-cols-[minmax(0,1fr)_9.5rem_10.5rem] sm:items-center sm:gap-4 sm:first:pt-4"
              >
                <p className="min-w-0 break-words font-body text-sm font-medium text-text-primary">
                  {row.nombre_producto}
                </p>
                <div className="mt-3 flex items-center justify-between gap-4 sm:mt-0 sm:block sm:text-right">
                  <span className="font-body text-xs text-text-secondary sm:sr-only">
                    Pedidos por entregar
                  </span>
                  <span className="font-mono text-sm tabular-nums text-text-secondary">
                    {orderCountFormatter[pais].format(
                      toNumber(row.pedidos_por_entregar),
                    )}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4 sm:mt-0 sm:block sm:text-right">
                  <span className="font-body text-xs text-text-secondary sm:sr-only">
                    Dinero en la calle
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
                    {formatCurrency(
                      pais,
                      toNumber(row.dinero_en_la_calle),
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-bg-page p-4 font-body text-sm text-text-secondary">
          Sin pedidos en tránsito pendientes de entrega.
        </div>
      )}
    </section>
  );
}

export function DineroEnLaCalleTable({
  rows,
}: DineroEnLaCalleTableProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {countries.map((pais) => (
        <CountryStreetMoneyCard key={pais} pais={pais} rows={rows} />
      ))}
    </div>
  );
}
