import { TrendingUp } from "lucide-react";

type Pais = "CO" | "MX";

type NetProfitCardProps = {
  pais: Pais;
  entradasOperativas: number;
  salidasOperativas: number;
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
  entradasOperativas,
  salidasOperativas,
  hasMovements,
}: NetProfitCardProps) {
  const net = entradasOperativas - salidasOperativas;
  const netTone = net < 0 ? "text-negative" : "text-positive";

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-bg-surface p-5 text-text-primary shadow-xl">
      <svg
        className="pointer-events-none absolute bottom-0 right-0 z-0 h-[72%] w-[58%] text-[var(--color-positive)] opacity-[0.16] dark:opacity-[0.24]"
        viewBox="0 0 360 210"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient
            id={`net-profit-area-${pais}`}
            x1="180"
            y1="24"
            x2="180"
            y2="210"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="currentColor" stopOpacity="0.7" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path
          d="M0 210H360V28C334 20 318 25 301 47C282 72 266 69 245 64C219 58 201 72 184 99C166 128 146 128 125 126C98 123 82 143 66 169C48 198 25 201 0 190V210Z"
          fill={`url(#net-profit-area-${pais})`}
        />
        <path
          d="M0 190C25 201 48 198 66 169C82 143 98 123 125 126C146 128 166 128 184 99C201 72 219 58 245 64C266 69 282 72 301 47C318 25 334 20 360 28"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="2"
        />
      </svg>

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            {countryLabel[pais]}
          </p>
          <h2 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Utilidad operativa neta
          </h2>
        </div>
        <div
          className="flex size-11 items-center justify-center rounded-full bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)] ring-1 ring-[var(--color-badge-nuevo-bg)]"
          aria-hidden="true"
        >
          <TrendingUp className="h-5 w-5" />
        </div>
      </div>

      {hasMovements ? (
        <div className="relative z-10">
          <p
            className={`mt-6 font-mono text-3xl font-semibold tabular-nums ${netTone}`}
          >
            {formatCurrency(pais, net)}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-risk-low-bg p-3">
              <p className="font-body text-xs font-medium text-risk-low">
                Entradas operativas
              </p>
              <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-risk-low">
                {formatCurrency(pais, entradasOperativas)}
              </p>
            </div>
            <div className="rounded-2xl bg-risk-high-bg p-3">
              <p className="font-body text-xs font-medium text-risk-high">
                Salidas operativas
              </p>
              <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-risk-high">
                {formatCurrency(pais, salidasOperativas)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 mt-6 rounded-2xl bg-bg-page p-4">
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
