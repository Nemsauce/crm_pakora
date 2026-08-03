import type { Database } from "@/lib/supabase/database.types";
import { getDisplayName } from "@/lib/profiles/getDisplayName";
import { createClient } from "@/lib/supabase/server";

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

export async function ProductivityTable({
  completionRows,
  handlingRows,
}: ProductivityTableProps) {
  const summaries = getUserSummaries(completionRows, handlingRows);

  if (summaries.length === 0) {
    return (
      <div className="rounded-xl border border-transparent bg-[var(--color-bg-surface-elevated)] p-8 text-center font-body text-sm text-text-secondary shadow-sm">
        Sin tareas completadas en este rango.
      </div>
    );
  }

  const supabase = await createClient();
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, nombre")
    .eq("activo", true);

  if (profilesError) {
    console.error(
      `No se pudieron cargar los nombres de perfiles: ${profilesError.message}`,
    );
  }

  return (
    <ul className="grid gap-2" aria-label="Productividad por usuario">
      {summaries.map((summary) => {
        const visibleTaskTypes = taskTypeOrder.filter(
          (taskType) => summary.countsByType[taskType] > 0,
        );

        return (
          <li
            key={summary.usuario}
            className="min-h-[var(--density-row-height-compact)] rounded-xl border border-transparent bg-[var(--color-bg-surface-elevated)] p-3 text-text-primary shadow-sm sm:p-4"
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(9rem,0.55fr)_minmax(11rem,0.7fr)] lg:items-center">
              <div className="min-w-0">
                <p className="font-body text-xs uppercase text-text-secondary">
                  Usuario
                </p>
                <h3 className="mt-1 break-words font-display text-base font-semibold text-text-primary [overflow-wrap:anywhere]">
                  {getDisplayName(profiles ?? [], summary.usuario)}
                </h3>
              </div>

              <div className="rounded-lg bg-[var(--color-bg-surface-subtle)] px-3 py-2.5">
                <p className="font-body text-xs text-text-secondary">
                  Tareas completadas
                </p>
                <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-text-primary">
                  {countFormatter.format(summary.total)}
                </p>
              </div>

              <div className="rounded-lg bg-[var(--color-bg-surface-subtle)] px-3 py-2.5">
                <p className="font-body text-xs text-text-secondary">
                  Tiempo promedio
                </p>
                {summary.averageHandlingMinutes === null ? (
                  <p className="mt-1 font-body text-sm font-semibold text-text-secondary">
                    Sin datos aún
                  </p>
                ) : (
                  <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-text-primary">
                    {minutesFormatter.format(summary.averageHandlingMinutes)}{" "}
                    min
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 rounded-lg bg-[var(--color-bg-surface-subtle)] p-2.5">
              {visibleTaskTypes.map((taskType) => {
                const details = taskTypeDetails[taskType];

                return (
                  <span
                    key={taskType}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-body text-xs font-semibold ${details.className}`}
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
