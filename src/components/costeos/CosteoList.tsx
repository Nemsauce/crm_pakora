"use client";

import { Copy, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  type MouseEvent,
  useEffect,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

import {
  deleteCosteo,
  duplicateCosteo,
} from "@/app/(app)/costeos/actions";
import { Button } from "@/components/ui/button";

export type CosteoListItem = {
  id: string;
  nombre_producto: string;
  precio_venta: number;
  created_at: string | null;
};

type Pais = "CO" | "MX";

type CosteoListProps = {
  costeos: CosteoListItem[];
  selectedId: string | null;
  pais?: Pais;
};

const countryCopy: Record<
  Pais,
  { productsLabel: string; emptyState: string }
> = {
  CO: {
    productsLabel: "Productos CO",
    emptyState: "Aún no hay costeos guardados para Colombia.",
  },
  MX: {
    productsLabel: "Productos MX",
    emptyState: "Aún no hay costeos guardados para México.",
  },
};

const moneyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
});

const COSTEO_DIRTY_EVENT = "crm:costeo-dirty-change";

function formatMoney(value: number) {
  return Number.isFinite(value) ? moneyFormatter.format(value) : "—";
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : dateFormatter.format(date);
}

export function CosteoList({ costeos, selectedId, pais }: CosteoListProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const resolvedPais = pais ?? (pathname.startsWith("/costeos/mx") ? "MX" : "CO");
  const copy = countryCopy[resolvedPais];

  useEffect(() => {
    function handleDirtyChange(event: Event) {
      const detail = (event as CustomEvent<{ dirty?: boolean }>).detail;
      setHasUnsavedChanges(detail?.dirty === true);
    }

    window.addEventListener(COSTEO_DIRTY_EVENT, handleDirtyChange);
    return () =>
      window.removeEventListener(COSTEO_DIRTY_EVENT, handleDirtyChange);
  }, []);

  function buildHref(costeoId: string | null) {
    const params = new URLSearchParams(searchParams);
    params.delete("guardado");
    params.delete("importe");

    if (costeoId) {
      params.set("costeo", costeoId);
    } else {
      params.delete("costeo");
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function confirmDiscard() {
    return (
      !hasUnsavedChanges ||
      window.confirm(
        "Tienes cambios sin guardar. ¿Quieres descartarlos y continuar?",
      )
    );
  }

  function handleLinkClick(
    event: MouseEvent<HTMLAnchorElement>,
    destinationIsCurrent: boolean,
  ) {
    if (!destinationIsCurrent && !confirmDiscard()) {
      event.preventDefault();
    }
  }

  function handleDuplicateSubmit(event: FormEvent<HTMLFormElement>) {
    if (!confirmDiscard()) {
      event.preventDefault();
    }
  }

  function handleDeleteSubmit(
    event: FormEvent<HTMLFormElement>,
    productName: string,
  ) {
    if (!confirmDiscard()) {
      event.preventDefault();
      return;
    }

    const label = productName.trim() || "Producto sin nombre";
    if (
      !window.confirm(
        `¿Eliminar el costeo de “${label}”? Esta acción no se puede deshacer.`,
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-border bg-bg-surface p-5 shadow-lg">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Costeos guardados
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-text-primary">
            {copy.productsLabel}
          </h2>
        </div>
        <Link
          href={buildHref(null)}
          onClick={(event) => handleLinkClick(event, selectedId === null)}
          className={`inline-flex h-9 items-center justify-center rounded-full px-4 font-body text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            selectedId
              ? "border border-border bg-bg-surface text-text-secondary hover:text-text-primary"
              : "bg-gradient-to-r from-accent-from to-accent-to text-bg-surface shadow-md shadow-[var(--color-accent)]/20 hover:opacity-90"
          }`}
        >
          Nuevo costeo
        </Link>
      </div>

      {costeos.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {costeos.map((costeo) => {
            const selected = selectedId === costeo.id;

            return (
              <article
                key={costeo.id}
                className={`overflow-hidden rounded-2xl border transition-all ${
                  selected
                    ? "border-[var(--color-accent)] bg-bg-page shadow-md shadow-[var(--color-accent)]/15"
                    : "border-border bg-bg-surface shadow-sm hover:bg-bg-page"
                }`}
              >
                <Link
                  href={buildHref(costeo.id)}
                  aria-current={selected ? "page" : undefined}
                  onClick={(event) => handleLinkClick(event, selected)}
                  className="block p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <p className="line-clamp-2 font-body text-sm font-semibold text-text-primary">
                    {costeo.nombre_producto || "Producto sin nombre"}
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <p className="font-mono text-lg font-semibold tabular-nums text-text-primary">
                      {formatMoney(costeo.precio_venta)}
                    </p>
                    <p className="text-right font-body text-xs text-text-secondary">
                      {formatDate(costeo.created_at)}
                    </p>
                  </div>
                </Link>

                <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
                  <form
                    action={duplicateCosteo.bind(null, costeo.id)}
                    onSubmit={handleDuplicateSubmit}
                  >
                    <CosteoActionButton action="duplicate" />
                  </form>
                  <form
                    action={deleteCosteo.bind(null, costeo.id)}
                    onSubmit={(event) =>
                      handleDeleteSubmit(event, costeo.nombre_producto)
                    }
                  >
                    <CosteoActionButton action="delete" />
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-border bg-bg-page p-4 font-body text-sm text-text-secondary">
          {copy.emptyState}
        </div>
      )}
    </section>
  );
}

function CosteoActionButton({
  action,
}: {
  action: "delete" | "duplicate";
}) {
  const { pending } = useFormStatus();
  const isDelete = action === "delete";
  const Icon = isDelete ? Trash2 : Copy;

  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={pending}
      className={`h-8 rounded-full px-3 font-body text-xs disabled:opacity-60 ${
        isDelete
          ? "text-risk-high hover:bg-risk-high-bg hover:text-risk-high"
          : "text-text-secondary hover:bg-bg-page hover:text-text-primary"
      }`}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {pending
        ? isDelete
          ? "Eliminando..."
          : "Duplicando..."
        : isDelete
          ? "Eliminar"
          : "Duplicar"}
    </Button>
  );
}
