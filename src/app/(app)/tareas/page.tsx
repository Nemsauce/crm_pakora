import { OrderDetailDrawer } from "@/components/orders/OrderDetailDrawer";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { TaskSummaryBar } from "@/components/tasks/TaskSummaryBar";
import { TaskRow, type TaskWithOrderContext } from "@/components/tasks/TaskRow";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type SearchParams = {
  tipo?: string;
  pais?: string;
  vencidas?: string;
  q?: string;
  estado_vista?: string;
};

type EstadoVista = "abiertas" | "completadas" | "todas";

const validVistas = new Set<string>(["abiertas", "completadas", "todas"]);

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

  const estadoVista: EstadoVista =
    params.estado_vista && validVistas.has(params.estado_vista)
      ? (params.estado_vista as EstadoVista)
      : "abiertas";

  let query = supabase
    .from("tasks")
    .select("*, orders!inner(id,nombre,apellido,numero_orden,pais)")
    .order("fecha_limite", { ascending: true, nullsFirst: false });

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
    query = query.lt("fecha_limite", new Date().toISOString());
  } else if (params.vencidas === "false") {
    query = query.gte("fecha_limite", new Date().toISOString());
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
    .select("id, email")
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
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <style>{`
        @keyframes crm-fade-slide-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .crm-list-entrance {
          opacity: 0;
          animation: crm-fade-slide-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .crm-list-entrance {
            opacity: 1;
            transform: none;
            animation: none;
          }
        }
      `}</style>

      <div className="border-b border-border pb-4">
        <p className="font-body text-xs uppercase text-text-secondary">
          Operación
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Tareas
        </h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
          Gestión activa ordenada por urgencia. Lo vencido y más próximo aparece
          primero.
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
        <div className="mt-5 space-y-3">
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className="crm-list-entrance"
              style={{
                animationDelay: `${Math.min(index * 40, 480)}ms`,
              }}
            >
              <TaskRow task={task} assigneeOptions={assigneeOptions} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-border bg-bg-surface p-6 font-body text-sm text-text-secondary shadow-lg">
          No hay tareas que coincidan con estos filtros.
        </div>
      )}

      <OrderDetailDrawer />
    </section>
  );
}
