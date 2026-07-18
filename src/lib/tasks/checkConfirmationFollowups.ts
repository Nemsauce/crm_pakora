import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureOpenTask,
  lookupCategory,
  type Order,
} from "@/lib/tasks/processOrderEvent";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1_000;
const CANCELLATION_ATTEMPT_NUMBER = 7;

type FollowupStage =
  | "toque2"
  | "toque3"
  | "toque4"
  | "toque5"
  | "toque6"
  | "cancelar";

type FollowupConfig = {
  stage: FollowupStage;
  attemptNumber: number;
  titulo: string;
  descripcion: string;
};

type CompletedConfirmationTask = {
  completado_en: string | null;
  intento_numero: number;
};

export type ConfirmationFollowupBreakdown = Record<FollowupStage, number>;

export type CheckConfirmationFollowupsResult = {
  ordersProcessed: number;
  tasksCreated: ConfirmationFollowupBreakdown;
  errors: { order_id: number; error: string }[];
};

function emptyBreakdown(): ConfirmationFollowupBreakdown {
  return {
    toque2: 0,
    toque3: 0,
    toque4: 0,
    toque5: 0,
    toque6: 0,
    cancelar: 0,
  };
}

function getCurrentDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const timestamp = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  return Number.isFinite(timestamp) ? timestamp : null;
}

export function hasFullCalendarDayPassed(
  completedAt: string,
  currentDate = getCurrentDate(),
) {
  const completionTimestamp = Date.parse(completedAt);
  const currentTimestamp = parseDateOnly(currentDate);

  if (!Number.isFinite(completionTimestamp) || currentTimestamp === null) {
    return false;
  }

  const completionDate = new Date(completionTimestamp).toISOString().slice(0, 10);
  const completionDateTimestamp = parseDateOnly(completionDate);

  return (
    completionDateTimestamp !== null &&
    currentTimestamp - completionDateTimestamp >= DAY_IN_MILLISECONDS
  );
}

function getOrderNumber(order: Order) {
  return order.numero_orden ?? String(order.id);
}

export function getConfirmationFollowupConfig(
  order: Order,
  completedCount: number,
): FollowupConfig | null {
  const nextTouchNumber = completedCount + 1;

  if (nextTouchNumber === 1) {
    return null;
  }

  const orderNumber = getOrderNumber(order);

  if (completedCount >= 6) {
    return {
      stage: "cancelar",
      attemptNumber: CANCELLATION_ATTEMPT_NUMBER,
      titulo: `Cancelar pedido ${orderNumber} por falta de confirmación`,
      descripcion:
        "El pedido sigue en PENDIENTE CONFIRMACION después de completar los 6 toques de confirmación. Cancelar el pedido por falta de confirmación.",
    };
  }

  return {
    stage: `toque${nextTouchNumber}` as FollowupStage,
    attemptNumber: nextTouchNumber,
    titulo: `Toque ${nextTouchNumber}: llamar para confirmar pedido ${orderNumber}`,
    descripcion: `Seguimiento diario ${nextTouchNumber} de 6 para confirmar el pedido. Se han completado ${completedCount} toques de confirmación.`,
  };
}

async function loadActiveOrders() {
  const supabase = createAdminClient();
  const orders: Order[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .in("pais", ["CO", "MX"])
      .eq("activo", true)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const page = (data ?? []) as Order[];
    orders.push(...page);

    if (page.length < PAGE_SIZE) {
      return orders;
    }
  }
}

async function loadCompletedConfirmationTasks(orderId: number) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("completado_en,intento_numero")
    .eq("order_id", orderId)
    .eq("tipo", "llamar_confirmacion")
    .eq("estado", "completada")
    .gte("intento_numero", 1)
    .lte("intento_numero", 6);

  if (error) {
    throw error;
  }

  return (data ?? []) as CompletedConfirmationTask[];
}

function getMostRecentCompletion(tasks: CompletedConfirmationTask[]) {
  let mostRecentCompletion: string | null = null;
  let mostRecentTimestamp = Number.NEGATIVE_INFINITY;

  for (const task of tasks) {
    if (!task.completado_en) {
      continue;
    }

    const timestamp = Date.parse(task.completado_en);

    if (Number.isFinite(timestamp) && timestamp > mostRecentTimestamp) {
      mostRecentCompletion = task.completado_en;
      mostRecentTimestamp = timestamp;
    }
  }

  return mostRecentCompletion;
}

async function updateAttemptNumber(taskId: number, attemptNumber: number) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("tasks")
    .update({ intento_numero: attemptNumber })
    .eq("id", taskId);

  if (error) {
    throw error;
  }
}

export async function checkConfirmationFollowups(): Promise<CheckConfirmationFollowupsResult> {
  const orders = await loadActiveOrders();
  const tasksCreated = emptyBreakdown();
  const errors: CheckConfirmationFollowupsResult["errors"] = [];
  let ordersProcessed = 0;

  for (const order of orders) {
    try {
      const categoria = await lookupCategory(order);

      if (categoria !== "nuevo") {
        continue;
      }

      ordersProcessed += 1;

      const completedTasks = await loadCompletedConfirmationTasks(order.id);
      const completedCount = completedTasks.length;
      const followup = getConfirmationFollowupConfig(order, completedCount);

      if (!followup) {
        continue;
      }

      if (completedCount < 6) {
        const mostRecentCompletion = getMostRecentCompletion(completedTasks);

        if (
          !mostRecentCompletion ||
          !hasFullCalendarDayPassed(mostRecentCompletion)
        ) {
          continue;
        }
      }

      const result = await ensureOpenTask({
        order,
        tipo: "llamar_confirmacion",
        titulo: followup.titulo,
        descripcion: followup.descripcion,
      });

      if (result.action !== "task_created" || !result.taskId) {
        continue;
      }

      await updateAttemptNumber(result.taskId, followup.attemptNumber);
      tasksCreated[followup.stage] += 1;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown confirmation-followup error";

      console.error("Failed to check confirmation follow-up", {
        order_id: order.id,
        error: errorMessage,
      });

      errors.push({
        order_id: order.id,
        error: errorMessage,
      });
    }
  }

  return {
    ordersProcessed,
    tasksCreated,
    errors,
  };
}
