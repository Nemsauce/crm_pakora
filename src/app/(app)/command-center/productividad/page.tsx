import { DateRangeSelector } from "@/components/command-center/DateRangeSelector";
import {
  ProductivityTable,
  type TaskCompletionByUserRow,
  type TaskHandlingTimeByUserRow,
} from "@/components/command-center/ProductivityTable";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  range?: string;
  from?: string;
  to?: string;
};

type CommandCenterProductividadPageProps = {
  searchParams: Promise<SearchParams>;
};

type DateRangeArgs = {
  p_date_from: string;
  p_date_to: string;
};

type TaskCompletionsRpcClient = {
  rpc: (
    functionName: "task_completions_by_user",
    args: DateRangeArgs,
  ) => PromiseLike<{
    data: TaskCompletionByUserRow[] | null;
    error: { message: string } | null;
  }>;
};

type TaskHandlingTimeRpcClient = {
  rpc: (
    functionName: "task_handling_time_by_user",
    args: DateRangeArgs,
  ) => PromiseLike<{
    data: TaskHandlingTimeByUserRow[] | null;
    error: { message: string } | null;
  }>;
};

const validRanges = new Set(["7", "30", "90"]);

function getRange(value: string | undefined) {
  return value && validRanges.has(value) ? value : "30";
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange(days: number) {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateTo.getDate() - days);

  return {
    dateFrom: formatDateInput(dateFrom),
    dateTo: formatDateInput(dateTo),
  };
}

function parseDateInput(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && formatDateInput(date) === value
    ? date
    : null;
}

function getSelectedDateRange(params: SearchParams) {
  const customFrom = parseDateInput(params.from);
  const customTo = parseDateInput(params.to);

  if (
    params.range === "custom" &&
    customFrom &&
    customTo &&
    customFrom.getTime() <= customTo.getTime()
  ) {
    return {
      currentRange: "custom",
      dateFrom: formatDateInput(customFrom),
      dateTo: formatDateInput(customTo),
    };
  }

  const currentRange = getRange(params.range);

  return {
    currentRange,
    ...getDateRange(Number(currentRange)),
  };
}

function getTaskCompletions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: DateRangeArgs,
) {
  return (supabase as unknown as TaskCompletionsRpcClient).rpc(
    "task_completions_by_user",
    args,
  );
}

function getTaskHandlingTime(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: DateRangeArgs,
) {
  return (supabase as unknown as TaskHandlingTimeRpcClient).rpc(
    "task_handling_time_by_user",
    args,
  );
}

export default async function CommandCenterProductividadPage({
  searchParams,
}: CommandCenterProductividadPageProps) {
  const params = await searchParams;
  const { currentRange, dateFrom, dateTo } = getSelectedDateRange(params);
  const supabase = await createClient();
  const rangeArgs = {
    p_date_from: dateFrom,
    p_date_to: dateTo,
  };
  const [completionsResult, handlingTimeResult] = await Promise.all([
    getTaskCompletions(supabase, rangeArgs),
    getTaskHandlingTime(supabase, rangeArgs),
  ]);

  if (completionsResult.error) {
    throw new Error(
      `No se pudo cargar la productividad por usuario: ${completionsResult.error.message}`,
    );
  }

  if (handlingTimeResult.error) {
    throw new Error(
      `No se pudo cargar el tiempo de gestión: ${handlingTimeResult.error.message}`,
    );
  }

  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Torre de control
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            Productividad
          </h1>
          <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
            Tareas completadas y tiempo promedio de gestión por integrante.
          </p>
          <p className="mt-2 font-mono text-xs tabular-nums text-text-secondary">
            {dateFrom} - {dateTo}
          </p>
        </div>

        <DateRangeSelector
          currentRange={currentRange}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      </div>

      <section className="mt-6" aria-labelledby="team-productivity-heading">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Equipo
          </p>
          <h2
            id="team-productivity-heading"
            className="mt-2 font-display text-xl font-semibold text-text-primary"
          >
            Rendimiento por usuario
          </h2>
          <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
            Volumen de tareas manuales completadas y tiempo promedio desde la
            apertura del detalle hasta su cierre.
          </p>
        </div>

        <div className="mt-4">
          <ProductivityTable
            completionRows={completionsResult.data ?? []}
            handlingRows={handlingTimeResult.data ?? []}
          />
        </div>
      </section>
    </section>
  );
}
