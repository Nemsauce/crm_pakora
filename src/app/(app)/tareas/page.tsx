import { TaskRow, type TaskWithOrderContext } from "@/components/tasks/TaskRow";
import { createClient } from "@/lib/supabase/server";

export default async function TareasPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*, orders(id,nombre,apellido,numero_orden)")
    .in("estado", ["pendiente", "en_progreso"])
    .order("fecha_limite", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`No se pudieron cargar las tareas: ${error.message}`);
  }

  const tasks = (data ?? []) as TaskWithOrderContext[];

  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
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

      {tasks.length > 0 ? (
        <div className="mt-5 space-y-3">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-border bg-bg-surface p-6 font-body text-sm text-text-secondary shadow-lg">
          No hay tareas pendientes.
        </div>
      )}
    </section>
  );
}
