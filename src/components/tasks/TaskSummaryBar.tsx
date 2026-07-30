import { AlertTriangle, CheckCircle2, ListChecks } from "lucide-react";

type TaskSummaryBarProps = {
  total: number;
  vencidas: number | null;
  view: "abiertas" | "completadas" | "pospuestas" | "todas";
};

const totalLabelByView: Record<TaskSummaryBarProps["view"], [string, string]> = {
  abiertas: ["tarea pendiente", "tareas pendientes"],
  completadas: ["tarea completada", "tareas completadas"],
  pospuestas: ["tarea pospuesta", "tareas pospuestas"],
  todas: ["tarea en total", "tareas en total"],
};

export function TaskSummaryBar({ total, vencidas, view }: TaskSummaryBarProps) {
  const [singular, plural] = totalLabelByView[view];
  const hasOverdueTasks = vencidas !== null && vencidas > 0;

  return (
    <section
      aria-label="Resumen de tareas"
      aria-live="polite"
      className="grid gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface-subtle)] p-2 sm:grid-cols-2"
    >
      <div className="flex min-h-[var(--density-row-height-comfortable)] items-center gap-3 rounded-xl bg-[var(--color-bg-surface-elevated)] px-3 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-bg-selected)] text-[var(--color-accent)]">
          <ListChecks className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="min-w-0 font-body text-sm text-[var(--color-text-secondary)]">
          <span className="mr-1.5 font-mono text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
            {total}
          </span>
          {total === 1 ? singular : plural}
        </p>
      </div>

      {vencidas !== null ? (
        <div
          className={`flex min-h-[var(--density-row-height-comfortable)] items-center gap-3 rounded-xl border-l-4 px-3 py-2 ${
            hasOverdueTasks
              ? "border-l-[var(--color-risk-high)] bg-[var(--color-risk-high-bg)]"
              : "border-l-[var(--color-positive)] bg-[var(--color-positive-bg)]"
          }`}
        >
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
              hasOverdueTasks
                ? "text-[var(--color-risk-high)]"
                : "text-[var(--color-positive)]"
            }`}
          >
            {hasOverdueTasks ? (
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <p
              className={`font-body text-sm font-semibold ${
                hasOverdueTasks
                  ? "text-[var(--color-risk-high)]"
                  : "text-[var(--color-positive)]"
              }`}
            >
              <span className="mr-1.5 font-mono text-lg font-bold tabular-nums">
                {vencidas}
              </span>
              {vencidas === 1 ? "tarea vencida" : "tareas vencidas"}
            </p>
            <p
              className={`font-body text-xs ${
                hasOverdueTasks
                  ? "text-[var(--color-risk-high)]"
                  : "text-[var(--color-positive)]"
              }`}
            >
              {hasOverdueTasks
                ? "Requieren atención inmediata"
                : "Sin atrasos en esta vista"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[var(--density-row-height-comfortable)] items-center gap-3 rounded-xl bg-[var(--color-bg-surface-elevated)] px-3 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-positive-bg)] text-[var(--color-positive)]">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="font-body text-sm text-[var(--color-text-secondary)]">
            Vista histórica de tareas completadas
          </p>
        </div>
      )}
    </section>
  );
}
