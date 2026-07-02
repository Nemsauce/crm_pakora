"use client";

import {
  ChevronDown,
  Globe,
  PieChart,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "radix-ui";

import { Button } from "@/components/ui/button";

type FilterValue = "todos" | string;

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
          className="inline-flex h-14 min-w-44 items-center justify-between gap-3 rounded-2xl border border-border bg-bg-surface px-3 font-body text-sm text-text-primary shadow-sm outline-none transition-colors hover:bg-bg-page focus:ring-2 focus:ring-ring"
          aria-label={label}
        >
          <span className="flex min-w-0 items-center gap-3">
            <Icon
              className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]"
              aria-hidden="true"
            />
            <span className="grid min-w-0 text-left leading-tight">
              <span className="font-body text-xs text-[var(--color-text-secondary)]">
                {label}
              </span>
              <span className="truncate font-body text-sm text-text-primary">
                <Select.Value />
              </span>
            </span>
          </span>
          <Select.Icon>
            <ChevronDown className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            className="z-50 overflow-hidden rounded-2xl border border-border bg-bg-surface text-text-primary shadow-md"
          >
            <Select.Viewport className="p-1">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex h-8 cursor-default select-none items-center rounded-lg px-2 font-body text-sm text-text-primary outline-none data-[highlighted]:bg-accent/10 data-[highlighted]:text-[var(--color-accent)]"
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

  const pais = searchParams.get("pais") ?? "todos";
  const estadoCrm = searchParams.get("estado_crm") ?? "todos";
  const nivelRiesgo = searchParams.get("nivel_riesgo") ?? "todos";
  const hasActiveFilters =
    pais !== "todos" || estadoCrm !== "todos" || nivelRiesgo !== "todos";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);

    params.delete("page");

    if (value === "todos") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function clearFilters() {
    router.push(pathname);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-bg-surface p-3 shadow-sm md:flex-row md:items-end md:justify-between">
      <div className="grid gap-3 sm:grid-cols-3">
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
      </div>

      {hasActiveFilters ? (
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-border bg-bg-surface text-text-primary hover:bg-bg-page hover:text-text-primary"
          onClick={clearFilters}
        >
          Limpiar filtros
        </Button>
      ) : null}
    </div>
  );
}
