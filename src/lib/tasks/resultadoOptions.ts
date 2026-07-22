import type { Database } from "@/lib/supabase/database.types";

type TaskType = Database["public"]["Enums"]["tipo_tarea_enum"];

export const resultadoOptions = {
  llamar_confirmacion: [
    "Confirmado",
    "No contesta / no se pudo comunicar",
    "Cliente pidió cambios (dirección/producto)",
    "Cliente canceló",
    "Número equivocado",
    "Mensaje enviado, esperando respuesta",
  ],
  notificar_guia: ["Notificado exitosamente", "No se pudo contactar"],
  presionar_entrega: ["Notificado"],
  resolver_novedad: [
    "Novedad resuelta",
    "Cliente decidió cancelar",
    "Devolución",
    "Escalado a transportadora/Dropi",
    "Esperando respuesta de cliente",
  ],
  notificar_proximo_llegar: ["Notificado exitosamente"],
} as const satisfies Record<TaskType, readonly string[]>;

export function isValidResultado(tipo: TaskType, resultado: string) {
  return (resultadoOptions[tipo] as readonly string[]).includes(resultado);
}
