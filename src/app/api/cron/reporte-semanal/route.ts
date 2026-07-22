import { NextResponse, type NextRequest } from "next/server";

import {
  sendTelegramMessage,
  type TelegramCountry,
} from "@/lib/notifications/sendTelegram";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type WeeklyReportMetrics = {
  pedidos_nuevos: number;
  confirmados: number;
  cancelados: number;
  entregas: number;
  devoluciones: number;
};

type WeeklyReportRow = WeeklyReportMetrics & {
  pais: TelegramCountry;
};

type WeeklyReportRpcClient = {
  rpc(
    functionName: "reporte_semanal",
    args: { p_date_from: string; p_date_to: string },
  ): PromiseLike<{
    data: WeeklyReportRow[] | null;
    error: { message: string } | null;
  }>;
};

type WeeklyReportRecipient = {
  id: string;
  telegram_chat_id: string | null;
};

type WeeklyReportRange = {
  dateFrom: string;
  dateTo: string;
};

type WeeklyReportRunResult = WeeklyReportRange & {
  message: string;
  recipients: number;
  sent: number;
  failed: number;
};

const BOGOTA_TIME_ZONE = "America/Bogota";
const countries = ["CO", "MX"] as const satisfies readonly TelegramCountry[];
const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const countFormatter = new Intl.NumberFormat("es-CO");

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(
    cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`,
  );
}

function getBogotaDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftUtcDate(date: Date, days: number) {
  const shiftedDate = new Date(date);
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
  return shiftedDate;
}

export function getWeeklyReportRange(now = new Date()): WeeklyReportRange {
  const todayInBogota = getBogotaDate(now);
  const daysSinceSaturday = (todayInBogota.getUTCDay() + 1) % 7;
  const latestSaturday = shiftUtcDate(todayInBogota, -daysSinceSaturday);

  return {
    dateFrom: formatDateInput(shiftUtcDate(latestSaturday, -7)),
    dateTo: formatDateInput(shiftUtcDate(latestSaturday, -1)),
  };
}

function createEmptyMetrics(): WeeklyReportMetrics {
  return {
    pedidos_nuevos: 0,
    confirmados: 0,
    cancelados: 0,
    entregas: 0,
    devoluciones: 0,
  };
}

function toCount(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function addMetrics(
  current: WeeklyReportMetrics,
  next: Partial<WeeklyReportMetrics>,
): WeeklyReportMetrics {
  return {
    pedidos_nuevos: current.pedidos_nuevos + toCount(next.pedidos_nuevos),
    confirmados: current.confirmados + toCount(next.confirmados),
    cancelados: current.cancelados + toCount(next.cancelados),
    entregas: current.entregas + toCount(next.entregas),
    devoluciones: current.devoluciones + toCount(next.devoluciones),
  };
}

function getMetricsByCountry(rows: WeeklyReportRow[]) {
  const metricsByCountry: Record<TelegramCountry, WeeklyReportMetrics> = {
    CO: createEmptyMetrics(),
    MX: createEmptyMetrics(),
  };

  for (const row of rows) {
    metricsByCountry[row.pais] = addMetrics(metricsByCountry[row.pais], row);
  }

  return metricsByCountry;
}

function formatMetrics(metrics: WeeklyReportMetrics) {
  return [
    `Pedidos nuevos: ${countFormatter.format(metrics.pedidos_nuevos)}`,
    `Confirmados: ${countFormatter.format(metrics.confirmados)}`,
    `Cancelados: ${countFormatter.format(metrics.cancelados)}`,
    `Entregas: ${countFormatter.format(metrics.entregas)}`,
    `Devoluciones: ${countFormatter.format(metrics.devoluciones)}`,
  ].join("\n");
}

export function formatWeeklyReport(
  range: WeeklyReportRange,
  rows: WeeklyReportRow[],
) {
  const metricsByCountry = getMetricsByCountry(rows);
  const combinedMetrics = countries.reduce(
    (total, country) => addMetrics(total, metricsByCountry[country]),
    createEmptyMetrics(),
  );

  return [
    `📊 Reporte semanal (${dateFormatter.format(new Date(`${range.dateFrom}T00:00:00Z`))} - ${dateFormatter.format(new Date(`${range.dateTo}T00:00:00Z`))})`,
    "",
    "🇨🇴 Colombia",
    formatMetrics(metricsByCountry.CO),
    "",
    "🇲🇽 México",
    formatMetrics(metricsByCountry.MX),
    "",
    "📈 Total combinado",
    formatMetrics(combinedMetrics),
  ].join("\n");
}

export async function runWeeklyReport(
  now = new Date(),
): Promise<WeeklyReportRunResult> {
  const range = getWeeklyReportRange(now);
  const supabase = createAdminClient();
  const reportsClient = supabase as unknown as WeeklyReportRpcClient;
  const { data: reportRows, error: reportError } = await reportsClient.rpc(
    "reporte_semanal",
    {
      p_date_from: range.dateFrom,
      p_date_to: range.dateTo,
    },
  );

  if (reportError) {
    throw new Error(`Failed to load weekly report: ${reportError.message}`);
  }

  const message = formatWeeklyReport(range, reportRows ?? []);
  const { data: activeProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,telegram_chat_id")
    .eq("activo", true);

  if (profilesError) {
    throw new Error(`Failed to load Telegram recipients: ${profilesError.message}`);
  }

  const recipients = (activeProfiles ?? []) as WeeklyReportRecipient[];
  let sent = 0;
  let failed = 0;

  for (const profile of recipients) {
    const chatId = profile.telegram_chat_id?.trim();

    if (!chatId) {
      continue;
    }

    try {
      await sendTelegramMessage(chatId, message);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error("Failed to send Telegram weekly report", {
        profileId: profile.id,
        error,
      });
    }
  }

  return {
    ...range,
    message,
    recipients: recipients.filter((profile) => profile.telegram_chat_id?.trim())
      .length,
    sent,
    failed,
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runWeeklyReport());
  } catch (error) {
    console.error("Failed to send weekly report", error);

    return NextResponse.json(
      { error: "Failed to send weekly report" },
      { status: 500 },
    );
  }
}
