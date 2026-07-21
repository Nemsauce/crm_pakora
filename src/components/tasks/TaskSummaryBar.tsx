import { AlertTriangle, ListChecks } from "lucide-react";

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

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-bg-surface px-4 py-3 shadow-sm">
      <span className="inline-flex items-center gap-2 font-body text-sm text-[var(--foreground)]">
        <ListChecks
          className="h-4 w-4 text-[var(--muted-foreground)]"
          aria-hidden="true"
        />
        <span className="font-mono font-semibold tabular-nums">{total}</span>
        {total === 1 ? singular : plural}
      </span>

      {vencidas !== null && vencidas > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-risk-high-bg px-3 py-1 font-body text-xs font-semibold text-risk-high">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-mono tabular-nums">{vencidas}</span>
          {vencidas === 1 ? "vencida" : "vencidas"}
        </span>
      ) : null}
    </div>
  );
}
