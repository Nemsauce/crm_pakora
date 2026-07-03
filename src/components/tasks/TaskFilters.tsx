"use client";

import { ChevronDown, Clock, Globe, Search, Tag, type LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Select } from "radix-ui";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FilterValue = "todos" | string;

const tipoOptions = [
  { value: "todos", label: "Todos" },
  { value: "llamar_confirmacion", label: "Llamar confirmación" },
  { value: "notificar_guia", label: "Notificar guía" },
  { value: "presionar_entrega", label: "Presionar entrega" },
  { value: "notificar_proximo_llegar", label: "Próximo a llegar" },
  { value: "resolver_novedad", label: "Resolver novedad" },
];

const paisOptions = [
  { value: "todos", label: "Todos" },
  { value: "CO", label: "CO" },
  { value: "MX", label: "MX" },
];

const vencidasOptions = [
  { value: "todos", label: "Todas" },
  { value: "true", label: "Vencidas" },
  { value: "false", label: "A tiempo" },
];

const vistaOptions = [
  { value: "abiertas", label: "Abiertas" },
  { value: "completadas", label: "Completadas" },
  { value: "todas", label: "Todas" },
] as const;

function ViewToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full border border-border bg-bg-surface p-1 shadow-lg"
      aria-label="Vista de tareas"
    >
      {vistaOptions.map((option) => {
        const isActive = option.value === value;

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
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
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

export function TaskFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tipo = searchParams.get("tipo") ?? "todos";
  const pais = searchParams.get("pais") ?? "todos";
  const vencidas = searchParams.get("vencidas") ?? "todos";
  const estadoVista = searchParams.get("estado_vista") ?? "abiertas";
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") ?? "");
  const q = searchParams.get("q") ?? "";
  const hasActiveFilters =
    tipo !== "todos" ||
    pais !== "todos" ||
    vencidas !== "todos" ||
    estadoVista !== "abiertas" ||
    q !== "";

  function updateFilter(key: string, value: string, defaultValue = "todos") {
    const params = new URLSearchParams(searchParams);

    if (value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilter("q", searchDraft.trim());
  }

  function clearFilters() {
    setSearchDraft("");
    router.push(pathname);
  }

  return (
    <div className="flex flex-col gap-3">
      <ViewToggle
        value={estadoVista}
        onChange={(value) => updateFilter("estado_vista", value, "abiertas")}
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-bg-surface p-3 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
            label="Vencimiento"
            icon={Clock}
            value={vencidas}
            options={vencidasOptions}
            onChange={(value) => updateFilter("vencidas", value)}
          />

          <form onSubmit={submitSearch} className="grid gap-1.5">
            <label
              htmlFor="task-search"
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
                id="task-search"
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
    </div>
  );
}
