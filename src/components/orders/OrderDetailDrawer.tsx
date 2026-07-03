"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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

const estadoCrmLabel: Record<Order["estado_crm"], string> = {
  nuevo: "Nuevo",
  en_ruta: "En ruta",
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

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
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

function formatTaskType(value: string) {
  return value.replaceAll("_", " ");
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
                <OrderHeader order={detail.order} />
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

function OrderHeader({ order }: { order: Order }) {
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
                    {formatTaskType(task.tipo)}
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
