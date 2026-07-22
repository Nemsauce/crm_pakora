"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Eye,
  Loader2,
  MessageCircle,
  PackageCheck,
  Phone,
  Truck,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Collapsible, Dialog, Select } from "radix-ui";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  completeTask,
  logTaskHandlingOpen,
  reassignTask,
  snoozeTask,
} from "@/app/(app)/tareas/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { buildTaskWhatsAppMessage } from "@/lib/whatsapp/buildTaskMessage";
import { formatPhoneForWhatsApp } from "@/lib/whatsapp/formatPhoneForWhatsApp";

type Order = Tables<"orders">;
type StatusHistory = Tables<"status_history">;
type Task = Tables<"tasks">;
type Comentario = Tables<"comentarios">;
type AssigneeOption = Pick<Tables<"profiles">, "id" | "email">;
type RowOrder = Pick<
  Order,
  "id" | "nombre" | "apellido" | "numero_orden" | "pais"
>;
type TaskType = Database["public"]["Enums"]["tipo_tarea_enum"];
type TaskState = Database["public"]["Enums"]["estado_tarea_enum"];

export type TaskWithOrderContext = Task & {
  orders: RowOrder | null;
};

type VisibleTaskSelection = {
  taskId: number;
  orderId: number | null;
};

type OrderDetail = {
  order: Order;
  statusHistory: StatusHistory[];
  tasks: Task[];
  comentarios: Comentario[];
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
const TASK_COMPLETED_EVENT = "crm:task-completed";

type TaskCompletedEventDetail = {
  collapse: boolean;
  taskId: number;
};

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

type ActionFeedback = {
  message: string;
  type: "error" | "success";
};

function getCustomerName(order: Pick<Order, "nombre" | "apellido"> | null) {
  if (!order) {
    return "Pedido sin contexto";
  }

  const fullName = [order.nombre, order.apellido].filter(Boolean).join(" ");
  return fullName || "Cliente sin nombre";
}

function getOrderIdentifier(order: Pick<Order, "id" | "numero_orden"> | null) {
  if (!order) {
    return "Orden no disponible";
  }

  return order.numero_orden ?? `ID ${order.id}`;
}

export function getTaskTypeLabel(value: TaskType) {
  return taskTypeTone[value].label;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return dateTimeFormatter.format(date);
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

function stopKeyPropagation(event: KeyboardEvent<HTMLElement>) {
  event.stopPropagation();
}

function getWhatsappNumber(order: Pick<Order, "telefono" | "pais">) {
  const telefono = order.telefono?.trim() ?? "";

  if (!telefono) {
    return null;
  }

  return formatPhoneForWhatsApp(telefono, order.pais) || null;
}

function buildDetailHref(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function DropiIdCopyButton({
  idOrdenDropi,
}: {
  idOrdenDropi: number | string | null | undefined;
}) {
  const [copied, setCopied] = useState(false);

  if (idOrdenDropi === null || idOrdenDropi === undefined) {
    return null;
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(String(idOrdenDropi));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-bg-page px-2.5 font-mono text-xs font-semibold tabular-nums text-[var(--foreground)] outline-none transition-colors hover:bg-bg-surface focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Copiar ID Dropi ${idOrdenDropi}`}
    >
      <span>ID Dropi {idOrdenDropi}</span>
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-risk-low" aria-hidden="true" />
          <span className="font-body text-risk-low">Copiado</span>
        </>
      ) : (
        <Copy
          className="h-3.5 w-3.5 text-[var(--muted-foreground)]"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function AssigneeSelect({
  taskId,
  asignadoA,
  assigneeOptions,
  onReassigned,
}: {
  taskId: number;
  asignadoA: string | null;
  assigneeOptions: AssigneeOption[];
  onReassigned?: (taskId: number, userId: string | null) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedAssignee, setSelectedAssignee] = useState(asignadoA);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  const value = selectedAssignee ?? UNASSIGNED_VALUE;
  const currentLabel =
    assigneeOptions.find((option) => option.id === selectedAssignee)?.email ??
    "Sin asignar";

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
        onReassigned?.(taskId, userId);
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
      {feedback ? (
        <span
          role={feedback.type === "error" ? "alert" : "status"}
          className={`font-body text-xs ${
            feedback.type === "error" ? "text-risk-high" : "text-risk-low"
          }`}
        >
          {feedback.message}
        </span>
      ) : null}
    </div>
  );
}

type SnoozeOption = "one_hour" | "three_hours" | "tomorrow";

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
            className="rounded-full border-border bg-bg-surface text-[var(--foreground)] hover:bg-bg-page hover:text-[var(--foreground)] disabled:opacity-60"
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
          className="min-w-40 rounded-2xl border border-border bg-bg-surface p-1 text-[var(--foreground)] shadow-md"
        >
          <DropdownMenuItem
            onSelect={() => handleSnooze("one_hour")}
            className="rounded-lg font-body text-sm focus:bg-[var(--color-accent)]/10 focus:text-[var(--color-accent)]"
          >
            1 hora
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => handleSnooze("three_hours")}
            className="rounded-lg font-body text-sm focus:bg-[var(--color-accent)]/10 focus:text-[var(--color-accent)]"
          >
            3 horas
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => handleSnooze("tomorrow")}
            className="rounded-lg font-body text-sm focus:bg-[var(--color-accent)]/10 focus:text-[var(--color-accent)]"
          >
            Mañana
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {feedback ? (
        <span
          role={feedback.type === "error" ? "alert" : "status"}
          className={`font-body text-xs ${
            feedback.type === "error" ? "text-risk-high" : "text-risk-low"
          }`}
        >
          {feedback.message}
        </span>
      ) : null}
    </div>
  );
}

export function TaskDetailRow({
  task,
  assigneeOptions,
}: {
  task: TaskWithOrderContext;
  assigneeOptions: AssigneeOption[];
}) {
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

      setCompletionAnimation("checked");
      completionAnimationTimeoutRef.current = window.setTimeout(() => {
        setCompletionAnimation(detail.collapse ? "leaving" : "idle");
        completionAnimationTimeoutRef.current = null;
      }, detail.collapse ? 90 : 600);
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

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleDetail();
    }
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

  return (
    <article
      role={orderId !== null && !isLeaving ? "button" : undefined}
      tabIndex={orderId !== null && !isLeaving ? 0 : undefined}
      aria-pressed={orderId !== null && !isLeaving ? selected : undefined}
      onClick={orderId !== null && !isLeaving ? toggleDetail : undefined}
      onKeyDown={orderId !== null && !isLeaving ? handleKeyDown : undefined}
      className={`overflow-hidden rounded-2xl border bg-bg-surface text-[var(--foreground)] transition-[max-height,opacity,transform,padding,border-color,box-shadow] duration-300 ease-out motion-reduce:transition-none ${
        isLeaving
          ? "pointer-events-none max-h-0 scale-[0.98] border-transparent p-0 opacity-0"
          : `max-h-[40rem] p-4 shadow-lg ${isCompleted ? "opacity-70" : ""} ${
              orderId !== null
                ? "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
                : ""
            } ${
              selected
                ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-bg-page"
                : "border-border"
            }`
      }`}
    >
      {showCompletionCheck ? (
        <span role="status" className="sr-only">
          Tarea completada
        </span>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
              showCompletionCheck
                ? "bg-risk-low-bg text-risk-low"
                : taskTone.circleClassName
            }`}
            aria-hidden="true"
          >
            {showCompletionCheck ? (
              <Check className="h-5 w-5 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-200" />
            ) : (
              <Icon className="h-5 w-5" />
            )}
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
                <span className="rounded-full bg-risk-medium-bg px-3 py-1 font-mono text-xs font-semibold tabular-nums text-risk-medium">
                  Intento {task.intento_numero}
                </span>
              ) : null}
              <div
                onClick={(event) => event.stopPropagation()}
                onKeyDown={stopKeyPropagation}
              >
                <AssigneeSelect
                  key={`row-assignee-${task.id}-${task.asignado_a ?? "none"}`}
                  taskId={task.id}
                  asignadoA={task.asignado_a}
                  assigneeOptions={assigneeOptions}
                />
              </div>
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
          )}
          {orderId !== null ? (
            <Button
              asChild
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-border bg-bg-surface text-[var(--foreground)] hover:bg-bg-page hover:text-[var(--foreground)]"
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
    </article>
  );
}

export function TaskDetailDrawer({
  visibleTaskOrder,
}: {
  visibleTaskOrder: VisibleTaskSelection[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const selectedOrderId = searchParams.get("detalle");
  const selectedTaskId = searchParams.get("tareaId");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [assigneeOptions, setAssigneeOptions] = useState<
    AssigneeOption[] | null
  >(null);
  const [assigneeOptionsError, setAssigneeOptionsError] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const completionNavigationTimeoutRef = useRef<number | null>(null);
  const lastLoggedTaskIdRef = useRef<number | null>(null);
  const isOpen = Boolean(selectedOrderId);

  const closeHref = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("detalle");
    params.delete("tareaId");
    return buildDetailHref(pathname, params);
  }, [pathname, searchParams]);

  const selectedTask = useMemo(() => {
    if (!detail) {
      return null;
    }

    return (
      detail.tasks.find((task) => String(task.id) === selectedTaskId) ??
      detail.tasks.find((task) => task.estado !== "completada") ??
      detail.tasks[0] ??
      null
    );
  }, [detail, selectedTaskId]);

  const otherTasks = useMemo(() => {
    if (!detail || !selectedTask) {
      return [];
    }

    return detail.tasks.filter((task) => task.id !== selectedTask.id);
  }, [detail, selectedTask]);

  const loggableTaskId =
    isOpen &&
    detail &&
    selectedTask &&
    String(detail.order.id) === selectedOrderId &&
    String(selectedTask.order_id) === selectedOrderId &&
    (!selectedTaskId || String(selectedTask.id) === selectedTaskId)
      ? selectedTask.id
      : null;

  function closeDrawer() {
    if (completionNavigationTimeoutRef.current !== null) {
      window.clearTimeout(completionNavigationTimeoutRef.current);
      completionNavigationTimeoutRef.current = null;
    }

    router.push(closeHref, { scroll: false });
  }

  useEffect(() => {
    return () => {
      if (completionNavigationTimeoutRef.current !== null) {
        window.clearTimeout(completionNavigationTimeoutRef.current);
        completionNavigationTimeoutRef.current = null;
      }
    };
  }, [selectedOrderId, selectedTaskId]);

  useEffect(() => {
    if (!isOpen) {
      lastLoggedTaskIdRef.current = null;
      return;
    }

    if (
      loggableTaskId === null ||
      lastLoggedTaskIdRef.current === loggableTaskId
    ) {
      return;
    }

    const taskId = loggableTaskId;
    lastLoggedTaskIdRef.current = taskId;

    async function logOpen() {
      try {
        await logTaskHandlingOpen(taskId);
      } catch (loggingError) {
        console.error("Failed to log task drawer opening", loggingError);
      }
    }

    void logOpen();
  }, [isOpen, loggableTaskId]);

  useEffect(() => {
    if (!selectedOrderId) {
      return;
    }

    const abortController = new AbortController();

    async function loadDetail() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/orders/${selectedOrderId}`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          setDetail(null);
          setError(
            response.status === 404
              ? "Pedido no encontrado o sin acceso."
              : "No se pudo cargar el detalle del pedido.",
          );
          return;
        }

        const payload = (await response.json()) as OrderDetail;
        setDetail(payload);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setDetail(null);
        setError("No se pudo cargar el detalle del pedido.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadDetail();

    return () => {
      abortController.abort();
    };
  }, [selectedOrderId]);

  useEffect(() => {
    if (!selectedOrderId) {
      return;
    }

    let isActive = true;

    async function loadAssigneeOptions() {
      setAssigneeOptions(null);
      setAssigneeOptionsError(null);

      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("activo", true)
        .order("email", { ascending: true });

      if (!isActive) {
        return;
      }

      if (profilesError) {
        setAssigneeOptionsError("No se pudieron cargar los responsables.");
        return;
      }

      setAssigneeOptions(data ?? []);
    }

    void loadAssigneeOptions();

    return () => {
      isActive = false;
    };
  }, [selectedOrderId, supabase]);

  function navigateAfterTaskLeavesView(taskId: number) {
    const taskIndex = visibleTaskOrder.findIndex(
      (task) => task.taskId === taskId,
    );
    const nextTask =
      taskIndex >= 0 ? visibleTaskOrder[taskIndex + 1] : undefined;
    const params = new URLSearchParams(searchParams);

    if (nextTask && nextTask.orderId !== null) {
      params.set("detalle", String(nextTask.orderId));
      params.set("tareaId", String(nextTask.taskId));
    } else {
      params.delete("detalle");
      params.delete("tareaId");
    }

    router.push(buildDetailHref(pathname, params), { scroll: false });
  }

  function handleTaskCompleted(taskId: number, notes: string | null) {
    const completedAt = new Date().toISOString();

    setDetail((currentDetail) => {
      if (!currentDetail) {
        return currentDetail;
      }

      return {
        ...currentDetail,
        tasks: currentDetail.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                estado: "completada",
                completado_en: completedAt,
                notas_completado: notes,
              }
            : task,
        ),
      };
    });

    const collapse = searchParams.get("estado_vista") !== "todas";
    window.dispatchEvent(
      new CustomEvent<TaskCompletedEventDetail>(TASK_COMPLETED_EVENT, {
        detail: { collapse, taskId },
      }),
    );

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (completionNavigationTimeoutRef.current !== null) {
      window.clearTimeout(completionNavigationTimeoutRef.current);
    }

    completionNavigationTimeoutRef.current = window.setTimeout(
      () => {
        completionNavigationTimeoutRef.current = null;
        navigateAfterTaskLeavesView(taskId);
        router.refresh();
      },
      prefersReducedMotion ? 0 : 400,
    );
  }

  function handleTaskSnoozed(taskId: number) {
    if (searchParams.get("estado_vista") !== "pospuestas") {
      navigateAfterTaskLeavesView(taskId);
    }
  }

  function handleTaskReassigned(taskId: number, userId: string | null) {
    setDetail((currentDetail) => {
      if (!currentDetail) {
        return currentDetail;
      }

      return {
        ...currentDetail,
        tasks: currentDetail.tasks.map((task) =>
          task.id === taskId ? { ...task, asignado_a: userId } : task,
        ),
      };
    });
  }

  return (
    <Dialog.Root
      modal={false}
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeDrawer();
        }
      }}
    >
      <Dialog.Portal>
        <style>{`
          @keyframes crm-task-drawer-enter {
            from {
              opacity: 0;
              transform: translateX(24px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          .crm-task-detail-drawer[data-state="open"] {
            animation: crm-task-drawer-enter 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
          }

          @media (prefers-reduced-motion: reduce) {
            .crm-task-detail-drawer[data-state="open"] {
              animation: none;
            }
          }
        `}</style>
        <Dialog.Content
          className="crm-task-detail-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-bg-surface text-[var(--foreground)] shadow-xl outline-none"
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-lg font-semibold text-[var(--foreground)]">
                Detalle de tarea
              </Dialog.Title>
              <Dialog.Description className="mt-1 font-body text-sm text-[var(--muted-foreground)]">
                Gestión activa y contexto del pedido
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-lg border-border bg-bg-surface text-[var(--foreground)] hover:bg-bg-page hover:text-[var(--foreground)]"
                aria-label="Cerrar detalle"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-44 rounded-2xl border border-border bg-bg-page motion-safe:animate-pulse" />
                <div className="h-32 rounded-2xl border border-border bg-bg-page motion-safe:animate-pulse" />
                <div className="h-24 rounded-2xl border border-border bg-bg-page motion-safe:animate-pulse" />
              </div>
            ) : null}

            {!isLoading && error ? (
              <div className="rounded-2xl border border-border bg-bg-surface p-4 font-body text-sm text-[var(--muted-foreground)] shadow-lg">
                {error}
              </div>
            ) : null}

            {!isLoading && detail && selectedTask ? (
              <div className="space-y-5">
                <SelectedTaskSection
                  task={selectedTask}
                  order={detail.order}
                  assigneeOptions={assigneeOptions}
                  assigneeOptionsError={assigneeOptionsError}
                  onCompleted={handleTaskCompleted}
                  onReassigned={handleTaskReassigned}
                  onSnoozed={handleTaskSnoozed}
                />
                <OtherTasksSection tasks={otherTasks} />
                <OrderDetailsSection
                  key={`order-details-${selectedOrderId ?? "closed"}-${selectedTaskId ?? "task"}`}
                  order={detail.order}
                />
                <NovedadDetailsSection
                  key={`novedad-details-${selectedOrderId ?? "closed"}-${selectedTaskId ?? "task"}`}
                  statusHistory={detail.statusHistory}
                />
                <StatusHistorySection
                  key={`${selectedOrderId ?? "closed"}-${selectedTaskId ?? "task"}`}
                  statusHistory={detail.statusHistory}
                />
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SelectedTaskSection({
  task,
  order,
  assigneeOptions,
  assigneeOptionsError,
  onCompleted,
  onReassigned,
  onSnoozed,
}: {
  task: Task;
  order: Order;
  assigneeOptions: AssigneeOption[] | null;
  assigneeOptionsError: string | null;
  onCompleted: (taskId: number, notes: string | null) => void;
  onReassigned: (taskId: number, userId: string | null) => void;
  onSnoozed: (taskId: number) => void;
}) {
  const taskTone = taskTypeTone[task.tipo];
  const Icon = taskTone.icon;
  const deadline = getDeadline(task.fecha_limite, task.estado);
  const isCompleted = task.estado === "completada";
  const isActionable =
    task.estado === "pendiente" || task.estado === "en_progreso";
  const description = task.descripcion?.trim();
  const completionNotes = task.notas_completado?.trim();
  const whatsappNumber = getWhatsappNumber(order);
  const whatsappMessage = buildTaskWhatsAppMessage(task, order);
  const whatsappUrl = whatsappNumber
    ? `https://api.whatsapp.com/send/?phone=${whatsappNumber}${
        whatsappMessage ? `&text=${encodeURIComponent(whatsappMessage)}` : ""
      }`
    : null;

  return (
    <section className="rounded-2xl border border-[var(--color-accent)] bg-bg-surface p-4 shadow-lg">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                <span className="rounded-full bg-risk-medium-bg px-3 py-1 font-mono text-xs font-semibold tabular-nums text-risk-medium">
                  Intento {task.intento_numero}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold text-[var(--foreground)]">
              {task.titulo}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 font-body text-sm text-[var(--muted-foreground)]">
              <span>
                {getCustomerName(order)} ·{" "}
                <span className="font-mono tabular-nums">
                  {getOrderIdentifier(order)}
                </span>
              </span>
              <DropiIdCopyButton idOrdenDropi={order.id_orden_dropi} />
            </div>
            <div
              className={`mt-3 inline-flex rounded-full px-3 py-1 font-mono text-xs font-semibold tabular-nums ${
                deadline.isOverdue
                  ? "bg-risk-high-bg text-risk-high"
                  : "bg-bg-page text-[var(--muted-foreground)]"
              }`}
            >
              {isCompleted
                ? getCompletionLabel(task)
                : `${deadline.isOverdue ? "Vencida " : "Vence "}${deadline.label}`}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-bg-page p-3 lg:min-w-44">
          <p className="font-body text-xs text-[var(--muted-foreground)]">
            Teléfono cliente
          </p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-[var(--foreground)]">
            {order.telefono?.trim() || "Sin teléfono"}
          </p>
          {whatsappUrl ? (
            <Button
              asChild
              className="mt-3 h-9 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 text-bg-surface hover:opacity-90"
            >
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {description || completionNotes ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {description ? (
            <div className="rounded-2xl border border-border bg-bg-page p-3">
              <dt className="font-body text-xs text-[var(--muted-foreground)]">
                Descripción
              </dt>
              <dd className="mt-1 whitespace-pre-wrap font-body text-sm text-[var(--foreground)]">
                {description}
              </dd>
            </div>
          ) : null}
          {completionNotes ? (
            <div className="rounded-2xl border border-border bg-bg-page p-3">
              <dt className="font-body text-xs text-[var(--muted-foreground)]">
                Nota de cierre
              </dt>
              <dd className="mt-1 whitespace-pre-wrap font-body text-sm text-[var(--foreground)]">
                {completionNotes}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-bg-page p-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-body text-xs text-[var(--muted-foreground)]">
            Responsable
          </p>
          <div className="mt-2">
            {assigneeOptions ? (
              <AssigneeSelect
                key={`drawer-assignee-${task.id}`}
                taskId={task.id}
                asignadoA={task.asignado_a}
                assigneeOptions={assigneeOptions}
                onReassigned={onReassigned}
              />
            ) : assigneeOptionsError ? (
              <p className="font-body text-xs text-risk-high">
                {assigneeOptionsError}
              </p>
            ) : (
              <span className="inline-flex h-9 items-center gap-2 font-body text-xs text-[var(--muted-foreground)]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Cargando responsables
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-border bg-bg-surface text-[var(--foreground)] hover:bg-bg-page hover:text-[var(--foreground)]"
          >
            <Link href={`/pedidos?detalle=${order.id}`}>
              <Eye className="h-4 w-4" aria-hidden="true" />
              Ver pedido
            </Link>
          </Button>
          {task.estado === "pendiente" || task.estado === "en_progreso" ? (
            <SnoozeTaskControl
              key={`drawer-snooze-${task.id}`}
              taskId={task.id}
              onSnoozed={onSnoozed}
            />
          ) : null}
        </div>
      </div>

      {isActionable ? (
        <CompleteTaskForm taskId={task.id} onCompleted={onCompleted} />
      ) : null}
    </section>
  );
}

function CompleteTaskForm({
  taskId,
  onCompleted,
}: {
  taskId: number;
  onCompleted: (taskId: number, notes: string | null) => void;
}) {
  const [isCompleting, startCompleting] = useTransition();
  const [completionNote, setCompletionNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleComplete() {
    startCompleting(async () => {
      const result = await completeTask(taskId, completionNote);

      if (result.error) {
        setError(result.error);
        return;
      }

      const trimmedNote = completionNote.trim();
      setCompletionNote("");
      setError(null);
      onCompleted(taskId, trimmedNote ? trimmedNote : null);
    });
  }

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-border bg-bg-page p-3">
      <label
        htmlFor={`drawer-completion-note-${taskId}`}
        className="font-body text-xs text-[var(--muted-foreground)]"
      >
        Nota de cierre (opcional)
      </label>
      <textarea
        id={`drawer-completion-note-${taskId}`}
        value={completionNote}
        onChange={(event) => setCompletionNote(event.target.value)}
        disabled={isCompleting}
        rows={3}
        placeholder="Ej. Cliente confirmó recepción por WhatsApp"
        className="w-full rounded-lg border border-border bg-bg-surface px-2.5 py-1.5 font-body text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--color-accent)] focus-visible:ring-3 focus-visible:ring-[var(--color-accent)]/20 disabled:opacity-60"
      />
      {error ? <p className="font-body text-sm text-risk-high">{error}</p> : null}
      <Button
        type="button"
        disabled={isCompleting}
        onClick={handleComplete}
        className="h-9 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 text-bg-surface hover:opacity-90 disabled:opacity-60"
      >
        <Check className="h-4 w-4" aria-hidden="true" />
        Confirmar
      </Button>
    </div>
  );
}

function OtherTasksSection({ tasks }: { tasks: Task[] }) {
  return (
    <section className="rounded-2xl border border-border bg-bg-surface p-4 shadow-lg">
      <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
        Otras tareas de este pedido
      </h3>

      {tasks.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {tasks.map((task) => (
            <TaskSummaryItem key={task.id} task={task} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 font-body text-sm text-[var(--muted-foreground)]">
          No hay otras tareas asociadas a este pedido.
        </p>
      )}
    </section>
  );
}

function TaskSummaryItem({ task }: { task: Task }) {
  const deadline = getDeadline(task.fecha_limite, task.estado);

  return (
    <li className="rounded-2xl border border-border bg-bg-page p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-body text-xs uppercase text-[var(--muted-foreground)]">
            {getTaskTypeLabel(task.tipo)}
          </p>
          <p className="mt-1 font-body text-sm font-medium text-[var(--foreground)]">
            {task.titulo}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 font-body text-xs font-semibold ${taskStateClassName[task.estado]}`}
        >
          {taskStateLabel[task.estado]}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 font-mono text-xs tabular-nums text-[var(--muted-foreground)]">
        {task.intento_numero > 1 ? <span>Intento {task.intento_numero}</span> : null}
        <span
          className={deadline.isOverdue ? "text-risk-high" : undefined}
        >
          {task.estado === "completada"
            ? getCompletionLabel(task)
            : `${deadline.isOverdue ? "Vencida " : "Vence "}${deadline.label}`}
        </span>
      </div>
    </li>
  );
}

function OrderDetailsSection({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const location = [order.ciudad, order.departamento].filter(Boolean).join(", ");

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
      <section className="rounded-2xl border border-border bg-bg-surface p-4 shadow-lg">
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-display text-base font-semibold text-[var(--foreground)]">
              Detalles del pedido
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content>
          <dl className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-border bg-bg-page p-3">
              <dt className="font-body text-xs text-[var(--muted-foreground)]">
                Producto
              </dt>
              <dd className="mt-1 font-body text-sm font-medium text-[var(--foreground)]">
                {order.nombre_producto?.trim() || "Sin producto registrado"}
              </dd>
            </div>
            <div className="rounded-2xl border border-border bg-bg-page p-3">
              <dt className="font-body text-xs text-[var(--muted-foreground)]">
                Ciudad / departamento
              </dt>
              <dd className="mt-1 font-body text-sm font-medium text-[var(--foreground)]">
                {location || "Sin ubicación registrada"}
              </dd>
            </div>
            <div className="rounded-2xl border border-border bg-bg-page p-3">
              <dt className="font-body text-xs text-[var(--muted-foreground)]">
                País
              </dt>
              <dd className="mt-1 font-body text-sm font-medium text-[var(--foreground)]">
                {order.pais || "Sin país registrado"}
              </dd>
            </div>
          </dl>
        </Collapsible.Content>
      </section>
    </Collapsible.Root>
  );
}

function getLatestNovedadStatus(statusHistory: StatusHistory[]) {
  return statusHistory.reduce<StatusHistory | null>((latest, historyItem) => {
    if (!historyItem.novedad?.trim()) {
      return latest;
    }

    if (!latest) {
      return historyItem;
    }

    const currentTime = new Date(historyItem.registrado_en).getTime();
    const latestTime = new Date(latest.registrado_en).getTime();

    if (Number.isNaN(currentTime)) {
      return latest;
    }

    if (Number.isNaN(latestTime)) {
      return historyItem;
    }

    return currentTime > latestTime ? historyItem : latest;
  }, null);
}

function NovedadDetailsSection({
  statusHistory,
}: {
  statusHistory: StatusHistory[];
}) {
  const [open, setOpen] = useState(false);
  const latestNovedadStatus = getLatestNovedadStatus(statusHistory);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
      <section className="rounded-2xl border border-border bg-bg-surface p-4 shadow-lg">
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-display text-base font-semibold text-[var(--foreground)]">
              Detalles de novedad
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content>
          {latestNovedadStatus ? (
            <div className="mt-4 rounded-2xl border border-border bg-bg-page p-3">
              <p className="font-body text-sm text-[var(--foreground)]">
                {latestNovedadStatus.novedad?.trim()}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 font-mono text-xs tabular-nums text-[var(--muted-foreground)]">
                <span>{latestNovedadStatus.estado}</span>
                <time>{formatDateTime(latestNovedadStatus.registrado_en)}</time>
              </div>
            </div>
          ) : (
            <p className="mt-4 font-body text-sm text-[var(--muted-foreground)]">
              Sin novedad registrada
            </p>
          )}
        </Collapsible.Content>
      </section>
    </Collapsible.Root>
  );
}

function StatusHistorySection({
  statusHistory,
}: {
  statusHistory: StatusHistory[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
      <section className="rounded-2xl border border-border bg-bg-surface p-4 shadow-lg">
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="font-display text-base font-semibold text-[var(--foreground)]">
              Historial de estados ({statusHistory.length} eventos)
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content>
          {statusHistory.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {statusHistory.map((historyItem) => (
                <li
                  key={historyItem.id}
                  className="rounded-2xl border border-border bg-bg-page p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-body text-sm font-medium text-[var(--foreground)]">
                        {historyItem.estado}
                      </p>
                      <p className="mt-1 font-body text-xs text-[var(--muted-foreground)]">
                        {historyItem.transportadora ?? "Sin transportadora"}
                      </p>
                    </div>
                    <time className="shrink-0 font-mono text-xs tabular-nums text-[var(--muted-foreground)]">
                      {formatDateTime(historyItem.registrado_en)}
                    </time>
                  </div>
                  {historyItem.novedad ? (
                    <p className="mt-2 font-body text-sm text-risk-medium">
                      {historyItem.novedad}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 font-body text-sm text-[var(--muted-foreground)]">
              Sin historial registrado.
            </p>
          )}
        </Collapsible.Content>
      </section>
    </Collapsible.Root>
  );
}
