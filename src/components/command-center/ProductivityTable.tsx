import type { Database } from "@/lib/supabase/database.types";

type TaskType = Database["public"]["Enums"]["tipo_tarea_enum"];

export type TaskCompletionByUserRow = {
  usuario: string;
  tipo: TaskType;
  tareas_completadas: number | string | null;
};

export type TaskHandlingTimeByUserRow = {
  usuario: string;
  tareas_medidas: number | string | null;
  minutos_promedio: number | string | null;
};

type ProductivityTableProps = {
  completionRows: TaskCompletionByUserRow[];
  handlingRows: TaskHandlingTimeByUserRow[];
};

type UserProductivitySummary = {
  usuario: string;
  total: number;
  countsByType: Record<TaskType, number>;
  averageHandlingMinutes: number | null;
};

const taskTypeOrder = [
  "llamar_confirmacion",
  "notificar_guia",
  "presionar_entrega",
  "notificar_proximo_llegar",
  "resolver_novedad",
] as const satisfies readonly TaskType[];

const taskTypeDetails = {
  llamar_confirmacion: {
    label: "Llamar confirmación",
    className:
      "bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)]",
  },
  notificar_guia: {
    label: "Notificar guía",
    className:
      "bg-[var(--color-accent-blue-bg)] text-[var(--color-accent-blue)]",
  },
  presionar_entrega: {
    label: "Presionar entrega",
    className: "bg-risk-medium-bg text-risk-medium",
  },
  notificar_proximo_llegar: {
    label: "Próximo a llegar",
    className: "bg-positive-bg text-positive",
  },
  resolver_novedad: {
    label: "Resolver novedad",
    className: "bg-negative-bg text-negative",
  },
} satisfies Record<TaskType, { label: string; className: string }>;

const countFormatter = new Intl.NumberFormat("es-CO");
const minutesFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1,
});

function toFiniteNumber(value: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toCount(value: number | string | null) {
  const parsed = toFiniteNumber(value);
  return parsed === null ? 0 : Math.max(0, Math.trunc(parsed));
}

function createEmptyTaskCounts(): Record<TaskType, number> {
  return {
    llamar_confirmacion: 0,
    notificar_guia: 0,
    presionar_entrega: 0,
    notificar_proximo_llegar: 0,
    resolver_novedad: 0,
  };
}

function getUserSummaries(
  completionRows: TaskCompletionByUserRow[],
  handlingRows: TaskHandlingTimeByUserRow[],
) {
  const summariesByUser = new Map<
    string,
    Omit<UserProductivitySummary, "averageHandlingMinutes">
  >();
  const handlingByUser = new Map(
    handlingRows.map((row) => [row.usuario, row]),
  );

  for (const row of completionRows) {
    const count = toCount(row.tareas_completadas);
    const current = summariesByUser.get(row.usuario) ?? {
      usuario: row.usuario,
      total: 0,
      countsByType: createEmptyTaskCounts(),
    };

    current.total += count;
    current.countsByType[row.tipo] += count;
    summariesByUser.set(row.usuario, current);
  }

  return Array.from(summariesByUser.values())
    .map<UserProductivitySummary>((summary) => {
      const handling = handlingByUser.get(summary.usuario);
      const measuredTasks = toCount(handling?.tareas_medidas ?? null);
      const averageMinutes = toFiniteNumber(
        handling?.minutos_promedio ?? null,
      );

      return {
        ...summary,
        averageHandlingMinutes:
          measuredTasks > 0 && averageMinutes !== null
            ? Math.max(0, averageMinutes)
            : null,
      };
    })
    .sort(
      (first, second) =>
        second.total - first.total ||
        first.usuario.localeCompare(second.usuario, "es"),
    );
}

export function ProductivityTable({
  completionRows,
  handlingRows,
}: ProductivityTableProps) {
  const summaries = getUserSummaries(completionRows, handlingRows);

  if (summaries.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-bg-surface p-8 text-center font-body text-sm text-text-secondary shadow-lg">
        Sin tareas completadas en este rango.
      </div>
    );
  }

  return (
    <ul className="grid gap-3" aria-label="Productividad por usuario">
      {summaries.map((summary) => {
        const visibleTaskTypes = taskTypeOrder.filter(
          (taskType) => summary.countsByType[taskType] > 0,
        );

        return (
          <li
            key={summary.usuario}
            className="rounded-2xl border border-border bg-bg-surface p-4 text-text-primary shadow-lg sm:p-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="font-body text-xs uppercase text-text-secondary">
                  Usuario
                </p>
                <h3 className="mt-2 break-words font-display text-lg font-semibold text-text-primary [overflow-wrap:anywhere]">
                  {summary.usuario}
                </h3>
              </div>

              <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[22rem]">
                <div className="rounded-2xl bg-bg-page p-3">
                  <p className="font-body text-xs text-text-secondary">
                    Tareas completadas
                  </p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text-primary">
                    {countFormatter.format(summary.total)}
                  </p>
                </div>

                <div className="rounded-2xl bg-bg-page p-3">
                  <p className="font-body text-xs text-text-secondary">
                    Tiempo promedio
                  </p>
                  {summary.averageHandlingMinutes === null ? (
                    <p className="mt-2 font-body text-sm font-semibold text-text-secondary">
                      Sin datos aún
                    </p>
                  ) : (
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text-primary">
                      {minutesFormatter.format(
                        summary.averageHandlingMinutes,
                      )}{" "}
                      min
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              {visibleTaskTypes.map((taskType) => {
                const details = taskTypeDetails[taskType];

                return (
                  <span
                    key={taskType}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-xs font-semibold ${details.className}`}
                  >
                    <span>{details.label}:</span>
                    <span className="font-mono tabular-nums">
                      {countFormatter.format(summary.countsByType[taskType])}
                    </span>
                  </span>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
