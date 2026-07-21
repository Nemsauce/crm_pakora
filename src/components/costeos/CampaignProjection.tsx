"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateCosteoImporteGastado } from "@/app/(app)/costeos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CampaignProjectionInputs = {
  cpaAds: number;
  precioVenta: number;
  tasaCancelacion: number;
  tasaEfectividad: number;
  costosTotales: number;
};

type CampaignProjectionProps = {
  costeoId: string;
  initialImporteGastado: number | null;
  values: CampaignProjectionInputs;
  saved?: boolean;
};

const moneyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 1,
});

function parseInputNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatInitialValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "0";
  return String(Math.round(value * 100) / 100);
}

function formatMoney(value: number) {
  return Number.isFinite(value) ? moneyFormatter.format(value) : "—";
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? numberFormatter.format(value) : "—";
}

function formatPercent(value: number) {
  return Number.isFinite(value) ? percentFormatter.format(value) : "—";
}

function ProjectionRow({
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

function SaveImporteButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-10 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-5 font-body font-semibold text-bg-surface shadow-md shadow-[var(--color-accent)]/20 hover:opacity-90"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Guardando...
        </>
      ) : (
        "Guardar importe gastado"
      )}
    </Button>
  );
}

export function CampaignProjection({
  costeoId,
  initialImporteGastado,
  values,
  saved = false,
}: CampaignProjectionProps) {
  const [importeGastado, setImporteGastado] = useState(
    formatInitialValue(initialImporteGastado),
  );
  const action = updateCosteoImporteGastado.bind(null, costeoId);

  const projection = useMemo(() => {
    const importeGastadoValue = parseInputNumber(importeGastado);
    const pedidosTotales = importeGastadoValue / values.cpaAds;
    const valorFacturacion = pedidosTotales * values.precioVenta;
    const pedidosDespachados = pedidosTotales * (1 - values.tasaCancelacion);
    const valorDespachado = pedidosDespachados * values.precioVenta;
    const pedidosEntregados = pedidosDespachados * values.tasaEfectividad;
    const valorEntregado = pedidosEntregados * values.precioVenta;
    const utilidadNeta =
      valorEntregado - pedidosEntregados * values.costosTotales;
    const cpaReal = importeGastadoValue / pedidosEntregados;
    const cpaRealPct = importeGastadoValue / valorEntregado;

    return {
      pedidosTotales,
      valorFacturacion,
      pedidosDespachados,
      valorDespachado,
      pedidosEntregados,
      valorEntregado,
      utilidadNeta,
      cpaReal,
      cpaRealPct,
    };
  }, [importeGastado, values]);

  return (
    <section className="rounded-2xl border border-border bg-bg-surface p-6 shadow-lg">
      <div className="border-b border-border pb-4">
        <p className="font-body text-xs uppercase text-text-secondary">
          Etapa 2
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold text-text-primary">
          Proyección de campaña
        </h2>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
          Usa los valores actuales de la calculadora, incluso si estás explorando
          cambios sin guardarlos.
        </p>
      </div>

      {saved ? (
        <div className="mt-4 rounded-2xl border border-positive/20 bg-positive-bg px-4 py-3 font-body text-sm text-positive">
          Importe gastado guardado correctamente.
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(280px,0.7fr)_minmax(0,1fr)]">
        <form action={action} className="rounded-2xl border border-border bg-bg-page p-4">
          <div className="space-y-2">
            <Label
              htmlFor="importe_gastado"
              className="font-body text-sm text-text-primary"
            >
              Importe gastado
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-text-secondary">
                $
              </span>
              <Input
                id="importe_gastado"
                name="importe_gastado"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={importeGastado}
                onChange={(event) => setImporteGastado(event.target.value)}
                className="h-10 rounded-lg border-border bg-bg-surface pl-8 font-mono tabular-nums text-text-primary placeholder:text-text-secondary focus-visible:border-[var(--color-accent)] focus-visible:ring-[var(--color-accent)]/20"
                required
              />
            </div>
          </div>

          <div className="mt-4">
            <SaveImporteButton />
          </div>
        </form>

        <div className="rounded-2xl border border-border bg-bg-page px-4">
          <ProjectionRow
            label="Pedidos totales"
            value={formatNumber(projection.pedidosTotales)}
          />
          <ProjectionRow
            label="Valor facturación"
            value={formatMoney(projection.valorFacturacion)}
          />
          <ProjectionRow
            label="Pedidos despachados"
            value={formatNumber(projection.pedidosDespachados)}
          />
          <ProjectionRow
            label="Valor despachado"
            value={formatMoney(projection.valorDespachado)}
          />
          <ProjectionRow
            label="Pedidos entregados"
            value={formatNumber(projection.pedidosEntregados)}
          />
          <ProjectionRow
            label="Valor entregado"
            value={formatMoney(projection.valorEntregado)}
          />
          <ProjectionRow
            label="Utilidad neta"
            value={formatMoney(projection.utilidadNeta)}
            tone={projection.utilidadNeta >= 0 ? "positive" : "negative"}
          />
          <ProjectionRow label="CPA real" value={formatMoney(projection.cpaReal)} />
          <ProjectionRow
            label="CPA real %"
            value={formatPercent(projection.cpaRealPct)}
          />
        </div>
      </div>
    </section>
  );
}
