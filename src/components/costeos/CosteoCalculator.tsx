"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCosteo, updateCosteo } from "@/app/(app)/costeos/actions";
import { CampaignProjection } from "./CampaignProjection";

type CosteoCalculatorProps = {
  pais: CosteoPais;
  saved?: boolean;
  importeSaved?: boolean;
  costeoId?: string;
  initialValues?: CosteoCalculatorInitialValues;
};

type CosteoPais = 'CO' | 'MX';

export type CosteoCalculatorInitialValues = {
  nombre_producto: string;
  precio_proveedor: number;
  flete_base: number;
  tasa_efectividad: number;
  costos_administrativos: number;
  fullfilment: number;
  cpa_ads: number;
  cpa_porcentaje_objetivo: number;
  tasa_cancelacion: number;
  precio_venta: number;
  precio_comparacion: number;
  importe_gastado: number | null;
};

type NumericFieldProps = {
  id: string;
  name: string;
  submitValue?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  min?: string;
  max?: string;
  step?: string;
  required?: boolean;
};

type FxRate = {
  rate: number;
  timestamp: string;
};

type DisplayCurrency = CosteoPais | "COP";

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
  COP: new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }),
} satisfies Record<DisplayCurrency, Intl.NumberFormat>;

const exchangeRateFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("es", {
  style: "percent",
  maximumFractionDigits: 1,
});

function parseInputNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatInputNumber(value: number) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function formatPercent(value: number) {
  return Number.isFinite(value) ? percentFormatter.format(value) : "—";
}

function formatMultiplier(value: number) {
  return Number.isFinite(value) ? `${value.toFixed(2)}x` : "—";
}

function getInitialDiscountPercentage(
  initialValues?: CosteoCalculatorInitialValues,
) {
  const storedValue = initialValues?.precio_comparacion ?? 0;

  if (!Number.isFinite(storedValue) || storedValue <= 0) {
    return 0;
  }

  if (storedValue < 100) {
    return storedValue;
  }

  const precioVenta = initialValues?.precio_venta ?? 0;

  if (precioVenta > 0 && storedValue > precioVenta) {
    const inferredDiscount = (1 - precioVenta / storedValue) * 100;

    if (
      Number.isFinite(inferredDiscount) &&
      inferredDiscount >= 0 &&
      inferredDiscount < 100
    ) {
      return inferredDiscount;
    }
  }

  return 0;
}

function NumericField({
  id,
  name,
  submitValue,
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = "0",
  max,
  step = "0.01",
  required = true,
}: NumericFieldProps) {
  const visibleInputName = submitValue === undefined ? name : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-body text-sm text-text-primary">
        {label}
      </Label>
      <div className="relative">
        {submitValue === undefined ? null : (
          <input type="hidden" name={name} value={submitValue} />
        )}
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-text-secondary">
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          name={visibleInputName}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-10 rounded-lg border-border bg-bg-surface font-mono tabular-nums text-text-primary placeholder:text-text-secondary focus-visible:border-[var(--color-accent)] focus-visible:ring-[var(--color-accent)]/20 ${
            prefix ? "pl-8" : ""
          } ${suffix ? "pr-10" : ""}`}
          required={required}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-body text-sm text-text-secondary">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  const valueClass =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-risk-high"
        : "text-text-primary";

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <span className="font-body text-sm text-text-secondary">{label}</span>
      <span className={`font-mono text-sm font-semibold tabular-nums ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-bg-page px-3 py-2">
      <span className="font-body text-xs text-text-secondary">{label}</span>
      <span className="font-mono text-xs font-semibold tabular-nums text-text-primary">
        {value}
      </span>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-10 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-5 font-body font-semibold text-bg-surface shadow-md shadow-[var(--color-accent)]/20 hover:opacity-90"
    >
      {pending ? "Guardando..." : label}
    </Button>
  );
}

export function CosteoCalculator({
  pais,
  saved = false,
  importeSaved = false,
  costeoId,
  initialValues,
}: CosteoCalculatorProps) {
  const isEditing = Boolean(costeoId);
  const [showCopValues, setShowCopValues] = useState(false);
  const [fxRate, setFxRate] = useState<FxRate | null>(null);
  const [fxError, setFxError] = useState("");
  const [fxLoading, setFxLoading] = useState(false);
  const showFxToggle = pais === "MX";
  const fxDisplayEnabled = showFxToggle && showCopValues && fxRate !== null;
  const displayMultiplier = fxDisplayEnabled ? fxRate.rate : 1;
  const moneyFormatter = currencyFormatter[fxDisplayEnabled ? "COP" : pais];
  const formatMoney = (value: number) =>
    Number.isFinite(value) ? moneyFormatter.format(value * displayMultiplier) : "—";
  const [nombreProducto, setNombreProducto] = useState(
    initialValues?.nombre_producto ?? "",
  );
  const [precioProveedor, setPrecioProveedor] = useState(
    formatInputNumber(initialValues?.precio_proveedor ?? 0),
  );
  const [fleteBase, setFleteBase] = useState(
    formatInputNumber(initialValues?.flete_base ?? 0),
  );
  const [tasaEfectividad, setTasaEfectividad] = useState(
    formatInputNumber((initialValues?.tasa_efectividad ?? 0.75) * 100),
  );
  const [costosAdministrativos, setCostosAdministrativos] = useState(
    formatInputNumber(initialValues?.costos_administrativos ?? 0),
  );
  const [fullfilment, setFullfilment] = useState(
    formatInputNumber(initialValues?.fullfilment ?? 0),
  );
  const [precioVenta, setPrecioVenta] = useState(
    formatInputNumber(initialValues?.precio_venta ?? 0),
  );
  const [porcentajeDescuento, setPorcentajeDescuento] = useState(
    formatInputNumber(getInitialDiscountPercentage(initialValues)),
  );
  const [cpaPorcentajeObjetivo, setCpaPorcentajeObjetivo] = useState(
    formatInputNumber(initialValues?.cpa_porcentaje_objetivo ?? 20),
  );
  const [cpaAds, setCpaAds] = useState(
    formatInputNumber(initialValues?.cpa_ads ?? 0),
  );
  const [cpaManual, setCpaManual] = useState(false);
  const [tasaCancelacion, setTasaCancelacion] = useState(
    formatInputNumber((initialValues?.tasa_cancelacion ?? 0) * 100),
  );
  const formAction =
    costeoId === undefined ? createCosteo : updateCosteo.bind(null, costeoId);

  function getDisplayedMoneyInput(value: string) {
    if (!value.trim() || displayMultiplier === 1) {
      return value;
    }

    return formatInputNumber(parseInputNumber(value) * displayMultiplier);
  }

  function getStoredMoneyInput(value: string) {
    if (!value.trim() || displayMultiplier === 1) {
      return value;
    }

    return formatInputNumber(parseInputNumber(value) / displayMultiplier);
  }

  function getMoneySubmitValue(value: string) {
    return fxDisplayEnabled ? value : undefined;
  }

  async function handleFxToggle() {
    if (fxDisplayEnabled) {
      setShowCopValues(false);
      return;
    }

    if (fxRate) {
      setShowCopValues(true);
      return;
    }

    setFxLoading(true);
    setFxError("");

    try {
      const response = await fetch("/api/fx/mxn-cop");
      const data = (await response.json()) as Partial<FxRate> & {
        error?: string;
      };

      if (
        !response.ok ||
        !Number.isFinite(data.rate) ||
        data.rate === undefined ||
        data.rate <= 0
      ) {
        throw new Error(data.error ?? "No se pudo obtener la tasa de cambio");
      }

      setFxRate({
        rate: data.rate,
        timestamp:
          typeof data.timestamp === "string"
            ? data.timestamp
            : new Date().toISOString(),
      });
      setShowCopValues(true);
    } catch (error) {
      setShowCopValues(false);
      setFxError(
        error instanceof Error
          ? error.message
          : "No se pudo obtener la tasa de cambio",
      );
    } finally {
      setFxLoading(false);
    }
  }

  const values = useMemo(() => {
    const precioProveedorValue = parseInputNumber(precioProveedor);
    const fleteBaseValue = parseInputNumber(fleteBase);
    const tasaEfectividadValue = parseInputNumber(tasaEfectividad) / 100;
    const costosAdministrativosValue = parseInputNumber(costosAdministrativos);
    const fullfilmentValue = parseInputNumber(fullfilment);
    const cpaAdsValue = parseInputNumber(cpaAds);
    const tasaCancelacionValue = parseInputNumber(tasaCancelacion) / 100;
    const precioVentaValue = parseInputNumber(precioVenta);
    const porcentajeDescuentoValue = parseInputNumber(porcentajeDescuento);
    const precioComparacionInvalido = porcentajeDescuentoValue >= 100;
    const precioComparacionValue = precioComparacionInvalido
      ? Number.NaN
      : porcentajeDescuentoValue <= 0
        ? precioVentaValue
        : precioVentaValue / (1 - porcentajeDescuentoValue / 100);

    const fleteConDevoluciones = fleteBaseValue / tasaEfectividadValue;
    const cpaConDevolucionesYCancelaciones =
      cpaAdsValue / (tasaEfectividadValue * (1 - tasaCancelacionValue));
    const costosTotales =
      precioProveedorValue +
      fleteConDevoluciones +
      costosAdministrativosValue +
      fullfilmentValue +
      cpaConDevolucionesYCancelaciones;
    const utilidadPorPedidoEntregado = precioVentaValue - costosTotales;
    const utilidadPromedioPorPedidoShopify =
      utilidadPorPedidoEntregado * tasaEfectividadValue * (1 - tasaCancelacionValue);
    const breakeven = cpaAdsValue + utilidadPromedioPorPedidoShopify;
    const roas = utilidadPorPedidoEntregado / cpaConDevolucionesYCancelaciones + 1;

    return {
      precioProveedor: precioProveedorValue,
      fleteConDevoluciones,
      costosAdministrativos: costosAdministrativosValue,
      fullfilment: fullfilmentValue,
      cpaConDevolucionesYCancelaciones,
      costosTotales,
      cpaAds: cpaAdsValue,
      tasaCancelacion: tasaCancelacionValue,
      tasaEfectividad: tasaEfectividadValue,
      utilidadPorPedidoEntregado,
      utilidadPromedioPorPedidoShopify,
      porcentajeDescuento: porcentajeDescuentoValue,
      precioComparacion: precioComparacionValue,
      precioComparacionInvalido,
      breakeven,
      roas,
      precioVenta: precioVentaValue,
    };
  }, [
    precioProveedor,
    fleteBase,
    tasaEfectividad,
    costosAdministrativos,
    fullfilment,
    cpaAds,
    tasaCancelacion,
    precioVenta,
    porcentajeDescuento,
  ]);

  const utilidadTone =
    values.utilidadPromedioPorPedidoShopify >= 0 ? "positive" : "negative";

  function handlePrecioVentaChange(value: string) {
    setPrecioVenta(value);

    if (!cpaManual) {
      setCpaAds(
        value
          ? formatInputNumber(
              parseInputNumber(value) *
                (parseInputNumber(cpaPorcentajeObjetivo) / 100),
            )
          : "",
      );
    }
  }

  function handleCpaPorcentajeObjetivoChange(value: string) {
    setCpaPorcentajeObjetivo(value);

    if (!cpaManual) {
      setCpaAds(
        precioVenta
          ? formatInputNumber(
              parseInputNumber(precioVenta) * (parseInputNumber(value) / 100),
            )
          : "",
      );
    }
  }

  function handleCpaChange(value: string) {
    setCpaManual(true);
    setCpaAds(value);
  }

  function resetCpaAuto() {
    setCpaManual(false);
    setCpaAds(
      precioVenta
        ? formatInputNumber(
            parseInputNumber(precioVenta) *
              (parseInputNumber(cpaPorcentajeObjetivo) / 100),
          )
        : "",
    );
  }

  return (
    <div className="mt-5 space-y-5">
      <form
        action={formAction}
        className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]"
      >
        <input type="hidden" name="pais" value={pais} />
        <div className="rounded-2xl border border-border bg-bg-surface p-6 shadow-lg">
          <div className="flex flex-col gap-2 border-b border-border pb-4">
            <p className="font-display text-lg font-semibold text-text-primary">
              {isEditing ? "Editar costeo" : "Calculadora de costeos"}
            </p>
            <p className="font-body text-sm text-text-secondary">
              Ajusta los supuestos de venta, entrega y pauta para ver la economía
              unitaria en vivo.
            </p>
          </div>

          {saved ? (
            <div className="mt-4 rounded-2xl border border-positive/20 bg-positive-bg px-4 py-3 font-body text-sm text-positive">
              Costeo guardado correctamente.
            </div>
          ) : null}

          {showFxToggle ? (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-bg-page px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-sm font-semibold text-text-primary">
                  Ver importes en COP
                </p>
                <p
                  className={`mt-1 font-body text-xs ${
                    fxError ? "text-risk-high" : "text-text-secondary"
                  }`}
                >
                  {fxDisplayEnabled && fxRate
                    ? `1 MXN = ${exchangeRateFormatter.format(fxRate.rate)} COP`
                    : fxLoading
                      ? "Consultando tasa de cambio..."
                      : fxError || "Los valores se guardan siempre en MXN."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={fxDisplayEnabled}
                disabled={fxLoading || Boolean(fxError)}
                onClick={handleFxToggle}
                className={`relative h-7 w-12 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
                  fxDisplayEnabled
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                    : "border-border bg-bg-surface"
                }`}
              >
                <span
                  className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full bg-bg-surface shadow-md transition-transform ${
                    fxDisplayEnabled ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label
                htmlFor="nombre_producto"
                className="font-body text-sm text-text-primary"
              >
                Producto
              </Label>
              <Input
                id="nombre_producto"
                name="nombre_producto"
                value={nombreProducto}
                onChange={(event) => setNombreProducto(event.target.value)}
                placeholder="Nombre del producto"
                className="h-10 rounded-lg border-border bg-bg-surface font-body text-text-primary placeholder:text-text-secondary focus-visible:border-[var(--color-accent)] focus-visible:ring-[var(--color-accent)]/20"
                required
              />
            </div>

            <NumericField
              id="precio_proveedor"
              name="precio_proveedor"
              label="Precio proveedor"
              value={getDisplayedMoneyInput(precioProveedor)}
              onChange={(value) => setPrecioProveedor(getStoredMoneyInput(value))}
              submitValue={getMoneySubmitValue(precioProveedor)}
              prefix="$"
            />
            <NumericField
              id="precio_venta"
              name="precio_venta"
              label="Precio venta"
              value={getDisplayedMoneyInput(precioVenta)}
              onChange={(value) =>
                handlePrecioVentaChange(getStoredMoneyInput(value))
              }
              submitValue={getMoneySubmitValue(precioVenta)}
              prefix="$"
            />
            <div className="space-y-2">
              <NumericField
                id="precio_comparacion"
                name="precio_comparacion"
                label="% descuento mostrado"
                value={porcentajeDescuento}
                onChange={setPorcentajeDescuento}
                suffix="%"
                required={false}
              />
              <p
                className={`font-body text-xs ${
                  values.precioComparacionInvalido
                    ? "text-risk-high"
                    : "text-text-secondary"
                }`}
              >
                {values.precioComparacionInvalido
                  ? "Debe ser menor a 100%."
                  : "Calcula el precio de comparación automáticamente."}
              </p>
            </div>
            <NumericField
              id="flete_base"
              name="flete_base"
              label="Flete base"
              value={getDisplayedMoneyInput(fleteBase)}
              onChange={(value) => setFleteBase(getStoredMoneyInput(value))}
              submitValue={getMoneySubmitValue(fleteBase)}
              prefix="$"
            />
            <NumericField
              id="tasa_efectividad"
              name="tasa_efectividad"
              label="Tasa efectividad"
              value={tasaEfectividad}
              onChange={setTasaEfectividad}
              suffix="%"
              max="100"
            />
            <NumericField
              id="costos_administrativos"
              name="costos_administrativos"
              label="Costos administrativos"
              value={getDisplayedMoneyInput(costosAdministrativos)}
              onChange={(value) =>
                setCostosAdministrativos(getStoredMoneyInput(value))
              }
              submitValue={getMoneySubmitValue(costosAdministrativos)}
              prefix="$"
            />
            <NumericField
              id="fullfilment"
              name="fullfilment"
              label="Fullfilment"
              value={getDisplayedMoneyInput(fullfilment)}
              onChange={(value) => setFullfilment(getStoredMoneyInput(value))}
              submitValue={getMoneySubmitValue(fullfilment)}
              prefix="$"
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="cpa_ads" className="font-body text-sm text-text-primary">
                  CPA ads
                </Label>
                <button
                  type="button"
                  onClick={resetCpaAuto}
                  className="font-body text-xs font-semibold text-[var(--color-accent)] underline-offset-4 hover:underline"
                >
                  Restablecer a objetivo
                </button>
              </div>
              <div className="relative">
                {fxDisplayEnabled ? (
                  <input type="hidden" name="cpa_ads" value={cpaAds} />
                ) : null}
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-text-secondary">
                  $
                </span>
                <Input
                  id="cpa_ads"
                  name={fxDisplayEnabled ? undefined : "cpa_ads"}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={getDisplayedMoneyInput(cpaAds)}
                  onChange={(event) =>
                    handleCpaChange(getStoredMoneyInput(event.target.value))
                  }
                  className="h-10 rounded-lg border-border bg-bg-surface pl-8 font-mono tabular-nums text-text-primary placeholder:text-text-secondary focus-visible:border-[var(--color-accent)] focus-visible:ring-[var(--color-accent)]/20"
                  required
                />
              </div>
              <p className="font-body text-xs text-text-secondary">
                {cpaManual
                  ? "CPA manual: no se actualiza al cambiar el precio."
                  : "CPA automático: usa el porcentaje objetivo."}
              </p>
            </div>
            <NumericField
              id="cpa_porcentaje_objetivo"
              name="cpa_porcentaje_objetivo"
              label="% CPA objetivo"
              value={cpaPorcentajeObjetivo}
              onChange={handleCpaPorcentajeObjetivoChange}
              suffix="%"
            />
            <NumericField
              id="tasa_cancelacion"
              name="tasa_cancelacion"
              label="Tasa cancelación"
              value={tasaCancelacion}
              onChange={setTasaCancelacion}
              suffix="%"
              max="100"
            />
          </div>

          <div className="mt-6 flex justify-end">
            <SubmitButton label={isEditing ? "Guardar cambios" : "Guardar"} />
          </div>
        </div>

        <aside className="rounded-2xl border border-border bg-bg-surface p-6 shadow-lg">
          <div className="border-b border-border pb-4">
            <p className="font-display text-lg font-semibold text-text-primary">
              Resultados
            </p>
            <p className="mt-1 font-body text-sm text-text-secondary">
              Cálculos derivados de la lógica original de calcucrm.
            </p>
          </div>

          <div className="mt-3">
            <ResultRow
              label="Flete con devoluciones"
              value={formatMoney(values.fleteConDevoluciones)}
            />
            <ResultRow
              label="CPA con devoluciones y cancelaciones"
              value={formatMoney(values.cpaConDevolucionesYCancelaciones)}
            />
            <ResultRow
              label="Costos totales"
              value={formatMoney(values.costosTotales)}
            />
            <ResultRow
              label="Utilidad por pedido entregado"
              value={formatMoney(values.utilidadPorPedidoEntregado)}
              tone={values.utilidadPorPedidoEntregado >= 0 ? "positive" : "negative"}
            />
            <ResultRow
              label="Utilidad promedio por pedido Shopify"
              value={formatMoney(values.utilidadPromedioPorPedidoShopify)}
              tone={utilidadTone}
            />
            <ResultRow
              label="Precio comparación"
              value={
                values.precioComparacionInvalido
                  ? "Inválido"
                  : formatMoney(values.precioComparacion)
              }
              tone={values.precioComparacionInvalido ? "negative" : "default"}
            />
            <ResultRow label="Breakeven" value={formatMoney(values.breakeven)} />
            <ResultRow label="ROAS" value={formatMultiplier(values.roas)} />
          </div>

          <div className="mt-6">
            <p className="font-body text-xs uppercase text-text-secondary">
              Distribución sobre precio
            </p>
            <div className="mt-3 grid gap-2">
              <BreakdownRow
                label="Proveedor"
                value={formatPercent(values.precioProveedor / values.precioVenta)}
              />
              <BreakdownRow
                label="Flete con devoluciones"
                value={formatPercent(values.fleteConDevoluciones / values.precioVenta)}
              />
              <BreakdownRow
                label="Costos administrativos"
                value={formatPercent(
                  values.costosAdministrativos / values.precioVenta,
                )}
              />
              <BreakdownRow
                label="Fullfilment"
                value={formatPercent(values.fullfilment / values.precioVenta)}
              />
              <BreakdownRow
                label="CPA ajustado"
                value={formatPercent(
                  values.cpaConDevolucionesYCancelaciones / values.precioVenta,
                )}
              />
              <BreakdownRow
                label="Costos totales"
                value={formatPercent(values.costosTotales / values.precioVenta)}
              />
              <BreakdownRow
                label="Utilidad promedio Shopify"
                value={formatPercent(
                  values.utilidadPromedioPorPedidoShopify / values.precioVenta,
                )}
              />
            </div>
          </div>
        </aside>
      </form>

      {costeoId ? (
        <CampaignProjection
          costeoId={costeoId}
          initialImporteGastado={initialValues?.importe_gastado ?? null}
          values={{
            cpaAds: values.cpaAds,
            precioVenta: values.precioVenta,
            tasaCancelacion: values.tasaCancelacion,
            tasaEfectividad: values.tasaEfectividad,
            costosTotales: values.costosTotales,
          }}
          saved={importeSaved}
        />
      ) : null}
    </div>
  );
}
