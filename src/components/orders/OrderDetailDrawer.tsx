"use client";

import { Check, Loader2, Pencil, Phone, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useState, useTransition } from "react";

import { updateOrderPhone } from "@/app/(app)/pedidos/actions";
import { getTaskTypeLabel } from "@/components/tasks/TaskDetailDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/lib/supabase/database.types";

import { RiskOrb } from "./RiskOrb";

type Order = Tables<"orders">;
type StatusHistory = Tables<"status_history">;
type Task = Tables<"tasks">;
type Comentario = Tables<"comentarios">;

type OrderDetail = {
  order: Order;
  statusHistory: StatusHistory[];
  tasks: Task[];
  comentarios: Comentario[];
};

type BadgeTone = "accent" | "muted" | "success" | "warning" | "danger";
type RiskLevel = "alto" | "medio" | "bajo" | "sin_datos";

const estadoCrmLabel: Record<Order["estado_crm"], string> = {
  nuevo: "Nuevo",
  en_ruta: "En tránsito",
  entregado: "Entregado",
  cancelado: "Cancelado",
  devolucion: "Devolución",
};

const estadoCrmTone: Record<Order["estado_crm"], BadgeTone> = {
  nuevo: "accent",
  en_ruta: "muted",
  entregado: "success",
  cancelado: "danger",
  devolucion: "danger",
};

const taskStateLabel: Record<Task["estado"], string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
  cancelada: "Cancelada",
};

const badgeClassName: Record<BadgeTone, string> = {
  accent: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  muted: "bg-bg-page text-[var(--foreground)]",
  success: "bg-risk-low-bg text-risk-low",
  warning: "bg-risk-medium-bg text-risk-medium",
  danger: "bg-risk-high-bg text-risk-high",
};

const taskStateTone: Record<Task["estado"], BadgeTone> = {
  pendiente: "warning",
  en_progreso: "accent",
  completada: "success",
  cancelada: "danger",
};

const riskLabel: Record<RiskLevel, string> = {
  alto: "Riesgo alto",
  medio: "Riesgo medio",
  bajo: "Riesgo bajo",
  sin_datos: "Sin datos",
};

const riskBadgeClassName: Record<RiskLevel, string> = {
  alto: "bg-risk-high-bg text-risk-high",
  medio: "bg-risk-medium-bg text-risk-medium",
  bajo: "bg-risk-low-bg text-risk-low",
  sin_datos: "bg-bg-page text-[var(--muted-foreground)]",
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const returnRateFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

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

function getCustomerName(order: Order) {
  const fullName = [order.nombre, order.apellido].filter(Boolean).join(" ");
  return fullName || "Cliente sin nombre";
}

function getOrderIdentifier(order: Order) {
  return order.numero_orden ?? `ID ${order.id}`;
}

function getLocation(order: Order) {
  const location = [order.ciudad, order.departamento].filter(Boolean).join(", ");
  return location || "Ubicación pendiente";
}

function normalizeRisk(nivelRiesgo: string | null): RiskLevel {
  if (
    nivelRiesgo === "alto" ||
    nivelRiesgo === "medio" ||
    nivelRiesgo === "bajo"
  ) {
    return nivelRiesgo;
  }

  return "sin_datos";
}

function formatReturnRate(returnedOrders: number, totalOrders: number) {
  return `${returnRateFormatter.format((returnedOrders / totalOrders) * 100)}%`;
}

export function OrderDetailDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedOrderId = searchParams.get("detalle");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isOpen = Boolean(selectedOrderId);

  const closeHref = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("detalle");
    const query = params.toString();

    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  function closeDrawer() {
    router.push(closeHref, { scroll: false });
  }

  function handlePhoneUpdated(telefono: string) {
    setDetail((currentDetail) =>
      currentDetail
        ? {
            ...currentDetail,
            order: { ...currentDetail.order, telefono },
          }
        : currentDetail,
    );
    router.refresh();
  }

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
          @keyframes crm-drawer-enter {
            from {
              opacity: 0;
              transform: translateX(24px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          .crm-order-detail-drawer[data-state="open"] {
            animation: crm-drawer-enter 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
          }

          @media (prefers-reduced-motion: reduce) {
            .crm-order-detail-drawer[data-state="open"] {
              animation: none;
            }
          }
        `}</style>
        <Dialog.Content
          className="crm-order-detail-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-bg-surface text-[var(--foreground)] shadow-xl outline-none"
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-lg font-semibold text-[var(--foreground)]">
                Detalle de pedido
              </Dialog.Title>
              <Dialog.Description className="mt-1 font-body text-sm text-[var(--muted-foreground)]">
                Historial y tareas asociadas
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
                <div className="h-20 rounded-2xl border border-border bg-bg-page motion-safe:animate-pulse" />
                <div className="h-40 rounded-2xl border border-border bg-bg-page motion-safe:animate-pulse" />
                <div className="h-40 rounded-2xl border border-border bg-bg-page motion-safe:animate-pulse" />
              </div>
            ) : null}

            {!isLoading && error ? (
              <div className="rounded-2xl border border-border bg-bg-surface p-4 font-body text-sm text-[var(--muted-foreground)] shadow-lg">
                {error}
              </div>
            ) : null}

            {!isLoading && detail ? (
              <div className="space-y-5">
                <OrderHeader
                  order={detail.order}
                  onPhoneUpdated={handlePhoneUpdated}
                />
                <CustomerRiskProfileSection order={detail.order} />
                <StatusHistorySection statusHistory={detail.statusHistory} />
                <TasksSection tasks={detail.tasks} />
                <ComentariosSection comentarios={detail.comentarios} />
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CustomerRiskProfileSection({ order }: { order: Order }) {
  const risk = normalizeRisk(order.nivel_riesgo);
  const totalOrders = order.total_pedidos_cliente ?? 0;
  const deliveredOrders = order.pedidos_entregados_cliente ?? 0;
  const returnedOrders = order.pedidos_devueltos_cliente ?? 0;
  const hasHistory = totalOrders > 0;

  return (
    <section className="rounded-2xl border border-border bg-bg-surface p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
            Perfil de riesgo del cliente
          </h3>
          <p className="mt-1 font-body text-sm text-[var(--muted-foreground)]">
            Historial capturado desde Dropi
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 font-body text-xs font-semibold ${riskBadgeClassName[risk]}`}
        >
          {riskLabel[risk]}
        </span>
      </div>

      {hasHistory ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-bg-page p-3">
            <dt className="font-body text-xs text-[var(--muted-foreground)]">
              Total de pedidos
            </dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--foreground)]">
              {totalOrders}
            </dd>
          </div>
          <div className="rounded-2xl border border-border bg-bg-page p-3">
            <dt className="font-body text-xs text-[var(--muted-foreground)]">
              Entregados
            </dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-risk-low">
              {deliveredOrders}
            </dd>
          </div>
          <div className="rounded-2xl border border-border bg-bg-page p-3">
            <dt className="font-body text-xs text-[var(--muted-foreground)]">
              Devueltos
            </dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-risk-high">
              {returnedOrders}
            </dd>
          </div>
          <div className="rounded-2xl border border-border bg-bg-page p-3">
            <dt className="font-body text-xs text-[var(--muted-foreground)]">
              Tasa de devolución
            </dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-[var(--foreground)]">
              {formatReturnRate(returnedOrders, totalOrders)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 rounded-2xl border border-border bg-bg-page p-3 font-body text-sm text-[var(--muted-foreground)]">
          Cliente sin historial en Dropi
        </p>
      )}

      {order.telefono?.trim() ? (
        <Button
          asChild
          type="button"
          variant="outline"
          className="mt-4 rounded-full border-border bg-bg-surface text-[var(--foreground)] hover:bg-bg-page hover:text-[var(--foreground)]"
        >
          <Link href={`/clientes/${encodeURIComponent(order.telefono)}`}>
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Ver perfil del cliente
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

function OrderHeader({
  order,
  onPhoneUpdated,
}: {
  order: Order;
  onPhoneUpdated: (telefono: string) => void;
}) {
  const badgeTone = estadoCrmTone[order.estado_crm];

  return (
    <section className="rounded-2xl border border-border bg-bg-surface p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="pt-1">
          <RiskOrb nivelRiesgo={order.nivel_riesgo} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-semibold text-[var(--foreground)]">
            {getCustomerName(order)}
          </h2>
          <p className="mt-1 font-mono text-sm text-[var(--muted-foreground)]">
            {getOrderIdentifier(order)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 font-body text-xs font-semibold ${badgeClassName[badgeTone]}`}
        >
          {estadoCrmLabel[order.estado_crm]}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="font-body text-xs text-[var(--muted-foreground)]">Producto</dt>
          <dd className="mt-1 font-body text-sm text-[var(--foreground)]">
            {order.nombre_producto ?? "Producto sin nombre"}
          </dd>
        </div>
        <div>
          <dt className="font-body text-xs text-[var(--muted-foreground)]">Ubicación</dt>
          <dd className="mt-1 font-body text-sm text-[var(--foreground)]">
            {getLocation(order)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-body text-xs text-[var(--muted-foreground)]">
            Teléfono
          </dt>
          <dd className="mt-1">
            <EditablePhoneField
              key={order.id}
              orderId={order.id}
              telefono={order.telefono}
              onPhoneUpdated={onPhoneUpdated}
            />
          </dd>
        </div>
        <div>
          <dt className="font-body text-xs text-[var(--muted-foreground)]">Estado Dropi</dt>
          <dd className="mt-1 font-body text-sm text-[var(--foreground)]">
            {order.estado_dropi ?? "Sin estado"}
          </dd>
        </div>
        <div>
          <dt className="font-body text-xs text-[var(--muted-foreground)]">Guía</dt>
          <dd className="mt-1 font-mono text-sm text-[var(--foreground)]">
            {order.guia_envio ?? "Sin guía"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

type PhoneFeedback = {
  message: string;
  type: "error" | "success";
};

function EditablePhoneField({
  orderId,
  telefono,
  onPhoneUpdated,
}: {
  orderId: number;
  telefono: string | null;
  onPhoneUpdated: (telefono: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState(telefono ?? "");
  const [feedback, setFeedback] = useState<PhoneFeedback | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => setFeedback(null), 3_000);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  function startEditing() {
    setPhoneDraft(telefono ?? "");
    setFeedback(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setPhoneDraft(telefono ?? "");
    setFeedback(null);
    setIsEditing(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      try {
        const result = await updateOrderPhone(orderId, phoneDraft);

        if (result.error || !result.telefono) {
          setFeedback({
            message: result.error ?? "No se pudo actualizar el teléfono.",
            type: "error",
          });
          return;
        }

        onPhoneUpdated(result.telefono);
        setPhoneDraft(result.telefono);
        setIsEditing(false);
        setFeedback({ message: "Teléfono actualizado.", type: "success" });
      } catch {
        setFeedback({
          message: "No se pudo actualizar el teléfono.",
          type: "error",
        });
      }
    });
  }

  return (
    <div>
      {isEditing ? (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <Input
            autoFocus
            type="tel"
            value={phoneDraft}
            onChange={(event) => setPhoneDraft(event.target.value)}
            disabled={isPending}
            aria-label="Nuevo teléfono"
            aria-invalid={feedback?.type === "error"}
            className="max-w-xs font-mono tabular-nums"
          />
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !phoneDraft.trim()}
              className="rounded-full"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              Guardar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={cancelEditing}
              disabled={isPending}
              className="rounded-full border-border bg-bg-surface text-[var(--foreground)] hover:bg-bg-page hover:text-[var(--foreground)]"
              aria-label="Cancelar edición del teléfono"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex min-h-8 items-center gap-2">
          <Phone
            className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]"
            aria-hidden="true"
          />
          <span className="font-mono text-sm tabular-nums text-[var(--foreground)]">
            {telefono?.trim() || "Sin teléfono"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={startEditing}
            className="rounded-full text-[var(--muted-foreground)] hover:bg-bg-page hover:text-[var(--foreground)]"
            aria-label="Editar teléfono"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}

      {feedback ? (
        <p
          role="status"
          className={`mt-1 font-body text-xs ${
            feedback.type === "success" ? "text-risk-low" : "text-risk-high"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}

function StatusHistorySection({
  statusHistory,
}: {
  statusHistory: StatusHistory[];
}) {
  return (
    <section className="rounded-2xl border border-border bg-bg-surface p-4 shadow-lg">
      <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
        Historial de estados
      </h3>

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
                <time className="shrink-0 font-mono text-xs text-[var(--muted-foreground)]">
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
    </section>
  );
}

function TasksSection({ tasks }: { tasks: Task[] }) {
  return (
    <section className="rounded-2xl border border-border bg-bg-surface p-4 shadow-lg">
      <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
        Tareas
      </h3>

      {tasks.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="rounded-2xl border border-border bg-bg-page p-3"
            >
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
                  className={`shrink-0 rounded-full px-3 py-1 font-body text-xs font-semibold ${badgeClassName[taskStateTone[task.estado]]}`}
                >
                  {taskStateLabel[task.estado]}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 font-mono text-xs text-[var(--muted-foreground)]">
                {task.intento_numero > 1 ? (
                  <span>Intento {task.intento_numero}</span>
                ) : null}
                <span>Vence {formatDateTime(task.fecha_limite)}</span>
              </div>

              {task.estado === "completada" && task.notas_completado ? (
                <p className="mt-3 font-body text-sm text-[var(--foreground)]">
                  <span className="font-semibold">Nota:</span>{" "}
                  {task.notas_completado}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 font-body text-sm text-[var(--muted-foreground)]">
          Sin tareas asociadas.
        </p>
      )}
    </section>
  );
}

function ComentariosSection({ comentarios }: { comentarios: Comentario[] }) {
  return (
    <section className="rounded-2xl border border-border bg-bg-surface p-4 shadow-lg">
      <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
        Comentarios
      </h3>

      {comentarios.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {comentarios.map((comentario) => (
            <li
              key={comentario.id}
              className="rounded-2xl border border-border bg-bg-page p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-body text-xs uppercase text-[var(--muted-foreground)]">
                  {comentario.origen}
                </p>
                <time className="shrink-0 font-mono text-xs text-[var(--muted-foreground)]">
                  {formatDateTime(comentario.created_at)}
                </time>
              </div>
              <p className="mt-2 font-body text-sm text-[var(--foreground)]">
                {comentario.comentario}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 font-body text-sm text-[var(--muted-foreground)]">
          Sin comentarios.
        </p>
      )}
    </section>
  );
}
