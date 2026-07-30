import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import {
  TaskRow,
  type TaskWithOrderContext,
} from "@/components/tasks/TaskRow";
import { TaskSummaryBar } from "@/components/tasks/TaskSummaryBar";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type SearchParams = {
  tipo?: string;
  pais?: string;
  vencidas?: string;
  q?: string;
  estado_vista?: string;
  detalle?: string;
  tareaId?: string;
};

type EstadoVista = "abiertas" | "completadas" | "pospuestas" | "todas";

const validVistas = new Set<string>([
  "abiertas",
  "completadas",
  "pospuestas",
  "todas",
]);

type TareasPageProps = {
  searchParams: Promise<SearchParams>;
};

type TipoTarea = Database["public"]["Enums"]["tipo_tarea_enum"];
type Pais = Database["public"]["Enums"]["pais_enum"];

const validTipos = new Set<string>([
  "llamar_confirmacion",
  "notificar_guia",
  "presionar_entrega",
  "notificar_proximo_llegar",
  "resolver_novedad",
]);
const validPaises = new Set<string>(["CO", "MX"]);

function escapeIlikeTerm(term: string) {
  return term.replace(/[%,]/g, "");
}

function isOverdue(task: TaskWithOrderContext) {
  if (task.estado === "completada" || !task.fecha_limite) {
    return false;
  }

  return new Date(task.fecha_limite).getTime() < Date.now();
}

export default async function TareasPage({ searchParams }: TareasPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const estadoVista: EstadoVista =
    params.estado_vista && validVistas.has(params.estado_vista)
      ? (params.estado_vista as EstadoVista)
      : "abiertas";

  let query = supabase
    .from("tasks")
    .select("*, orders!inner(id,nombre,apellido,numero_orden,pais)")
    .order("fecha_limite", { ascending: true, nullsFirst: false });

  if (estadoVista === "pospuestas") {
    query = query
      .filter("snoozed_until", "gt", nowIso)
      .in("estado", ["pendiente", "en_progreso"]);
  } else {
    query = query.or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`);
  }

  if (estadoVista === "abiertas") {
    query = query.in("estado", ["pendiente", "en_progreso"]);
  } else if (estadoVista === "completadas") {
    query = query.eq("estado", "completada");
  }

  if (params.tipo && validTipos.has(params.tipo)) {
    query = query.eq("tipo", params.tipo as TipoTarea);
  }

  if (params.pais && validPaises.has(params.pais)) {
    query = query.eq("orders.pais", params.pais as Pais);
  }

  if (params.vencidas === "true") {
    query = query.lt("fecha_limite", nowIso);
  } else if (params.vencidas === "false") {
    query = query.gte("fecha_limite", nowIso);
  }

  const searchTerm = params.q?.trim();

  if (searchTerm) {
    const term = escapeIlikeTerm(searchTerm);
    query = query.or(
      `nombre.ilike.%${term}%,apellido.ilike.%${term}%,numero_orden.ilike.%${term}%`,
      { foreignTable: "orders" },
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`No se pudieron cargar las tareas: ${error.message}`);
  }

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, nombre")
    .eq("activo", true)
    .order("email", { ascending: true });

  if (profilesError) {
    throw new Error(
      `No se pudieron cargar los usuarios activos: ${profilesError.message}`,
    );
  }

  const assigneeOptions = profilesData ?? [];
  const tasks = (data ?? []) as TaskWithOrderContext[];
  const overdueCount =
    estadoVista === "completadas"
      ? null
      : tasks.filter((task) => isOverdue(task)).length;

  return (
    <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            Operación · cola de trabajo
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-text-primary">
            Tareas
          </h1>
        </div>
        <p className="max-w-xl font-body text-sm text-text-secondary sm:text-right">
          Prioridad operativa ordenada por vencimiento. Abre una tarea para
          gestionarla sin perder tu posición en la lista.
        </p>
      </div>

      <div className="mt-5">
        <TaskFilters />
      </div>

      <div className="mt-4">
        <TaskSummaryBar
          total={tasks.length}
          vencidas={overdueCount}
          view={estadoVista}
        />
      </div>

      {tasks.length > 0 ? (
        <div
          role="list"
          className="mt-4 space-y-2"
          aria-label="Lista de tareas"
        >
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              assigneeOptions={assigneeOptions}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-border bg-[var(--color-bg-surface-subtle)] p-6 font-body text-sm text-text-secondary">
          No hay tareas que coincidan con la vista y los filtros actuales.
        </div>
      )}

      <TaskDetailDrawer
        visibleTaskOrder={tasks.map((task) => ({
          taskId: task.id,
          orderId: task.orders?.id ?? null,
        }))}
      />
    </section>
  );
}
