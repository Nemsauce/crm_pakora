"use client";

import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  ChevronDown,
  Globe,
  PieChart,
  Search,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Select } from "radix-ui";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type FilterValue = "todos" | string;

type StoredOrderFilters = {
  pais: string;
  estado_crm: string;
  nivel_riesgo: string;
};

const FILTER_STORAGE_KEY = "pedidos-filters";
const FILTER_KEYS = ["pais", "estado_crm", "nivel_riesgo"] as const;
const DATE_FILTER_KEYS = ["fecha_desde", "fecha_hasta"] as const;
const URL_FILTER_KEYS = [...FILTER_KEYS, ...DATE_FILTER_KEYS] as const;

const countryOptions = [
  { value: "todos", label: "Todos" },
  { value: "CO", label: "CO" },
  { value: "MX", label: "MX" },
];

const statusOptions = [
  { value: "todos", label: "Todos" },
  { value: "nuevo", label: "Nuevo" },
  { value: "en_ruta", label: "En ruta" },
  { value: "entregado", label: "Entregado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "devolucion", label: "Devolución" },
];

const riskOptions = [
  { value: "todos", label: "Todos" },
  { value: "alto", label: "Alto" },
  { value: "medio", label: "Medio" },
  { value: "bajo", label: "Bajo" },
  { value: "sin_datos", label: "Sin datos" },
];

function isValidOption(
  value: unknown,
  options: { value: string; label: string }[],
) {
  return (
    typeof value === "string" &&
    options.some((option) => option.value === value)
  );
}

function getFiltersFromParams(params: URLSearchParams): StoredOrderFilters {
  return {
    pais: params.get("pais") ?? "todos",
    estado_crm: params.get("estado_crm") ?? "todos",
    nivel_riesgo: params.get("nivel_riesgo") ?? "todos",
  };
}

function readStoredFilters(): StoredOrderFilters | null {
  try {
    const rawValue = window.localStorage.getItem(FILTER_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredOrderFilters>;

    if (
      !isValidOption(parsed.pais, countryOptions) ||
      !isValidOption(parsed.estado_crm, statusOptions) ||
      !isValidOption(parsed.nivel_riesgo, riskOptions)
    ) {
      window.localStorage.removeItem(FILTER_STORAGE_KEY);
      return null;
    }

    return parsed as StoredOrderFilters;
  } catch {
    return null;
  }
}

function persistFilters(filters: StoredOrderFilters) {
  try {
    const hasActiveFilter = Object.values(filters).some(
      (value) => value !== "todos",
    );

    if (hasActiveFilter) {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } else {
      window.localStorage.removeItem(FILTER_STORAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable in privacy-restricted browser contexts.
  }
}

function parseDateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = parseISO(value);

  return isValid(date) && format(date, "yyyy-MM-dd") === value
    ? date
    : undefined;
}

function formatDateFilterLabel(fromValue: string | null, toValue: string | null) {
  const from = parseDateParam(fromValue);
  const to = parseDateParam(toValue);

  if (!from && !to) {
    return "Todas las fechas";
  }

  const selectedFrom = from ?? to;
  const selectedTo = to ?? from;

  if (!selectedFrom || !selectedTo) {
    return "Todas las fechas";
  }

  const firstDate = selectedFrom <= selectedTo ? selectedFrom : selectedTo;
  const lastDate = selectedFrom <= selectedTo ? selectedTo : selectedFrom;

  if (format(firstDate, "yyyy-MM-dd") === format(lastDate, "yyyy-MM-dd")) {
    return format(firstDate, "d MMM", { locale: es });
  }

  return `${format(firstDate, "d MMM", { locale: es })} – ${format(
    lastDate,
    "d MMM",
    { locale: es },
  )}`;
}

function FilterSelect({
  label,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: LucideIcon;
  value: FilterValue;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <Select.Root value={value} onValueChange={onChange}>
        <Select.Trigger
          className="inline-flex h-14 min-w-44 items-center justify-between gap-3 rounded-2xl border border-border bg-bg-surface px-3 font-body text-sm text-[var(--foreground)] shadow-sm outline-none transition-colors hover:bg-bg-page focus:ring-2 focus:ring-ring"
          aria-label={label}
        >
          <span className="flex min-w-0 items-center gap-3">
            <Icon
              className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]"
              aria-hidden="true"
            />
            <span className="grid min-w-0 text-left leading-tight">
              <span className="font-body text-xs text-[var(--muted-foreground)]">
                {label}
              </span>
              <span className="truncate font-body text-sm text-[var(--foreground)]">
                <Select.Value />
              </span>
            </span>
          </span>
          <Select.Icon>
            <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            className="z-50 overflow-hidden rounded-2xl border border-border bg-bg-surface text-[var(--foreground)] shadow-md"
          >
            <Select.Viewport className="p-1">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex h-8 cursor-default select-none items-center rounded-lg px-2 font-body text-sm text-[var(--foreground)] outline-none data-[highlighted]:bg-[var(--color-accent)]/10 data-[highlighted]:text-[var(--color-accent)]"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </label>
  );
}

export function OrderFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasInitializedPersistence = useRef(false);

  const pais = searchParams.get("pais") ?? "todos";
  const estadoCrm = searchParams.get("estado_crm") ?? "todos";
  const nivelRiesgo = searchParams.get("nivel_riesgo") ?? "todos";
  const fechaDesde = searchParams.get("fecha_desde");
  const fechaHasta = searchParams.get("fecha_hasta");
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") ?? "");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [dateMode, setDateMode] = useState<"single" | "range">(() =>
    fechaDesde && fechaHasta && fechaDesde !== fechaHasta ? "range" : "single",
  );
  const [draftSingleDate, setDraftSingleDate] = useState<Date | undefined>(() =>
    parseDateParam(fechaDesde ?? fechaHasta),
  );
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() => ({
    from: parseDateParam(fechaDesde ?? fechaHasta),
    to: parseDateParam(fechaHasta ?? fechaDesde),
  }));
  const q = searchParams.get("q") ?? "";
  const hasDateFilter = Boolean(fechaDesde || fechaHasta);
  const hasActiveFilters =
    pais !== "todos" ||
    estadoCrm !== "todos" ||
    nivelRiesgo !== "todos" ||
    hasDateFilter ||
    q !== "";

  useEffect(() => {
    if (hasInitializedPersistence.current) {
      if (FILTER_KEYS.some((key) => searchParams.has(key))) {
        persistFilters(getFiltersFromParams(new URLSearchParams(searchParams)));
      }

      return;
    }

    hasInitializedPersistence.current = true;
    const hasUrlFilter = URL_FILTER_KEYS.some((key) => searchParams.has(key));

    if (hasUrlFilter) {
      if (FILTER_KEYS.some((key) => searchParams.has(key))) {
        persistFilters(getFiltersFromParams(new URLSearchParams(searchParams)));
      }

      return;
    }

    const storedFilters = readStoredFilters();

    if (!storedFilters) {
      return;
    }

    const params = new URLSearchParams(searchParams);

    for (const key of FILTER_KEYS) {
      const value = storedFilters[key];

      if (value === "todos") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);

    params.delete("page");

    if (value === "todos" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    persistFilters(getFiltersFromParams(params));

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilter("q", searchDraft.trim());
  }

  function updateCalendarOpen(nextOpen: boolean) {
    setIsCalendarOpen(nextOpen);

    if (!nextOpen) {
      return;
    }

    const selectedFrom = parseDateParam(fechaDesde ?? fechaHasta);
    const selectedTo = parseDateParam(fechaHasta ?? fechaDesde);
    const selectedMode =
      selectedFrom &&
      selectedTo &&
      format(selectedFrom, "yyyy-MM-dd") !==
        format(selectedTo, "yyyy-MM-dd")
        ? "range"
        : "single";

    setDateMode(selectedMode);
    setDraftSingleDate(selectedFrom);
    setDraftRange({ from: selectedFrom, to: selectedTo });
  }

  function changeDateMode(nextMode: "single" | "range") {
    setDateMode(nextMode);

    if (nextMode === "single") {
      setDraftSingleDate(draftRange?.from ?? draftSingleDate);
    } else {
      setDraftRange({
        from: draftSingleDate ?? draftRange?.from,
        to: undefined,
      });
    }
  }

  function applyDateFilter() {
    const params = new URLSearchParams(searchParams);
    let selectedFrom: Date | undefined;
    let selectedTo: Date | undefined;

    if (dateMode === "single") {
      selectedFrom = draftSingleDate;
      selectedTo = draftSingleDate;
    } else {
      selectedFrom = draftRange?.from;
      selectedTo = draftRange?.to;
    }

    if (!selectedFrom || !selectedTo) {
      return;
    }

    const from = selectedFrom <= selectedTo ? selectedFrom : selectedTo;
    const to = selectedFrom <= selectedTo ? selectedTo : selectedFrom;

    params.delete("page");
    params.set("fecha_desde", format(from, "yyyy-MM-dd"));
    params.set("fecha_hasta", format(to, "yyyy-MM-dd"));

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setIsCalendarOpen(false);
  }

  function clearDateFilter() {
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    params.delete("fecha_desde");
    params.delete("fecha_hasta");

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setIsCalendarOpen(false);
  }

  function clearFilters() {
    setSearchDraft("");
    persistFilters({
      pais: "todos",
      estado_crm: "todos",
      nivel_riesgo: "todos",
    });
    router.push(pathname);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-bg-surface p-3 shadow-sm md:flex-row md:items-end md:justify-between">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <FilterSelect
          label="País"
          icon={Globe}
          value={pais}
          options={countryOptions}
          onChange={(value) => updateFilter("pais", value)}
        />
        <FilterSelect
          label="Estado CRM"
          icon={PieChart}
          value={estadoCrm}
          options={statusOptions}
          onChange={(value) => updateFilter("estado_crm", value)}
        />
        <FilterSelect
          label="Riesgo"
          icon={Shield}
          value={nivelRiesgo}
          options={riskOptions}
          onChange={(value) => updateFilter("nivel_riesgo", value)}
        />

        <Popover open={isCalendarOpen} onOpenChange={updateCalendarOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-14 min-w-44 items-center justify-between gap-3 rounded-2xl border border-border bg-bg-surface px-3 font-body text-sm text-[var(--foreground)] shadow-sm outline-none transition-colors hover:bg-bg-page focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 items-center gap-3">
                <CalendarDays
                  className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]"
                  aria-hidden="true"
                />
                <span className="grid min-w-0 text-left leading-tight">
                  <span className="font-body text-xs text-[var(--muted-foreground)]">
                    Fecha
                  </span>
                  <span className="truncate font-body text-sm text-[var(--foreground)]">
                    {formatDateFilterLabel(fechaDesde, fechaHasta)}
                  </span>
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="max-w-[calc(100vw-2rem)] overflow-x-auto rounded-2xl border border-border bg-bg-surface p-0 text-text-primary shadow-xl"
          >
            <div className="flex items-center gap-1 border-b border-border p-3">
              {(["single", "range"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={dateMode === mode}
                  onClick={() => changeDateMode(mode)}
                  className={`h-9 rounded-full px-4 font-body text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                    dateMode === mode
                      ? "bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)]"
                      : "text-text-secondary hover:bg-bg-page hover:text-text-primary"
                  }`}
                >
                  {mode === "single" ? "Un día" : "Rango"}
                </button>
              ))}
            </div>

            {dateMode === "single" ? (
              <Calendar
                mode="single"
                selected={draftSingleDate}
                onSelect={setDraftSingleDate}
                defaultMonth={draftSingleDate}
                disabled={{ after: new Date() }}
                locale={es}
                className="rounded-2xl bg-bg-surface"
              />
            ) : (
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
            )}

            <div className="flex items-center justify-between gap-3 border-t border-border p-3">
              <button
                type="button"
                onClick={clearDateFilter}
                disabled={!hasDateFilter}
                className="h-9 rounded-full px-3 font-body text-sm text-text-secondary outline-none transition-colors hover:bg-bg-page hover:text-text-primary focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                Quitar fecha
              </button>
              <Button
                type="button"
                onClick={applyDateFilter}
                disabled={
                  dateMode === "single"
                    ? !draftSingleDate
                    : !draftRange?.from || !draftRange.to
                }
                className="rounded-full bg-gradient-to-r from-accent-from to-accent-to text-bg-surface hover:opacity-90"
              >
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <form onSubmit={submitSearch} className="grid gap-1.5">
          <label
            htmlFor="order-search"
            className="font-body text-xs text-[var(--muted-foreground)]"
          >
            Buscar
          </label>
          <div className="flex h-14 items-center gap-2 rounded-2xl border border-border bg-bg-surface px-3 shadow-sm focus-within:ring-2 focus-within:ring-ring">
            <Search
              className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]"
              aria-hidden="true"
            />
            <Input
              id="order-search"
              type="text"
              placeholder="Cliente o número de orden"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              className="h-8 border-0 bg-transparent p-0 font-body text-sm text-[var(--foreground)] shadow-none focus-visible:ring-0"
            />
          </div>
        </form>
      </div>

      {hasActiveFilters ? (
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-border bg-bg-surface text-[var(--foreground)] hover:bg-bg-page hover:text-[var(--foreground)]"
          onClick={clearFilters}
        >
          Limpiar filtros
        </Button>
      ) : null}
    </div>
  );
}
