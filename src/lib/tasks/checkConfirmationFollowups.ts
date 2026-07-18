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

export function getConfirmationDaysElapsed(
  orderDate: string,
  currentDate = getCurrentDate(),
) {
  const orderTimestamp = parseDateOnly(orderDate);
  const currentTimestamp = parseDateOnly(currentDate);

  if (orderTimestamp === null || currentTimestamp === null) {
    return null;
  }

  return Math.floor((currentTimestamp - orderTimestamp) / DAY_IN_MILLISECONDS);
}

function getOrderNumber(order: Order) {
  return order.numero_orden ?? String(order.id);
}

export function getConfirmationFollowupConfig(
  order: Order,
  daysElapsed: number,
): FollowupConfig | null {
  if (daysElapsed < 1) {
    return null;
  }

  const orderNumber = getOrderNumber(order);
  const elapsedDaysLabel = `${daysElapsed} ${daysElapsed === 1 ? "día" : "días"}`;

  if (daysElapsed >= 6) {
    return {
      stage: "cancelar",
      attemptNumber: CANCELLATION_ATTEMPT_NUMBER,
      titulo: `Cancelar pedido ${orderNumber} por falta de confirmación`,
      descripcion: `El pedido sigue en PENDIENTE CONFIRMACION después de ${elapsedDaysLabel}. Se agotaron los 6 toques de confirmación; cancelar el pedido por falta de confirmación.`,
    };
  }

  const touchNumber = daysElapsed + 1;

  return {
    stage: `toque${touchNumber}` as FollowupStage,
    attemptNumber: touchNumber,
    titulo: `Toque ${touchNumber}: llamar para confirmar pedido ${orderNumber}`,
    descripcion: `Seguimiento diario ${touchNumber} de 6 para confirmar el pedido. Ha transcurrido ${elapsedDaysLabel} desde la fecha del pedido (${order.fecha}).`,
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
      .not("fecha", "is", null)
      .lte("fecha", getCurrentDate())
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

      if (categoria !== "nuevo" || !order.fecha) {
        continue;
      }

      const daysElapsed = getConfirmationDaysElapsed(order.fecha);
      const followup =
        daysElapsed === null
          ? null
          : getConfirmationFollowupConfig(order, daysElapsed);

      if (!followup) {
        continue;
      }

      ordersProcessed += 1;

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
