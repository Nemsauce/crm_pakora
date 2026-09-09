"use client";

import {
  Activity,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Loader2,
  Package,
  Unlink,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "radix-ui";
import {
  type SyntheticEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { saveMetaCampaignProduct } from "@/app/(app)/command-center/campanias/actions";

export type MetaCampaignRow = {
  id: string;
  ad_account_id: string;
  nombre: string;
  estado: string;
  objetivo: string | null;
  pais: string | null;
  moneda: string | null;
  producto_base: string | null;
  actualizado_en: string;
};

export type MetaCampaignsTableProps = {
  campaigns: MetaCampaignRow[];
  productOptions: string[];
  initialStatusFilter: string;
};

type AssignmentFeedback = {
  kind: "pending" | "success" | "error";
  message: string;
};

const UNASSIGNED_PRODUCT = "__unassigned_product__";
const statusPriority = ["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"];

const statusLabels: Record<string, string> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  ARCHIVED: "Archivada",
  DELETED: "Eliminada",
};

const statusClasses: Record<string, string> = {
  ACTIVE: "border-transparent bg-positive-bg text-positive",
  PAUSED:
    "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-base)] text-text-secondary",
  ARCHIVED:
    "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-subtle)] text-text-secondary",
  DELETED: "border-transparent bg-negative-bg text-negative",
};

const updatedAtFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

function formatStatus(status: string) {
  const normalized = status.trim().toUpperCase();

  if (statusLabels[normalized]) {
    return statusLabels[normalized];
  }

  const readable = normalized.replaceAll("_", " ").toLocaleLowerCase("es");
  return readable
    ? `${readable.charAt(0).toLocaleUpperCase("es")}${readable.slice(1)}`
    : "Sin estado";
}

function getStatusClass(status: string) {
  return (
    statusClasses[status.trim().toUpperCase()] ??
    "border-transparent bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)]"
  );
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "No disponible"
    : updatedAtFormatter.format(date);
}

function stopRowNavigation(event: SyntheticEvent) {
  event.stopPropagation();
}

function ProductAssignmentSelect({
  campaignId,
  campaignName,
  currentProduct,
  productOptions,
}: {
  campaignId: string;
  campaignName: string;
  currentProduct: string | null;
  productOptions: string[];
}) {
  const [selectedProduct, setSelectedProduct] = useState(currentProduct);
  const [feedback, setFeedback] = useState<AssignmentFeedback | null>(null);
  const [isPending, startTransition] = useTransition();
  const feedbackId = `campaign-product-feedback-${campaignId}`;
  const options = useMemo(() => {
    const values = new Set(
      productOptions.map((product) => product.trim()).filter(Boolean),
    );

    if (selectedProduct) {
      values.add(selectedProduct);
    }

    return [...values].sort((left, right) =>
      left.localeCompare(right, "es", { sensitivity: "base" }),
    );
  }, [productOptions, selectedProduct]);

  useEffect(() => {
    if (!feedback || feedback.kind === "pending") {
      return;
    }

    const timeoutId = window.setTimeout(() => setFeedback(null), 3_000);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  function handleChange(nextValue: string) {
    const nextProduct =
      nextValue === UNASSIGNED_PRODUCT ? null : nextValue.trim() || null;
    const previousProduct = selectedProduct;

    if (nextProduct === previousProduct) {
      return;
    }

    setSelectedProduct(nextProduct);
    setFeedback({ kind: "pending", message: "Guardando…" });

    startTransition(async () => {
      try {
        const result = await saveMetaCampaignProduct(campaignId, nextProduct);

        if (!result.ok) {
          setSelectedProduct(previousProduct);
          setFeedback({ kind: "error", message: result.message });
          return;
        }

        setSelectedProduct(result.productoBase);
        setFeedback({ kind: "success", message: result.message });
      } catch {
        setSelectedProduct(previousProduct);
        setFeedback({
          kind: "error",
          message: "No se pudo guardar la asignación.",
        });
      }
    });
  }

  const selectedLabel = selectedProduct ?? "Asignar producto";

  return (
    <div
      className="min-w-0"
      onClick={stopRowNavigation}
      onPointerDown={stopRowNavigation}
      onKeyDown={stopRowNavigation}
    >
      <Select.Root
        value={selectedProduct ?? UNASSIGNED_PRODUCT}
        onValueChange={handleChange}
        disabled={isPending}
      >
        <Select.Trigger
          className="inline-flex min-h-[var(--density-row-height-compact)] w-full min-w-56 max-w-80 items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface-elevated)] px-3 font-body text-xs font-medium text-text-primary outline-none transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus-visible:border-[var(--color-border-selected)] focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
          aria-label={`Producto asociado a ${campaignName}`}
          aria-describedby={feedback ? feedbackId : undefined}
          aria-busy={isPending}
          title={selectedLabel}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Package
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-text-secondary"
            />
            <span className="truncate">
              <Select.Value>{selectedLabel}</Select.Value>
            </span>
          </span>
          <Select.Icon>
            {isPending ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin text-text-secondary"
              />
            ) : (
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4 text-text-secondary"
              />
            )}
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            className="z-[var(--z-index-dropdown-popover)] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface-elevated)] text-text-primary shadow-md"
          >
            <Select.Viewport className="max-h-72 overflow-y-auto p-1">
              <Select.Item
                value={UNASSIGNED_PRODUCT}
                className="relative flex min-h-[var(--density-row-height-compact)] cursor-default select-none items-center gap-2 rounded-lg py-2 pr-9 pl-3 font-body text-sm text-text-secondary outline-none data-[highlighted]:bg-[var(--color-bg-hover)] data-[highlighted]:text-text-primary data-[state=checked]:bg-[var(--color-bg-selected)] data-[state=checked]:font-semibold data-[state=checked]:text-[var(--color-accent)]"
              >
                <Unlink aria-hidden="true" className="h-4 w-4 shrink-0" />
                <Select.ItemText>Sin producto asignado</Select.ItemText>
                <Select.ItemIndicator className="absolute right-3 inline-flex items-center">
                  <Check aria-hidden="true" className="h-4 w-4" />
                </Select.ItemIndicator>
              </Select.Item>

              {options.map((product) => (
                <Select.Item
                  key={product}
                  value={product}
                  title={product}
                  className="relative flex min-h-[var(--density-row-height-compact)] max-w-96 cursor-default select-none items-center rounded-lg py-2 pr-9 pl-3 font-body text-sm outline-none data-[highlighted]:bg-[var(--color-bg-hover)] data-[state=checked]:bg-[var(--color-bg-selected)] data-[state=checked]:font-semibold data-[state=checked]:text-[var(--color-accent)]"
                >
                  <Select.ItemText>
                    <span className="block truncate">{product}</span>
                  </Select.ItemText>
                  <Select.ItemIndicator className="absolute right-3 inline-flex items-center">
                    <Check aria-hidden="true" className="h-4 w-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      <div className="mt-1 min-h-4" aria-live="polite">
        {feedback ? (
          <p
            id={feedbackId}
            role={feedback.kind === "error" ? "alert" : "status"}
            className={`inline-flex items-center gap-1 font-body text-[0.68rem] font-medium ${
              feedback.kind === "error"
                ? "text-negative"
                : feedback.kind === "success"
                  ? "text-positive"
                  : "text-text-secondary"
            }`}
          >
            {feedback.kind === "success" ? (
              <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
            ) : feedback.kind === "error" ? (
              <CircleAlert aria-hidden="true" className="h-3 w-3" />
            ) : null}
            {feedback.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function MetaCampaignsTable({
  campaigns,
  productOptions,
  initialStatusFilter,
}: MetaCampaignsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const statusOptions = useMemo(
    () =>
      [
        ...new Set(
          campaigns.map((campaign) => campaign.estado.trim().toUpperCase()),
        ),
      ]
        .filter(Boolean)
        .sort((left, right) => {
          const leftIndex = statusPriority.indexOf(left);
          const rightIndex = statusPriority.indexOf(right);
          const leftPriority =
            leftIndex === -1 ? statusPriority.length : leftIndex;
          const rightPriority =
            rightIndex === -1 ? statusPriority.length : rightIndex;

          return leftPriority - rightPriority || left.localeCompare(right);
        }),
    [campaigns],
  );
  const effectiveStatusFilter = statusFilter || "ACTIVE";
  const selectableStatusOptions =
    effectiveStatusFilter === "todos" ||
    statusOptions.includes(effectiveStatusFilter)
      ? statusOptions
      : [effectiveStatusFilter, ...statusOptions];
  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter(
        (campaign) =>
          effectiveStatusFilter === "todos" ||
          campaign.estado.trim().toUpperCase() === effectiveStatusFilter,
      ),
    [campaigns, effectiveStatusFilter],
  );

  function updateStatusFilter(nextStatus: string) {
    setStatusFilter(nextStatus);
    const params = new URLSearchParams(searchParams);
    params.set("estado", nextStatus);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function getCampaignHref(campaignId: string) {
    const params = new URLSearchParams();
    params.set("estado", effectiveStatusFilter);
    return `/command-center/campanias/${encodeURIComponent(campaignId)}?${params.toString()}`;
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-subtle)] p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Cuenta publicitaria configurada
          </p>
          <h2 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Catálogo de campañas
          </h2>
          <p className="mt-1 max-w-2xl font-body text-xs text-text-secondary">
            Asigna el producto base o abre una fila para ver todos sus
            indicadores de Meta.
          </p>
        </div>

        <label className="grid gap-1.5">
          <span className="font-body text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Estado
          </span>
          <Select.Root
            value={effectiveStatusFilter}
            onValueChange={updateStatusFilter}
          >
            <Select.Trigger
              className="inline-flex min-h-[var(--density-row-height-compact)] min-w-48 items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface-elevated)] px-3 font-body text-sm text-text-primary outline-none transition-[background-color,border-color] duration-[var(--motion-duration-hover-focus)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] focus-visible:border-[var(--color-border-selected)] focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              aria-label="Filtrar campañas por estado"
            >
              <span className="flex items-center gap-2">
                <Activity
                  aria-hidden="true"
                  className="h-4 w-4 text-text-secondary"
                />
                <span className="font-semibold">
                  <Select.Value />
                </span>
              </span>
              <Select.Icon>
                <ChevronDown
                  aria-hidden="true"
                  className="h-4 w-4 text-text-secondary"
                />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                position="popper"
                sideOffset={6}
                className="z-[var(--z-index-dropdown-popover)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface-elevated)] text-text-primary shadow-md"
              >
                <Select.Viewport className="p-1">
                  {[
                    { value: "todos", label: "Todas las campañas" },
                    ...selectableStatusOptions.map((status) => ({
                      value: status,
                      label: formatStatus(status),
                    })),
                  ].map((option) => (
                    <Select.Item
                      key={option.value}
                      value={option.value}
                      className="relative flex min-h-[var(--density-row-height-compact)] cursor-default select-none items-center rounded-lg py-2 pr-9 pl-3 font-body text-sm outline-none data-[highlighted]:bg-[var(--color-bg-hover)] data-[state=checked]:bg-[var(--color-bg-selected)] data-[state=checked]:font-semibold data-[state=checked]:text-[var(--color-accent)]"
                    >
                      <Select.ItemText>{option.label}</Select.ItemText>
                      <Select.ItemIndicator className="absolute right-3 inline-flex items-center">
                        <Check aria-hidden="true" className="h-4 w-4" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2" aria-live="polite">
        <span className="font-body text-xs text-text-secondary">
          {filteredCampaigns.length} de {campaigns.length}{" "}
          {campaigns.length === 1 ? "campaña" : "campañas"}
        </span>
        <span className="rounded-full bg-[var(--color-bg-surface-elevated)] px-2 py-1 font-body text-[0.68rem] font-semibold text-text-secondary shadow-sm">
          {effectiveStatusFilter === "todos"
            ? "Todos los estados"
            : formatStatus(effectiveStatusFilter)}
        </span>
      </div>

      {filteredCampaigns.length > 0 ? (
        <>
          <p className="mt-3 font-body text-xs text-text-secondary md:hidden">
            Desliza horizontalmente para gestionar las campañas.
          </p>
          <div
            role="region"
            aria-label="Lista de campañas de Meta Ads"
            tabIndex={0}
            className="mt-3 overflow-x-auto overscroll-x-contain rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-elevated)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <table className="w-full min-w-[54rem] border-collapse text-left">
              <caption className="sr-only">
                Campañas de Meta con estado, producto asociado y fecha de
                actualización
              </caption>
              <thead className="bg-[var(--color-bg-surface-base)]">
                <tr className="border-b border-[var(--color-border-subtle)] font-body text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-text-secondary">
                  <th scope="col" className="w-[42%] px-4 py-3">
                    Campaña
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Estado
                  </th>
                  <th scope="col" className="w-[32%] px-3 py-3">
                    Producto asociado
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Última actualización
                  </th>
                  <th scope="col" className="w-12 px-3 py-3">
                    <span className="sr-only">Abrir detalle</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {filteredCampaigns.map((campaign) => {
                  const detailHref = getCampaignHref(campaign.id);

                  return (
                    <tr
                      key={campaign.id}
                      onClick={() => router.push(detailHref)}
                      className="group min-h-[var(--density-row-height-comfortable)] cursor-pointer align-middle transition-colors duration-[var(--motion-duration-hover-focus)] hover:bg-[var(--color-bg-hover)] motion-reduce:transition-none"
                    >
                      <td className="px-4 py-3.5">
                        <Link
                          href={detailHref}
                          onClick={stopRowNavigation}
                          title={campaign.nombre}
                          className="block max-w-xl rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="block truncate font-display text-sm font-semibold text-text-primary transition-colors duration-[var(--motion-duration-hover-focus)] group-hover:text-[var(--color-accent)] motion-reduce:transition-none">
                            {campaign.nombre}
                          </span>
                          <span className="mt-1 block font-mono text-[0.68rem] tabular-nums text-text-secondary">
                            {campaign.id}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 align-top">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 font-body text-xs font-semibold ${getStatusClass(campaign.estado)}`}
                        >
                          {formatStatus(campaign.estado)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <ProductAssignmentSelect
                          key={`${campaign.id}-${campaign.producto_base ?? "none"}`}
                          campaignId={campaign.id}
                          campaignName={campaign.nombre}
                          currentProduct={campaign.producto_base}
                          productOptions={productOptions}
                        />
                      </td>
                      <td className="px-3 py-3.5 align-top font-body text-xs text-text-secondary whitespace-nowrap">
                        <time dateTime={campaign.actualizado_en}>
                          {formatUpdatedAt(campaign.actualizado_en)}
                        </time>
                      </td>
                      <td className="px-3 py-3.5 text-right align-top">
                        <ChevronRight
                          aria-hidden="true"
                          className="ml-auto h-4 w-4 text-text-secondary transition-transform duration-[var(--motion-duration-hover-focus)] group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)] motion-reduce:transition-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-elevated)] p-6 font-body text-sm text-text-secondary shadow-sm">
          {campaigns.length > 0
            ? "No hay campañas que coincidan con el filtro."
            : "Aún no hay campañas sincronizadas. Usa Actualizar para consultar Meta Ads."}
        </div>
      )}
    </section>
  );
}
