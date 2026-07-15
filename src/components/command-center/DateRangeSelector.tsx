"use client";

import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const rangeOptions = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
] as const;

type DateRangeSelectorProps = {
  currentRange: string;
  dateFrom: string;
  dateTo: string;
};

function parseDateInput(value: string) {
  const date = parseISO(value);

  return isValid(date) ? date : new Date();
}

function getSelectedRange(dateFrom: string, dateTo: string): DateRange {
  return {
    from: parseDateInput(dateFrom),
    to: parseDateInput(dateTo),
  };
}

function formatRangeLabel(range: DateRange | undefined) {
  if (!range?.from || !range.to) {
    return "Rango personalizado";
  }

  return `${format(range.from, "dd MMM", { locale: es })} - ${format(
    range.to,
    "dd MMM",
    { locale: es },
  )}`;
}

export function DateRangeSelector({
  currentRange,
  dateFrom,
  dateTo,
}: DateRangeSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() =>
    getSelectedRange(dateFrom, dateTo),
  );

  function updateRange(range: string) {
    const params = new URLSearchParams(searchParams);
    params.set("range", range);
    params.delete("from");
    params.delete("to");
    router.push(`${pathname}?${params.toString()}`);
  }

  function updateCalendarOpen(nextOpen: boolean) {
    setIsCalendarOpen(nextOpen);

    if (nextOpen) {
      setDraftRange(getSelectedRange(dateFrom, dateTo));
    }
  }

  function applyCustomRange() {
    if (!draftRange?.from || !draftRange.to) {
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.set("range", "custom");
    params.set("from", format(draftRange.from, "yyyy-MM-dd"));
    params.set("to", format(draftRange.to, "yyyy-MM-dd"));
    router.push(`${pathname}?${params.toString()}`);
    setIsCalendarOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="inline-flex rounded-full border border-border bg-bg-surface p-1 shadow-lg"
        aria-label="Rango de fechas"
      >
        {rangeOptions.map((option) => {
          const isActive = option.value === currentRange;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              className={`h-9 rounded-full px-4 font-body text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? "bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)]"
                  : "text-text-secondary hover:bg-bg-page hover:text-text-primary"
              }`}
              onClick={() => updateRange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <Popover open={isCalendarOpen} onOpenChange={updateCalendarOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-pressed={currentRange === "custom"}
            className={`inline-flex h-11 items-center gap-2 rounded-full border border-border bg-bg-surface px-4 font-body text-sm font-medium shadow-lg outline-none transition-colors hover:bg-bg-page focus-visible:ring-2 focus-visible:ring-ring ${
              currentRange === "custom"
                ? "text-[var(--color-badge-nuevo)] ring-1 ring-[var(--color-badge-nuevo-bg)]"
                : "text-text-secondary"
            }`}
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {currentRange === "custom"
              ? formatRangeLabel(getSelectedRange(dateFrom, dateTo))
              : "Rango personalizado"}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto rounded-2xl border border-border bg-bg-surface p-0 text-text-primary shadow-xl"
        >
          <Calendar
            mode="range"
            selected={draftRange}
            onSelect={setDraftRange}
            defaultMonth={draftRange?.from}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
            locale={es}
            className="rounded-2xl bg-bg-surface"
          />
          <div className="flex items-center justify-between gap-4 border-t border-border p-3">
            <p className="font-mono text-xs tabular-nums text-text-secondary">
              {formatRangeLabel(draftRange)}
            </p>
            <button
              type="button"
              disabled={!draftRange?.from || !draftRange.to}
              onClick={applyCustomRange}
              className="h-9 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 font-body text-sm font-semibold text-bg-surface outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
