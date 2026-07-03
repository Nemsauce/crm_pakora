import { AlertTriangle, ListChecks } from "lucide-react";

type TaskSummaryBarProps = {
  total: number;
  vencidas: number;
};

export function TaskSummaryBar({ total, vencidas }: TaskSummaryBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-bg-surface px-4 py-3 shadow-sm">
      <span className="inline-flex items-center gap-2 font-body text-sm text-[var(--foreground)]">
        <ListChecks
          className="h-4 w-4 text-[var(--muted-foreground)]"
          aria-hidden="true"
        />
        <span className="font-mono font-semibold tabular-nums">{total}</span>
        {total === 1 ? "tarea pendiente" : "tareas pendientes"}
      </span>

      {vencidas > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-risk-high-bg px-3 py-1 font-body text-xs font-semibold text-risk-high">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-mono tabular-nums">{vencidas}</span>
          {vencidas === 1 ? "vencida" : "vencidas"}
        </span>
      ) : null}
    </div>
  );
}
