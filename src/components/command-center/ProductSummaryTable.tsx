import type { Database } from "@/lib/supabase/database.types";

export type ProductSummaryRow =
  Database["public"]["Functions"]["product_order_summary"]["Returns"][number];

type Pais = ProductSummaryRow["pais"];
type CountKey =
  | "total"
  | "pendientes"
  | "confirmados"
  | "en_transito"
  | "entregados"
  | "cancelados"
  | "devoluciones";

type ProductSummaryTableProps = {
  rows: ProductSummaryRow[];
};

const countryLabel: Record<Pais, string> = {
  CO: "Colombia",
  MX: "México",
};

const countries = ["CO", "MX"] as const satisfies readonly Pais[];

const countColumns = [
  { key: "total", label: "Total", className: "font-semibold text-text-primary" },
  { key: "pendientes", label: "Pendientes", className: "text-risk-medium" },
  { key: "confirmados", label: "Confirmados", className: "text-risk-low" },
  { key: "en_transito", label: "En tránsito", className: "text-badge-en-ruta" },
  { key: "entregados", label: "Entregados", className: "text-positive" },
  { key: "cancelados", label: "Cancelados", className: "text-risk-high" },
  { key: "devoluciones", label: "Devoluciones", className: "text-risk-high" },
] satisfies {
  key: CountKey;
  label: string;
  className: string;
}[];

const countFormatter = {
  CO: new Intl.NumberFormat("es-CO"),
  MX: new Intl.NumberFormat("es-MX"),
} satisfies Record<Pais, Intl.NumberFormat>;

function formatCount(pais: Pais, value: number) {
  return countFormatter[pais].format(value);
}

function ProductCountryTable({
  pais,
  rows,
}: {
  pais: Pais;
  rows: ProductSummaryRow[];
}) {
  return (
    <section className="rounded-2xl border border-border bg-bg-surface p-5 text-text-primary shadow-lg">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            {countryLabel[pais]}
          </p>
          <h3 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Pedidos por producto
          </h3>
        </div>
        <p className="font-body text-sm text-text-secondary">
          Total y estados críticos
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[68rem] border-separate border-spacing-0">
            <thead>
              <tr className="text-left font-body text-xs text-text-secondary">
                <th className="border-b border-border pb-3 font-medium">
                  Producto
                </th>
                {countColumns.map((column) => (
                  <th
                    key={column.key}
                    className="border-b border-border pb-3 text-right font-medium"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.pais}-${row.nombre_producto}`}>
                  <td className="border-b border-border py-3 pr-4 font-body text-sm font-medium text-text-primary">
                    {row.nombre_producto}
                  </td>
                  {countColumns.map((column) => (
                    <td
                      key={column.key}
                      className={`border-b border-border py-3 text-right font-mono text-sm tabular-nums ${column.className}`}
                    >
                      {formatCount(pais, row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-bg-page p-4 font-body text-sm text-text-secondary">
          Sin datos
        </div>
      )}
    </section>
  );
}

export function ProductSummaryTable({ rows }: ProductSummaryTableProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {countries.map((pais) => (
        <ProductCountryTable
          key={pais}
          pais={pais}
          rows={rows.filter((row) => row.pais === pais)}
        />
      ))}
    </div>
  );
}
