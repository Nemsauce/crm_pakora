import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

const PAGE_SIZE = 20;

type Notification = Pick<
  Tables<"notifications">,
  | "id"
  | "titulo"
  | "mensaje"
  | "created_at"
  | "leida"
  | "order_id"
  | "task_id"
  | "tipo"
  | "user_id"
>;

type NotificationsPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

function parsePage(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(candidate ?? "1", 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function getNotificationDestination(notification: Notification) {
  if (notification.task_id !== null && notification.order_id !== null) {
    return `/tareas?detalle=${notification.order_id}&tareaId=${notification.task_id}`;
  }

  if (notification.order_id !== null) {
    return `/pedidos?detalle=${notification.order_id}`;
  }

  return null;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : dateTimeFormatter.format(date);
}

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count, error } = await supabase
    .from("notifications")
    .select(
      "id,titulo,mensaje,created_at,leida,order_id,task_id,tipo,user_id",
      { count: "exact" },
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`No se pudieron cargar las notificaciones: ${error.message}`);
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (page > totalPages) {
    redirect(
      totalPages === 1
        ? "/notificaciones"
        : `/notificaciones?page=${totalPages}`,
    );
  }

  const notifications = (data ?? []) as Notification[];

  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="border-b border-border pb-4">
        <p className="font-body text-xs uppercase text-text-secondary">
          Actividad
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Notificaciones
        </h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
          Historial completo de avisos de pedidos y tareas asignados a tu
          usuario.
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="font-body text-sm text-text-secondary">
          {total === 1 ? "1 notificación" : `${total} notificaciones`}
        </p>
        <p className="font-mono text-xs tabular-nums text-text-secondary">
          Página {page} de {totalPages}
        </p>
      </div>

      {notifications.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-lg">
          <ul className="divide-y divide-border">
            {notifications.map((notification) => {
              const destination = getNotificationDestination(notification);

              return (
                <li
                  key={notification.id}
                  className="flex items-start gap-3 px-4 py-4 sm:px-5"
                >
                  <span
                    className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                      notification.leida
                        ? "bg-text-secondary/30"
                        : "bg-risk-high"
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <p
                        className={`font-body text-sm text-text-primary ${
                          notification.leida ? "font-medium" : "font-semibold"
                        }`}
                      >
                        {notification.titulo}
                      </p>
                      <time
                        dateTime={notification.created_at}
                        className="font-mono text-xs tabular-nums text-text-secondary"
                      >
                        {formatDateTime(notification.created_at)}
                      </time>
                    </div>
                    {notification.mensaje ? (
                      <p className="mt-1 whitespace-pre-line font-body text-sm leading-6 text-text-secondary">
                        {notification.mensaje}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-3">
                      <span className="font-body text-xs text-text-secondary">
                        {notification.leida ? "Leída" : "No leída"}
                      </span>
                      {destination ? (
                        <Link
                          href={destination}
                          className="font-body text-xs font-medium text-[var(--color-accent)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Abrir detalle
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-border bg-bg-surface p-8 text-center font-body text-sm text-text-secondary shadow-lg">
          No hay notificaciones.
        </div>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="Paginación de notificaciones"
          className="mt-5 flex items-center justify-between gap-3"
        >
          <Button asChild variant="outline" size="sm">
            <Link
              href={
                page - 1 === 1
                  ? "/notificaciones"
                  : `/notificaciones?page=${page - 1}`
              }
              aria-disabled={page === 1}
              tabIndex={page === 1 ? -1 : undefined}
              className={page === 1 ? "pointer-events-none opacity-50" : ""}
            >
              <ChevronLeft aria-hidden="true" />
              Anterior
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/notificaciones?page=${page + 1}`}
              aria-disabled={page === totalPages}
              tabIndex={page === totalPages ? -1 : undefined}
              className={
                page === totalPages ? "pointer-events-none opacity-50" : ""
              }
            >
              Siguiente
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
