"use client";

import {
  Check,
  ChevronDown,
  Clock,
  Globe,
  Search,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Select } from "radix-ui";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FilterValue = "todos" | string;
type TaskFilterKey = "estado_vista" | "tipo" | "pais" | "vencidas" | "q";
type CountryFilter = "todos" | "CO" | "MX";

const COUNTRY_STORAGE_KEY = "tareas-country-filter";

const tipoOptions = [
  { value: "todos", label: "Todos los tipos" },
  { value: "llamar_confirmacion", label: "Llamar confirmación" },
  { value: "notificar_guia", label: "Notificar guía" },
  { value: "presionar_entrega", label: "Presionar entrega" },
  { value: "notificar_proximo_llegar", label: "Próximo a llegar" },
  { value: "resolver_novedad", label: "Resolver novedad" },
];

const paisOptions = [
  { value: "todos", label: "Todos los países" },
  { value: "CO", label: "Colombia" },
  { value: "MX", label: "México" },
];

const vencidasOptions = [
  { value: "todos", label: "Cualquier vencimiento" },
  { value: "true", label: "Solo vencidas" },
  { value: "false", label: "Solo a tiempo" },
];

const vistaOptions = [
  { value: "abiertas", label: "Abiertas" },
  { value: "completadas", label: "Completadas" },
  { value: "pospuestas", label: "Pospuestas" },
  { value: "todas", label: "Todas" },
] as const;

function isCountryFilter(value: unknown): value is CountryFilter {
  return value === "todos" || value === "CO" || value === "MX";
}

function clearStoredCountry() {
  try {
    window.localStorage.removeItem(COUNTRY_STORAGE_KEY);
  } catch {
    // localStorage may be unavailable in privacy-restricted browser contexts.
  }
}

function readStoredCountry(): CountryFilter | null {
  try {
    const value = window.localStorage.getItem(COUNTRY_STORAGE_KEY);

    if (value === null) {
      return null;
    }

    if (!isCountryFilter(value)) {
      window.localStorage.removeItem(COUNTRY_STORAGE_KEY);
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

function persistCountry(value: string) {
  try {
    if (value === "CO" || value === "MX") {
      window.localStorage.setItem(COUNTRY_STORAGE_KEY, value);
      return;
    }

    window.localStorage.removeItem(COUNTRY_STORAGE_KEY);
  } catch {
    // localStorage may be unavailable in privacy-restricted browser contexts.
  }
}

function ViewToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="font-body text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
        Vista
      </span>
      <div
        className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface-subtle)] p-1 sm:inline-grid sm:grid-cols-4"
        aria-label="Vista de tareas"
      >
        {vistaOptions.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              className={`min-h-[var(--density-row-height-compact)] rounded-lg border px-3 font-body text-sm font-semibold outline-none transition-[color,background-color,border-color] duration-[var(--motion-duration-hover-focus)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                isActive
                  ? "border-[var(--color-border-selected)] bg-[var(--color-bg-selected)] text-[var(--color-accent)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              }`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
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
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        className="inline-flex min-h-[var(--density-row-height-compact)] min-w-0 items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface-elevated)] px-3 font-body text-sm text-[var(--color-text-primary)] outline-none transition-[color,background-color,border-color] duration-[var(--motion-duration-hover-focus)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        aria-label={label}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon
            className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]"
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">
            <span className="text-[var(--color-text-secondary)]">{label}: </span>
            <span className="font-semibold">
              <Select.Value />
            </span>
          </span>
        </span>
        <Select.Icon>
          <ChevronDown
            className="h-4 w-4 text-[var(--color-text-secondary)]"
            aria-hidden="true"
          />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-[var(--z-index-dropdown-popover)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface-elevated)] text-[var(--color-text-primary)] shadow-md"
        >
          <Select.Viewport className="p-1">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="relative flex min-h-[var(--density-row-height-compact)] cursor-default select-none items-center rounded-lg py-2 pr-8 pl-3 font-body text-sm outline-none data-[highlighted]:bg-[var(--color-bg-hover)] data-[state=checked]:bg-[var(--color-bg-selected)] data-[state=checked]:font-semibold data-[state=checked]:text-[var(--color-accent)]"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-3 inline-flex items-center">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function SearchFilter({
  initialValue,
  onSubmit,
}: {
  initialValue: string;
  onSubmit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(initialValue);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    setDraft(value);
    onSubmit(value);
  }

  return (
    <form
      onSubmit={submitSearch}
      role="search"
      className="flex min-h-[var(--density-row-height-compact)] min-w-0 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface-elevated)] px-3 transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus-within:ring-2 focus-within:ring-[var(--ring)] sm:col-span-2 lg:col-span-1"
    >
      <Search
        className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]"
        aria-hidden="true"
      />
      <label htmlFor="task-search" className="sr-only">
        Buscar cliente o número de orden
      </label>
      <Input
        id="task-search"
        type="search"
        placeholder="Cliente o número de orden"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="h-auto min-w-0 border-0 bg-transparent p-0 font-body text-sm text-[var(--color-text-primary)] shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
    </form>
  );
}

export function TaskFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousCountryParam = useRef<string | null | undefined>(undefined);

  const tipo = searchParams.get("tipo") ?? "todos";
  const rawCountry = searchParams.get("pais");
  const pais = isCountryFilter(rawCountry) ? rawCountry : "todos";
  const vencidas = searchParams.get("vencidas") ?? "todos";
  const estadoVista = searchParams.get("estado_vista") ?? "abiertas";
  const [searchResetVersion, setSearchResetVersion] = useState(0);
  const q = searchParams.get("q") ?? "";
  const hasActiveFilters =
    tipo !== "todos" ||
    pais !== "todos" ||
    vencidas !== "todos" ||
    estadoVista !== "abiertas" ||
    q !== "";

  useEffect(() => {
    if (previousCountryParam.current === rawCountry) {
      return;
    }

    const shouldRestoreStoredCountry =
      previousCountryParam.current === undefined && rawCountry === null;
    previousCountryParam.current = rawCountry;

    if (shouldRestoreStoredCountry) {
      const storedCountry = readStoredCountry();

      if (!storedCountry || storedCountry === "todos") {
        clearStoredCountry();
        return;
      }

      const params = new URLSearchParams(searchParams.toString());
      params.set("pais", storedCountry);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return;
    }

    if (rawCountry !== null && isCountryFilter(rawCountry)) {
      persistCountry(rawCountry);
    } else {
      clearStoredCountry();
    }
  }, [pathname, rawCountry, router, searchParams]);

  function updateFilter(
    key: TaskFilterKey,
    value: string,
    defaultValue = "todos",
  ) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    if (key === "pais") {
      persistCountry(value);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function clearFilters() {
    setSearchResetVersion((version) => version + 1);
    clearStoredCountry();
    router.push(pathname);
  }

  return (
    <div className="flex flex-col gap-3">
      <ViewToggle
        value={estadoVista}
        onChange={(value) => updateFilter("estado_vista", value, "abiertas")}
      />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface-subtle)] p-2.5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(15rem,1.5fr)_auto]">
          <FilterSelect
            label="Tipo"
            icon={Tag}
            value={tipo}
            options={tipoOptions}
            onChange={(value) => updateFilter("tipo", value)}
          />
          <FilterSelect
            label="País"
            icon={Globe}
            value={pais}
            options={paisOptions}
            onChange={(value) => updateFilter("pais", value)}
          />
          <FilterSelect
            label="Vence"
            icon={Clock}
            value={vencidas}
            options={vencidasOptions}
            onChange={(value) => updateFilter("vencidas", value)}
          />

          <SearchFilter
            key={`${q}:${searchResetVersion}`}
            initialValue={q}
            onSubmit={(value) => updateFilter("q", value, "")}
          />

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-[var(--density-row-height-compact)] rounded-xl border-[var(--color-border)] bg-[var(--color-bg-surface-elevated)] px-3 text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] sm:col-span-2 lg:col-span-1"
              onClick={clearFilters}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Limpiar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
