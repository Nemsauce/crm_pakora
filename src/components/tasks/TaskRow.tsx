"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  PackageCheck,
  Phone,
  Truck,
  User,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select } from "radix-ui";

import { completeTask, reassignTask } from "@/app/(app)/tareas/actions";
import { Button } from "@/components/ui/button";
import type { Database, Tables } from "@/lib/supabase/database.types";

type Task = Tables<"tasks">;
type Order = Pick<Tables<"orders">, "id" | "nombre" | "apellido" | "numero_orden">;
type AssigneeOption = Pick<Tables<"profiles">, "id" | "email">;
type TaskType = Database["public"]["Enums"]["tipo_tarea_enum"];
type TaskState = Database["public"]["Enums"]["estado_tarea_enum"];

export type TaskWithOrderContext = Task & {
  orders: Order | null;
};

type TaskRowProps = {
  task: TaskWithOrderContext;
  assigneeOptions: AssigneeOption[];
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
    circleClassName:
      "bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)]",
  },
  notificar_guia: {
    label: "Notificar guía",
    icon: Truck,
    circleClassName:
      "bg-[var(--color-accent-blue-bg)] text-[var(--color-accent-blue)]",
  },
  presionar_entrega: {
    label: "Presionar entrega",
    icon: AlertTriangle,
    circleClassName:
      "bg-[var(--color-risk-medium-bg)] text-[var(--color-risk-medium)]",
  },
  notificar_proximo_llegar: {
    label: "Próximo a llegar",
    icon: PackageCheck,
    circleClassName:
      "bg-[var(--color-positive-bg)] text-[var(--color-positive)]",
  },
  resolver_novedad: {
    label: "Resolver novedad",
    icon: AlertTriangle,
    circleClassName:
      "bg-[var(--color-negative-bg)] text-[var(--color-negative)]",
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
  en_progreso: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  completada: "bg-risk-low-bg text-risk-low",
  cancelada: "bg-risk-high-bg text-risk-high",
};

const UNASSIGNED_VALUE = "sin_asignar";

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

function getCompletionLabel(task: Task) {
  if (!task.completado_en) {
    return "Completada";
  }

  const date = new Date(task.completado_en);
  const dateLabel = Number.isNaN(date.getTime())
    ? "Fecha inválida"
    : dateTimeFormatter.format(date);

  return task.completado_por
    ? `Completada ${dateLabel} · ${task.completado_por}`
    : `Completada ${dateLabel}`;
}

function AssigneeSelect({
  taskId,
  asignadoA,
  assigneeOptions,
}: {
  taskId: number;
  asignadoA: string | null;
  assigneeOptions: AssigneeOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const value = asignadoA ?? UNASSIGNED_VALUE;
  const currentLabel =
    assigneeOptions.find((option) => option.id === asignadoA)?.email ??
    "Sin asignar";

  function handleChange(nextValue: string) {
    const userId = nextValue === UNASSIGNED_VALUE ? null : nextValue;

    startTransition(async () => {
      await reassignTask(taskId, userId);
      router.refresh();
    });
  }

  return (
    <Select.Root value={value} onValueChange={handleChange} disabled={isPending}>
      <Select.Trigger
        className="inline-flex h-9 min-w-0 items-center gap-2 rounded-full border border-border bg-bg-page px-3 font-body text-xs font-semibold text-[var(--foreground)] outline-none transition-colors hover:bg-bg-surface focus:ring-2 focus:ring-ring disabled:opacity-60"
        aria-label="Asignado a"
      >
        <User
          className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]"
          aria-hidden="true"
        />
        <span className="max-w-40 truncate">
          <Select.Value>{currentLabel}</Select.Value>
        </span>
        <Select.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-50 overflow-hidden rounded-2xl border border-border bg-bg-surface text-[var(--foreground)] shadow-md"
        >
          <Select.Viewport className="p-1">
            <Select.Item
              value={UNASSIGNED_VALUE}
              className="relative flex h-8 cursor-default select-none items-center rounded-lg px-2 font-body text-sm text-[var(--foreground)] outline-none data-[highlighted]:bg-[var(--color-accent)]/10 data-[highlighted]:text-[var(--color-accent)]"
            >
              <Select.ItemText>Sin asignar</Select.ItemText>
            </Select.Item>
            {assigneeOptions.map((option) => (
              <Select.Item
                key={option.id}
                value={option.id}
                className="relative flex h-8 cursor-default select-none items-center rounded-lg px-2 font-body text-sm text-[var(--foreground)] outline-none data-[highlighted]:bg-[var(--color-accent)]/10 data-[highlighted]:text-[var(--color-accent)]"
              >
                <Select.ItemText>{option.email}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export function TaskRow({ task, assigneeOptions }: TaskRowProps) {
  const router = useRouter();
  const taskTone = taskTypeTone[task.tipo];
  const Icon = taskTone.icon;
  const deadline = getDeadline(task.fecha_limite);
  const isCompleted = task.estado === "completada";
  const [isCompleting, startCompleting] = useTransition();

  function handleComplete() {
    startCompleting(async () => {
      await completeTask(task.id);
      router.refresh();
    });
  }

  return (
    <article
      className={`rounded-2xl border border-border bg-bg-surface p-4 text-[var(--foreground)] shadow-lg ${
        isCompleted ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-full ${taskTone.circleClassName}`}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-bg-page px-3 py-1 font-body text-xs font-semibold text-[var(--foreground)]">
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
              <AssigneeSelect
                taskId={task.id}
                asignadoA={task.asignado_a}
                assigneeOptions={assigneeOptions}
              />
            </div>

            <h2 className="mt-2 font-display text-lg font-semibold text-[var(--foreground)]">
              {task.titulo}
            </h2>

            <p className="mt-1 font-body text-sm text-[var(--muted-foreground)]">
              {getCustomerName(task.orders)} ·{" "}
              <span className="font-mono tabular-nums">
                {getOrderIdentifier(task.orders)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
          {isCompleted ? (
            <div className="rounded-full bg-risk-low-bg px-3 py-1 font-mono text-xs font-semibold tabular-nums text-risk-low">
              {getCompletionLabel(task)}
            </div>
          ) : (
            <>
              <div
                className={`rounded-full px-3 py-1 font-mono text-xs font-semibold tabular-nums ${
                  deadline.isOverdue
                    ? "bg-risk-high-bg text-risk-high"
                    : "bg-bg-page text-[var(--muted-foreground)]"
                }`}
              >
                {deadline.isOverdue ? "Vencida " : "Vence "}
                {deadline.label}
              </div>

              <Button
                type="button"
                disabled={isCompleting}
                onClick={handleComplete}
                className="h-9 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 text-bg-surface hover:opacity-90 disabled:opacity-60"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Completar
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
