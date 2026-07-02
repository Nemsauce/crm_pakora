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
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[38rem] border-separate border-spacing-0">
            <thead>
              <tr className="text-left font-body text-xs text-text-secondary">
                <th className="border-b border-border pb-3 font-medium">
                  Categoría
                </th>
                <th className="border-b border-border pb-3 text-right font-medium">
                  Entrada
                </th>
                <th className="border-b border-border pb-3 text-right font-medium">
                  Salida
                </th>
                <th className="border-b border-border pb-3 text-right font-medium">
                  Neto
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((row) => {
                const netTone = row.net < 0 ? "text-negative" : "text-positive";

                return (
                  <tr key={row.categoria ?? "sin_categoria"}>
                    <td className="border-b border-border py-3 pr-4">
                      <span className="rounded-full bg-bg-page px-3 py-1 font-body text-xs font-semibold text-text-primary">
                        {getCategoryLabel(row.categoria)}
                      </span>
                    </td>
                    <td className="border-b border-border py-3 text-right font-mono text-sm tabular-nums text-risk-low">
                      {formatCurrency(pais, row.entradas)}
                    </td>
                    <td className="border-b border-border py-3 text-right font-mono text-sm tabular-nums text-risk-high">
                      {formatCurrency(pais, row.salidas)}
                    </td>
                    <td
                      className={`border-b border-border py-3 text-right font-mono text-sm font-semibold tabular-nums ${netTone}`}
                    >
                      {formatCurrency(pais, row.net)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-bg-page p-4 font-body text-sm text-text-secondary">
          Sin movimientos en este rango.
        </div>
      )}
    </section>
  );
}
