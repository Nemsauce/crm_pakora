"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CosteoPais = "CO" | "MX";

export type PromotionCosteoValues = {
  utilidadPorPedidoEntregado: number;
  costoUnicoPorPedido: number;
  precioProveedor: number;
  precioVenta: number;
};

type PromotionsPanelProps = PromotionCosteoValues & {
  pais: CosteoPais;
};

const MAX_TIERS = 10;

const currencyFormatter = {
  CO: new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }),
  MX: new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }),
} satisfies Record<CosteoPais, Intl.NumberFormat>;

function parseInputNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readFormNumber(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? parseInputNumber(value) : 0;
}

function formatMoney(formatter: Intl.NumberFormat, value: number) {
  return Number.isFinite(value) ? formatter.format(value) : "—";
}

function readLiveCosteoValues(form: HTMLFormElement): PromotionCosteoValues {
  const formData = new FormData(form);
  const precioProveedor = readFormNumber(formData, "precio_proveedor");
  const fleteBase = readFormNumber(formData, "flete_base");
  const tasaEfectividad = readFormNumber(formData, "tasa_efectividad") / 100;
  const costosAdministrativos = readFormNumber(
    formData,
    "costos_administrativos",
  );
  const fullfilment = readFormNumber(formData, "fullfilment");
  const cpaAds = readFormNumber(formData, "cpa_ads");
  const tasaCancelacion = readFormNumber(formData, "tasa_cancelacion") / 100;
  const precioVenta = readFormNumber(formData, "precio_venta");
  const fleteConDevoluciones = fleteBase / tasaEfectividad;
  const cpaConDevolucionesYCancelaciones =
    cpaAds / (tasaEfectividad * (1 - tasaCancelacion));
  const costoUnicoPorPedido =
    fleteConDevoluciones +
    costosAdministrativos +
    fullfilment +
    cpaConDevolucionesYCancelaciones;
  const utilidadPorPedidoEntregado =
    precioVenta - (precioProveedor + costoUnicoPorPedido);

  return {
    utilidadPorPedidoEntregado,
    costoUnicoPorPedido,
    precioProveedor,
    precioVenta,
  };
}

export function PromotionsPanel({
  utilidadPorPedidoEntregado,
  costoUnicoPorPedido,
  precioProveedor,
  precioVenta,
  pais,
}: PromotionsPanelProps) {
  const [gananciaExtraPct, setGananciaExtraPct] = useState("10");
  const [quantityTiers, setQuantityTiers] = useState([2, 3]);
  const [liveValues, setLiveValues] = useState<PromotionCosteoValues>({
    utilidadPorPedidoEntregado,
    costoUnicoPorPedido,
    precioProveedor,
    precioVenta,
  });
  const moneyFormatter = currencyFormatter[pais];

  useEffect(() => {
    const firstCosteoInput = document.querySelector<HTMLInputElement>(
      'input[name="precio_proveedor"]',
    );
    const form = firstCosteoInput?.form;

    if (!form) {
      return undefined;
    }

    const costeoForm = form;
    let frameId = 0;

    function refreshValues() {
      setLiveValues(readLiveCosteoValues(costeoForm));
    }

    function scheduleRefresh() {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(refreshValues);
    }

    refreshValues();
    costeoForm.addEventListener("input", scheduleRefresh);
    costeoForm.addEventListener("change", scheduleRefresh);
    costeoForm.addEventListener("click", scheduleRefresh);

    return () => {
      cancelAnimationFrame(frameId);
      costeoForm.removeEventListener("input", scheduleRefresh);
      costeoForm.removeEventListener("change", scheduleRefresh);
      costeoForm.removeEventListener("click", scheduleRefresh);
    };
  }, []);

  const rows = useMemo(() => {
    const porcentajeGananciaExtra = parseInputNumber(gananciaExtraPct);

    return quantityTiers.map((cantidad) => {
      const costoTotalPromo =
        liveValues.costoUnicoPorPedido + liveValues.precioProveedor * cantidad;
      const utilidadTotal =
        liveValues.utilidadPorPedidoEntregado +
        (cantidad - 1) *
          ((porcentajeGananciaExtra / 100) *
            liveValues.utilidadPorPedidoEntregado);
      const precioTotalPromo = costoTotalPromo + utilidadTotal;
      const precioPorUnidad = precioTotalPromo / cantidad;
      const ahorroCliente =
        liveValues.precioVenta * cantidad - precioTotalPromo;

      return {
        cantidad,
        precioTotalPromo,
        precioPorUnidad,
        utilidadTotal,
        ahorroCliente,
      };
    });
  }, [gananciaExtraPct, liveValues, quantityTiers]);

  function addQuantityTier() {
    setQuantityTiers((currentTiers) => {
      const lastTier = currentTiers.at(-1) ?? 1;
      const nextTier = Math.min(lastTier + 1, MAX_TIERS);

      if (currentTiers.includes(nextTier)) {
        return currentTiers;
      }

      return [...currentTiers, nextTier];
    });
  }

  const canAddTier = (quantityTiers.at(-1) ?? 0) < MAX_TIERS;

  return (
    <section className="rounded-2xl border border-border bg-bg-surface p-6 shadow-lg">
      <div className="border-b border-border pb-4">
        <p className="font-body text-xs uppercase text-text-secondary">
          Promociones
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold text-text-primary">
          Packs por cantidad
        </h2>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
          Calcula precios para ofertas por volumen usando los valores actuales
          del costeo.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xs space-y-2">
          <Label
            htmlFor="promocion_ganancia_extra"
            className="font-body text-sm text-text-primary"
          >
            % ganancia extra por unidad adicional
          </Label>
          <div className="relative">
            <Input
              id="promocion_ganancia_extra"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={gananciaExtraPct}
              onChange={(event) => setGananciaExtraPct(event.target.value)}
              className="h-10 rounded-lg border-border bg-bg-surface pr-10 font-mono tabular-nums text-text-primary placeholder:text-text-secondary focus-visible:border-[var(--color-accent)] focus-visible:ring-[var(--color-accent)]/20"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-body text-sm text-text-secondary">
              %
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={addQuantityTier}
          disabled={!canAddTier}
          className="h-10 rounded-full border-border bg-bg-surface px-4 font-body font-semibold text-text-primary hover:text-[var(--color-accent)]"
        >
          <Plus className="size-4" aria-hidden="true" />
          Agregar cantidad
        </Button>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-bg-page">
        <table className="min-w-[760px] w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-body text-xs uppercase text-text-secondary">
                Cantidad
              </th>
              <th className="px-4 py-3 text-left font-body text-xs uppercase text-text-secondary">
                Precio total
              </th>
              <th className="px-4 py-3 text-left font-body text-xs uppercase text-text-secondary">
                Precio por unidad
              </th>
              <th className="px-4 py-3 text-left font-body text-xs uppercase text-text-secondary">
                Tu ganancia total
              </th>
              <th className="px-4 py-3 text-left font-body text-xs uppercase text-text-secondary">
                Ahorro del cliente
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cantidad} className="border-b border-border last:border-b-0">
                <td className="px-4 py-4 font-mono text-sm font-semibold tabular-nums text-text-primary">
                  {row.cantidad}
                </td>
                <td className="px-4 py-4 font-mono text-sm font-semibold tabular-nums text-text-primary">
                  {formatMoney(moneyFormatter, row.precioTotalPromo)}
                </td>
                <td className="px-4 py-4 font-mono text-sm font-semibold tabular-nums text-text-primary">
                  {formatMoney(moneyFormatter, row.precioPorUnidad)}
                </td>
                <td className="px-4 py-4 font-mono text-sm font-semibold tabular-nums text-positive">
                  {formatMoney(moneyFormatter, row.utilidadTotal)}
                </td>
                <td className="px-4 py-4 font-mono text-sm font-semibold tabular-nums text-text-primary">
                  {formatMoney(moneyFormatter, row.ahorroCliente)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
