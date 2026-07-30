"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock3,
  Eye,
  Loader2,
  PackageCheck,
  Phone,
  Truck,
  User,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "radix-ui";
import {
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import { reassignTask, snoozeTask } from "@/app/(app)/tareas/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getDisplayName } from "@/lib/profiles/getDisplayName";
import type { Database, Tables } from "@/lib/supabase/database.types";

type Task = Tables<"tasks">;
type Order = Pick<
  Tables<"orders">,
  "id" | "nombre" | "apellido" | "numero_orden" | "pais"
>;
type AssigneeOption = Pick<Tables<"profiles">, "id" | "email" | "nombre">;
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
  pendiente:
    "bg-[var(--color-risk-medium-bg)] text-[var(--color-risk-medium)]",
  en_progreso:
    "bg-[var(--color-bg-selected)] text-[var(--color-accent)]",
  completada: "bg-[var(--color-positive-bg)] text-[var(--color-positive)]",
  cancelada: "bg-[var(--color-negative-bg)] text-[var(--color-negative)]",
};

const UNASSIGNED_VALUE = "sin_asignar";
const TASK_COMPLETED_EVENT = "crm:task-completed";

type TaskCompletedEventDetail = {
  collapse: boolean;
  taskId: number;
};

type ActionFeedback = {
  message: string;
  type: "error" | "success";
};

type SnoozeOption = "one_hour" | "three_hours" | "tomorrow";

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const snoozeTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
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

function getDeadline(value: string | null, estado: TaskState) {
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
    isOverdue: estado !== "completada" && date.getTime() < Date.now(),
  };
}

function getCompletionLabel(task: Task, assigneeOptions: AssigneeOption[]) {
  if (!task.completado_en) {
    return "Completada";
  }

  const date = new Date(task.completado_en);
  const dateLabel = Number.isNaN(date.getTime())
    ? "Fecha inválida"
    : dateTimeFormatter.format(date);

  return task.completado_por
    ? `Completada ${dateLabel} · ${getDisplayName(
        assigneeOptions,
        task.completado_por,
      )}`
    : `Completada ${dateLabel}`;
}

function buildDetailHref(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function stopKeyPropagation(event: KeyboardEvent<HTMLElement>) {
  event.stopPropagation();
}

function getTomorrowAtNineInBogota() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day + 1, 14));
}

function getSnoozeUntil(option: SnoozeOption) {
  if (option === "one_hour") {
    return new Date(Date.now() + 60 * 60 * 1000);
  }

  if (option === "three_hours") {
    return new Date(Date.now() + 3 * 60 * 60 * 1000);
  }

  return getTomorrowAtNineInBogota();
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
  const [selectedAssignee, setSelectedAssignee] = useState(asignadoA);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  const value = selectedAssignee ?? UNASSIGNED_VALUE;
  const currentAssignee = assigneeOptions.find(
    (option) => option.id === selectedAssignee,
  );
  const currentLabel = currentAssignee
    ? getDisplayName(assigneeOptions, currentAssignee.email)
    : "Sin asignar";

  useEffect(() => {
    if (!feedback || feedback.type === "error") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback(null);
      router.refresh();
    }, 3_000);
    return () => window.clearTimeout(timeoutId);
  }, [feedback, router]);

  function handleChange(nextValue: string) {
    const userId = nextValue === UNASSIGNED_VALUE ? null : nextValue;
    setFeedback(null);

    startTransition(async () => {
      try {
        const result = await reassignTask(taskId, userId);

        if (result.error) {
          setFeedback({ message: result.error, type: "error" });
          return;
        }

        setSelectedAssignee(userId);
        setFeedback({ message: "Reasignado", type: "success" });
      } catch {
        setFeedback({
          message: "No se pudo reasignar la tarea.",
          type: "error",
        });
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Select.Root value={value} onValueChange={handleChange} disabled={isPending}>
        <Select.Trigger
          className="inline-flex h-8 min-w-0 max-w-full items-center gap-2 rounded-full border border-border bg-[var(--color-bg-surface-elevated)] px-3 font-body text-xs font-semibold text-[var(--foreground)] outline-none transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus:ring-2 focus:ring-ring disabled:opacity-60"
          aria-label="Asignado a"
        >
          <User
            className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]"
            aria-hidden="true"
          />
          <span className="max-w-36 truncate">
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
            className="z-[var(--z-index-dropdown-popover)] overflow-hidden rounded-xl border border-border bg-[var(--color-bg-surface-elevated)] text-[var(--foreground)] shadow-md"
          >
            <Select.Viewport className="p-1">
              <Select.Item
                value={UNASSIGNED_VALUE}
                className="relative flex h-8 cursor-default select-none items-center rounded-lg px-2 font-body text-sm text-[var(--foreground)] outline-none data-[highlighted]:bg-[var(--color-bg-selected)] data-[highlighted]:text-[var(--color-accent)]"
              >
                <Select.ItemText>Sin asignar</Select.ItemText>
              </Select.Item>
              {assigneeOptions.map((option) => (
                <Select.Item
                  key={option.id}
                  value={option.id}
                  className="relative flex h-8 cursor-default select-none items-center rounded-lg px-2 font-body text-sm text-[var(--foreground)] outline-none data-[highlighted]:bg-[var(--color-bg-selected)] data-[highlighted]:text-[var(--color-accent)]"
                >
                  <Select.ItemText>
                    {getDisplayName(assigneeOptions, option.email)}
                  </Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {feedback ? (
        <span
          role={feedback.type === "error" ? "alert" : "status"}
          className={`font-body text-xs ${
            feedback.type === "error"
              ? "text-[var(--color-negative)]"
              : "text-[var(--color-positive)]"
          }`}
        >
          {feedback.message}
        </span>
      ) : null}
    </div>
  );
}

function SnoozeTaskControl({
  taskId,
  onSnoozed,
}: {
  taskId: number;
  onSnoozed?: (taskId: number) => void;
}) {
  const router = useRouter();
  const [isSnoozing, startSnoozing] = useTransition();
  const [isWaitingToRefresh, setIsWaitingToRefresh] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  function handleSnooze(option: SnoozeOption) {
    const snoozeUntil = getSnoozeUntil(option);
    setFeedback(null);

    startSnoozing(async () => {
      try {
        const result = await snoozeTask(taskId, snoozeUntil);

        if (result.error) {
          setFeedback({ message: result.error, type: "error" });
          return;
        }

        setIsWaitingToRefresh(true);
        setFeedback({
          message: `Pospuesta hasta las ${snoozeTimeFormatter.format(snoozeUntil)}`,
          type: "success",
        });
        refreshTimeoutRef.current = window.setTimeout(() => {
          onSnoozed?.(taskId);
          router.refresh();
          setIsWaitingToRefresh(false);
          setFeedback(null);
          refreshTimeoutRef.current = null;
        }, 3_000);
      } catch {
        setFeedback({
          message: "No se pudo posponer la tarea.",
          type: "error",
        });
      }
    });
  }

  const isBusy = isSnoozing || isWaitingToRefresh;

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            className="h-8 rounded-full border-border bg-[var(--color-bg-surface-elevated)] px-3 text-[var(--foreground)] transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--foreground)] disabled:opacity-60"
          >
            {isSnoozing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Clock3 className="h-4 w-4" aria-hidden="true" />
            )}
            Posponer
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="z-[var(--z-index-dropdown-popover)] min-w-40 rounded-xl border border-border bg-[var(--color-bg-surface-elevated)] p-1 text-[var(--foreground)] shadow-md"
        >
          <DropdownMenuItem
            onSelect={() => handleSnooze("one_hour")}
            className="rounded-lg font-body text-sm focus:bg-[var(--color-bg-selected)] focus:text-[var(--color-accent)]"
          >
            1 hora
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => handleSnooze("three_hours")}
            className="rounded-lg font-body text-sm focus:bg-[var(--color-bg-selected)] focus:text-[var(--color-accent)]"
          >
            3 horas
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => handleSnooze("tomorrow")}
            className="rounded-lg font-body text-sm focus:bg-[var(--color-bg-selected)] focus:text-[var(--color-accent)]"
          >
            Mañana
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {feedback ? (
        <span
          role={feedback.type === "error" ? "alert" : "status"}
          className={`font-body text-xs ${
            feedback.type === "error"
              ? "text-[var(--color-negative)]"
              : "text-[var(--color-positive)]"
          }`}
        >
          {feedback.message}
        </span>
      ) : null}
    </div>
  );
}

export function TaskRow({ task, assigneeOptions }: TaskRowProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskTone = taskTypeTone[task.tipo];
  const Icon = taskTone.icon;
  const deadline = getDeadline(task.fecha_limite, task.estado);
  const isCompleted = task.estado === "completada";
  const orderId = task.orders?.id ?? null;
  const selectedOrderId = searchParams.get("detalle");
  const selectedTaskId = searchParams.get("tareaId");
  const selected =
    orderId !== null &&
    selectedOrderId === String(orderId) &&
    (!selectedTaskId || selectedTaskId === String(task.id));
  const isSnoozedView = searchParams.get("estado_vista") === "pospuestas";
  const [completionAnimation, setCompletionAnimation] = useState<
    "idle" | "checked" | "leaving"
  >("idle");
  const completionAnimationTimeoutRef = useRef<number | null>(null);
  const showCompletionCheck = completionAnimation !== "idle";
  const isLeaving = completionAnimation === "leaving";

  useEffect(() => {
    function handleTaskCompleted(event: Event) {
      const { detail } = event as CustomEvent<TaskCompletedEventDetail>;

      if (detail.taskId !== task.id) {
        return;
      }

      if (completionAnimationTimeoutRef.current !== null) {
        window.clearTimeout(completionAnimationTimeoutRef.current);
      }

      if (detail.collapse) {
        setCompletionAnimation("leaving");
        return;
      }

      setCompletionAnimation("checked");
      completionAnimationTimeoutRef.current = window.setTimeout(() => {
        setCompletionAnimation("idle");
        completionAnimationTimeoutRef.current = null;
      }, 600);
    }

    window.addEventListener(TASK_COMPLETED_EVENT, handleTaskCompleted);

    return () => {
      window.removeEventListener(TASK_COMPLETED_EVENT, handleTaskCompleted);

      if (completionAnimationTimeoutRef.current !== null) {
        window.clearTimeout(completionAnimationTimeoutRef.current);
      }
    };
  }, [task.id]);

  function toggleDetail() {
    if (orderId === null) {
      return;
    }

    const params = new URLSearchParams(searchParams);
    const isSameTaskSelected =
      params.get("detalle") === String(orderId) &&
      params.get("tareaId") === String(task.id);

    if (isSameTaskSelected) {
      params.delete("detalle");
      params.delete("tareaId");
    } else {
      params.set("detalle", String(orderId));
      params.set("tareaId", String(task.id));
    }

    router.push(buildDetailHref(pathname, params), { scroll: false });
  }

  function handleTaskSnoozed() {
    if (!selected || isSnoozedView) {
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.delete("detalle");
    params.delete("tareaId");
    router.push(buildDetailHref(pathname, params), { scroll: false });
  }

  const deadlineText = isCompleted
    ? getCompletionLabel(task, assigneeOptions)
    : `${deadline.isOverdue ? "Vencida" : "Vence"} · ${deadline.label}`;

  return (
    <article
      role="listitem"
      className={`overflow-hidden text-[var(--foreground)] transition-[max-height,opacity,transform] duration-[var(--motion-duration-task-completion)] ease-out motion-reduce:transition-none ${
        isLeaving
          ? "pointer-events-none max-h-0 scale-[0.98] opacity-0"
          : "max-h-[40rem]"
      }`}
    >
      <div
        className={`relative min-h-[var(--density-row-height-compact)] rounded-xl border bg-[var(--color-bg-surface-elevated)] p-3 transition-[background-color,border-color,box-shadow] duration-[var(--motion-duration-hover-focus)] motion-reduce:transition-none ${
          deadline.isOverdue
            ? "border-l-4 border-l-[var(--color-negative)]"
            : isCompleted
              ? "border-l-4 border-l-[var(--color-positive)]"
              : ""
        } ${
          selected
            ? "border-[var(--color-border-selected)] bg-[var(--color-bg-selected)] ring-2 ring-[var(--color-border-selected)] ring-offset-1 ring-offset-[var(--color-bg-surface-base)]"
            : "border-border"
        }`}
      >
        {orderId !== null && !isLeaving ? (
          <button
            id={`task-row-trigger-${task.id}`}
            type="button"
            aria-label={`Abrir detalle de ${task.titulo}`}
            aria-haspopup="dialog"
            aria-expanded={selected}
            aria-controls="task-detail-drawer"
            onClick={toggleDetail}
            className="absolute inset-0 z-0 cursor-pointer rounded-xl bg-transparent outline-none transition-colors duration-[var(--motion-duration-hover-focus)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
          />
        ) : null}

        {showCompletionCheck ? (
          <span role="status" className="sr-only">
            Tarea completada
          </span>
        ) : null}

        <div className="pointer-events-none relative grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="pointer-events-none relative z-[1] flex min-w-0 gap-3">
            <div
              className={`flex size-[var(--density-row-height-compact)] shrink-0 items-center justify-center rounded-full ${
                showCompletionCheck
                  ? "bg-[var(--color-positive-bg)] text-[var(--color-positive)]"
                  : taskTone.circleClassName
              }`}
              aria-hidden="true"
            >
              {showCompletionCheck ? (
                <Check className="h-5 w-5 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-[var(--motion-duration-task-completion)]" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-xs font-semibold tabular-nums ${
                    isCompleted
                      ? "bg-[var(--color-positive-bg)] text-[var(--color-positive)]"
                      : deadline.isOverdue
                        ? "bg-[var(--color-negative-bg)] text-[var(--color-negative)]"
                        : "bg-[var(--color-bg-surface-subtle)] text-[var(--muted-foreground)]"
                  }`}
                >
                  {deadlineText}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 font-body text-xs font-semibold ${taskTone.circleClassName}`}
                >
                  {taskTone.label}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 font-body text-xs font-semibold ${taskStateClassName[task.estado]}`}
                >
                  {taskStateLabel[task.estado]}
                </span>
                {task.intento_numero > 1 ? (
                  <span className="rounded-full bg-[var(--color-risk-medium-bg)] px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--color-risk-medium)]">
                    Intento {task.intento_numero}
                  </span>
                ) : null}
              </div>

              <h2 className="mt-1.5 truncate font-display text-base font-semibold text-[var(--foreground)]">
                {task.titulo}
              </h2>

              <p className="mt-0.5 truncate font-body text-sm text-[var(--muted-foreground)]">
                {getCustomerName(task.orders)}
                <span aria-hidden="true"> · </span>
                <span className="font-mono tabular-nums">
                  {getOrderIdentifier(task.orders)}
                </span>
              </p>

              {task.descripcion ? (
                <p className="mt-1 truncate font-body text-xs text-[var(--muted-foreground)]">
                  <span className="font-semibold text-[var(--foreground)]">
                    Contexto:
                  </span>{" "}
                  {task.descripcion}
                </p>
              ) : null}
            </div>
          </div>

          <div className="pointer-events-auto relative z-10 flex min-w-0 flex-wrap items-end gap-2 border-t border-border pt-3 xl:min-w-80 xl:flex-nowrap xl:justify-end xl:border-t-0 xl:border-l xl:pt-0 xl:pl-3">
            <div
              className="min-w-0"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={stopKeyPropagation}
            >
              <span className="mb-1 block font-body text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Responsable
              </span>
              <AssigneeSelect
                key={`row-assignee-${task.id}-${task.asignado_a ?? "none"}`}
                taskId={task.id}
                asignadoA={task.asignado_a}
                assigneeOptions={assigneeOptions}
              />
            </div>

            {orderId !== null ? (
              <Button
                asChild
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-border bg-[var(--color-bg-surface-elevated)] px-3 text-[var(--foreground)] transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--foreground)]"
              >
                <Link
                  href={`/pedidos?detalle=${orderId}`}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={stopKeyPropagation}
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Ver pedido
                </Link>
              </Button>
            ) : null}

            {task.estado === "pendiente" || task.estado === "en_progreso" ? (
              <div
                onClick={(event) => event.stopPropagation()}
                onKeyDown={stopKeyPropagation}
              >
                <SnoozeTaskControl
                  taskId={task.id}
                  onSnoozed={handleTaskSnoozed}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
