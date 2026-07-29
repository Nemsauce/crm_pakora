import { saveAssistantRules } from "@/app/(app)/configuracion/asistente/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type AssistantSettingsPageProps = {
  searchParams?: Promise<{
    guardado?: string | string[];
  }>;
};

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AssistantSettingsPage({
  searchParams,
}: AssistantSettingsPageProps) {
  const params = await searchParams;
  const saved = getFirstSearchParam(params?.guardado) === "1";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asistente_whatsapp_config")
    .select("reglas")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudieron cargar las reglas: ${error.message}`);
  }

  const reglas = typeof data?.reglas === "string" ? data.reglas : "";

  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="border-b border-border pb-4">
        <p className="font-body text-xs uppercase text-text-secondary">
          CONFIGURACIÓN
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Reglas del asistente
        </h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
          Estas indicaciones se agregan a cada borrador de respuesta de
          WhatsApp para que Leidy siga las reglas operativas de Pakora.
        </p>
      </div>

      {saved ? (
        <p
          role="status"
          className="mt-5 rounded-2xl border border-[var(--color-positive)]/30 bg-positive-bg px-4 py-3 font-body text-sm text-positive"
        >
          Reglas guardadas.
        </p>
      ) : null}

      <form action={saveAssistantRules} className="mt-6 max-w-3xl">
        <section className="rounded-2xl border border-border bg-bg-surface p-5 shadow-lg">
          <label
            htmlFor="asistente-whatsapp-reglas"
            className="font-display text-base font-semibold text-[var(--foreground)]"
          >
            Reglas adicionales del negocio
          </label>
          <p className="mt-2 font-body text-sm text-[var(--muted-foreground)]">
            Escribe instrucciones claras y permanentes para las respuestas.
            Déjalo vacío si no necesitas reglas adicionales.
          </p>
          <textarea
            id="asistente-whatsapp-reglas"
            name="reglas"
            defaultValue={reglas}
            rows={14}
            placeholder="Ej. Si el cliente pregunta por cambios de dirección, indica que revisaremos el caso antes de confirmarlo."
            className="mt-4 w-full rounded-lg border border-border bg-bg-page px-3 py-2 font-body text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--color-accent)] focus-visible:ring-3 focus-visible:ring-[var(--color-accent)]/20"
          />
          <div className="mt-4 flex justify-end">
            <Button
              type="submit"
              className="h-9 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 text-bg-surface hover:opacity-90"
            >
              Guardar
            </Button>
          </div>
        </section>
      </form>
    </section>
  );
}
