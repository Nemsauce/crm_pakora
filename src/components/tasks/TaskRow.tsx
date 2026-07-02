import {
  AlertTriangle,
  Bell,
  Check,
  Phone,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { completeTask } from "@/app/(app)/tareas/actions";
import { Button } from "@/components/ui/button";
import type { Database, Tables } from "@/lib/supabase/database.types";

type Task = Tables<"tasks">;
type Order = Pick<Tables<"orders">, "id" | "nombre" | "apellido" | "numero_orden">;
type TaskType = Database["public"]["Enums"]["tipo_tarea_enum"];
type TaskState = Database["public"]["Enums"]["estado_tarea_enum"];

export type TaskWithOrderContext = Task & {
  orders: Order | null;
};

type TaskRowProps = {
  task: TaskWithOrderContext;
};

type TaskTone = {
  label: string;
  icon: LucideIcon;
  circleClassName: string;
};

const taskTypeTone: Record<TaskType, TaskTone> = {
  llamar_confirmacion: {
    label: "Llamar confirmación",
    icon: Phone,
    circleClassName: "bg-primary/10 text-primary",
  },
  notificar_guia: {
    label: "Notificar guía",
    icon: Truck,
    circleClassName: "bg-accent-blue-bg text-accent-blue",
  },
  presionar_entrega: {
    label: "Presionar entrega",
    icon: AlertTriangle,
    circleClassName: "bg-risk-medium-bg text-risk-medium",
  },
  notificar_proximo_llegar: {
    label: "Próximo a llegar",
    icon: Bell,
    circleClassName: "bg-risk-low-bg text-risk-low",
  },
  resolver_novedad: {
    label: "Resolver novedad",
    icon: AlertTriangle,
    circleClassName: "bg-risk-high-bg text-risk-high",
  },
};

const taskStateLabel: Record<TaskState, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
  cancelada: "Cancelada",
};

const taskStateClassName: Record<TaskState, string> = {
  pendiente: "bg-risk-medium-bg text-risk-medium",
  en_progreso: "bg-primary/10 text-primary",
  completada: "bg-risk-low-bg text-risk-low",
  cancelada: "bg-risk-high-bg text-risk-high",
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function getCustomerName(order: Order | null) {
  if (!order) {
    return "Pedido sin contexto";
  }

  const fullName = [order.nombre, order.apellido].filter(Boolean).join(" ");
  return fullName || "Cliente sin nombre";
}

function getOrderIdentifier(order: Order | null) {
  if (!order) {
    return "Orden no disponible";
  }

  return order.numero_orden ?? `ID ${order.id}`;
}

function getDeadline(value: string | null) {
  if (!value) {
    return {
      label: "Sin fecha límite",
      isOverdue: false,
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      label: "Fecha inválida",
      isOverdue: false,
    };
  }

  return {
    label: dateTimeFormatter.format(date),
    isOverdue: date.getTime() < Date.now(),
  };
}

export function TaskRow({ task }: TaskRowProps) {
  const taskTone = taskTypeTone[task.tipo];
  const Icon = taskTone.icon;
  const deadline = getDeadline(task.fecha_limite);

  async function completeTaskAction() {
    "use server";

    await completeTask(task.id);
  }

  return (
    <article className="rounded-2xl border border-border bg-bg-surface p-4 text-text-primary shadow-lg">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${taskTone.circleClassName}`}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-bg-page px-3 py-1 font-body text-xs font-semibold text-text-primary">
                {taskTone.label}
              </span>
              <span
                className={`rounded-full px-3 py-1 font-body text-xs font-semibold ${taskStateClassName[task.estado]}`}
              >
                {taskStateLabel[task.estado]}
              </span>
              {task.intento_numero > 1 ? (
                <span className="rounded-full bg-risk-medium-bg px-3 py-1 font-mono text-xs font-semibold text-risk-medium">
                  Intento {task.intento_numero}
                </span>
              ) : null}
            </div>

            <h2 className="mt-2 font-display text-lg font-semibold text-text-primary">
              {task.titulo}
            </h2>

            <p className="mt-1 font-body text-sm text-text-secondary">
              {getCustomerName(task.orders)} ·{" "}
              <span className="font-mono tabular-nums">
                {getOrderIdentifier(task.orders)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
          <div
            className={`rounded-full px-3 py-1 font-mono text-xs font-semibold tabular-nums ${
              deadline.isOverdue
                ? "bg-risk-high-bg text-risk-high"
                : "bg-bg-page text-text-secondary"
            }`}
          >
            {deadline.isOverdue ? "Vencida " : "Vence "}
            {deadline.label}
          </div>

          <form action={completeTaskAction}>
            <Button
              type="submit"
              className="h-9 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 text-bg-surface hover:opacity-90"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Completar
            </Button>
          </form>
        </div>
      </div>
    </article>
  );
}
