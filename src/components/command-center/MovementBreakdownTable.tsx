type Pais = "CO" | "MX";

type WalletCategory =
  | "ganancia"
  | "costo_flete"
  | "devolucion_flete"
  | "indemnizacion"
  | "comision_referido"
  | "retiro"
  | "recarga"
  | "correccion"
  | "fulfillment"
  | "software"
  | "otro";

export type WalletSummaryRow = {
  pais: Pais;
  categoria: WalletCategory | null;
  tipo: string | null;
  total: number | string | null;
};

type MovementBreakdownTableProps = {
  pais: Pais;
  rows: WalletSummaryRow[];
};

const countryLabel: Record<Pais, string> = {
  CO: "Colombia",
  MX: "México",
};

const categoryLabel: Record<WalletCategory, string> = {
  ganancia: "Ganancia",
  costo_flete: "Costo de flete",
  devolucion_flete: "Devolución de flete",
  indemnizacion: "Indemnización",
  comision_referido: "Comisión de referido",
  retiro: "Retiro",
  recarga: "Recarga",
  correccion: "Corrección",
  fulfillment: "Fulfillment",
  software: "Software",
  otro: "Otro",
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

function getCategoryLabel(categoria: WalletCategory | null) {
  return categoria ? categoryLabel[categoria] : "Sin categoría";
}

export function MovementBreakdownTable({
  pais,
  rows,
}: MovementBreakdownTableProps) {
  const groupedRows = Array.from(
    rows.reduce((groupMap, row) => {
      const key = row.categoria ?? "sin_categoria";
      const current = groupMap.get(key) ?? {
        categoria: row.categoria,
        entradas: 0,
        salidas: 0,
      };
      const total = toNumber(row.total);
      const tipo = row.tipo?.toUpperCase();

      if (tipo === "ENTRADA") {
        current.entradas += total;
      }

      if (tipo === "SALIDA") {
        current.salidas += total;
      }

      groupMap.set(key, current);
      return groupMap;
    }, new Map<string, { categoria: WalletCategory | null; entradas: number; salidas: number }>()),
  )
    .map(([, row]) => ({
      ...row,
      net: row.entradas - row.salidas,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const largestAbsoluteNet = Math.max(
    ...groupedRows.map((row) => Math.abs(row.net)),
    0,
  );

  return (
    <section className="rounded-2xl border border-border bg-bg-surface p-5 text-text-primary shadow-lg">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            {countryLabel[pais]}
          </p>
          <h2 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Desglose por categoría
          </h2>
        </div>
        <p className="font-body text-sm text-text-secondary">
          Entradas, salidas y neto
        </p>
      </div>

      {groupedRows.length > 0 ? (
        <ul className="mt-5 divide-y divide-border">
          {groupedRows.map((row) => {
            const barPercentage =
              largestAbsoluteNet > 0
                ? (Math.abs(row.net) / largestAbsoluteNet) * 100
                : 0;
            const netTone =
              row.net > 0
                ? "text-positive"
                : row.net < 0
                  ? "text-negative"
                  : "text-text-secondary";
            const barTone = row.net < 0 ? "bg-negative" : "bg-positive";

            return (
              <li
                key={row.categoria ?? "sin_categoria"}
                className="py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="font-body text-sm font-semibold text-text-primary">
                    {getCategoryLabel(row.categoria)}
                  </p>
                  <p
                    className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${netTone}`}
                  >
                    {formatCurrency(pais, row.net)}
                  </p>
                </div>

                <div
                  className="mt-2 h-2.5 overflow-hidden rounded-full bg-bg-page"
                  role="meter"
                  aria-label={`Neto de ${getCategoryLabel(row.categoria)}`}
                  aria-valuenow={Math.abs(row.net)}
                  aria-valuemin={0}
                  aria-valuemax={largestAbsoluteNet || 1}
                >
                  <div
                    className={`h-full rounded-full ${barTone}`}
                    style={{ width: `${barPercentage}%` }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-xs text-text-secondary">
                  <span>
                    Entrada{" "}
                    <span className="font-mono font-medium tabular-nums text-positive">
                      {formatCurrency(pais, row.entradas)}
                    </span>
                  </span>
                  <span>
                    Salida{" "}
                    <span className="font-mono font-medium tabular-nums text-negative">
                      {formatCurrency(pais, row.salidas)}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-5 rounded-2xl bg-bg-page p-4 font-body text-sm text-text-secondary">
          Sin movimientos en este rango.
        </div>
      )}
    </section>
  );
}
