"use client";

import type { ReactNode } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

type MomentumBadgeProps = {
  tendenciaRatio: number | string | null;
  tercio1Promedio: number | string | null;
  tercio3Promedio: number | string | null;
};

type MomentumTier = "explosivo" | "acelerando" | "subiendo";

const tierConfig = {
  explosivo: {
    label: "🔥 Explosivo",
    className:
      "bg-[var(--color-accent-orange-bg)] text-[var(--color-accent-orange)]",
  },
  acelerando: {
    label: "📈 Acelerando",
    className: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  },
  subiendo: {
    label: "↗ Subiendo",
    className: "bg-risk-low-bg text-risk-low",
  },
} satisfies Record<
  MomentumTier,
  {
    label: string;
    className: string;
  }
>;

export function MomentumBadge({
  tendenciaRatio,
  tercio1Promedio,
  tercio3Promedio,
}: MomentumBadgeProps) {
  const ratio = toNumberOrNull(tendenciaRatio);
  const tier = getMomentumTier(ratio);

  if (!tier || ratio === null) {
    return null;
  }

  const config = tierConfig[tier];
  const tooltipText = getTooltipText({
    tier,
    tendenciaRatio: ratio,
    tercio1Promedio: toNumberOrNull(tercio1Promedio),
    tercio3Promedio: toNumberOrNull(tercio3Promedio),
  });

  return (
    <TooltipPrimitive.Provider delayDuration={120}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            className={`inline-flex cursor-help items-center rounded-full px-3 py-1 font-body text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${config.className}`}
          >
            {config.label}
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={8}
            className="z-50 max-w-xs rounded-2xl border border-border bg-bg-surface px-3 py-2 font-body text-xs leading-relaxed text-text-primary shadow-xl"
          >
            {tooltipText}
            <TooltipPrimitive.Arrow className="fill-bg-surface" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

function getMomentumTier(tendenciaRatio: number | null): MomentumTier | null {
  if (tendenciaRatio === null || tendenciaRatio < 1.2) {
    return null;
  }

  if (tendenciaRatio >= 3) {
    return "explosivo";
  }

  if (tendenciaRatio >= 1.5) {
    return "acelerando";
  }

  return "subiendo";
}

function getTooltipText({
  tier,
  tendenciaRatio,
  tercio1Promedio,
  tercio3Promedio,
}: {
  tier: MomentumTier;
  tendenciaRatio: number;
  tercio1Promedio: number | null;
  tercio3Promedio: number | null;
}) {
  const firstThirdPace = formatDecimal(tercio1Promedio);
  const latestThirdPace = formatDecimal(tercio3Promedio);
  const ratio = formatDecimal(tendenciaRatio);

  if (tier === "explosivo") {
    return (
      <>
        El ritmo se disparó: en los primeros 10 días del período vendía ~
        <TooltipNumber>{firstThirdPace}</TooltipNumber> unidades por día; en los
        últimos 10 días ya vende ~
        <TooltipNumber>{latestThirdPace}/día</TooltipNumber>,{" "}
        <TooltipNumber>{ratio}x</TooltipNumber> el ritmo inicial.
      </>
    );
  }

  if (tier === "acelerando") {
    return (
      <>
        La demanda ganó velocidad: pasó de ~
        <TooltipNumber>{firstThirdPace}</TooltipNumber> unidades por día en el
        primer tercio a ~
        <TooltipNumber>{latestThirdPace}/día</TooltipNumber> en el tercio más
        reciente, un ritmo <TooltipNumber>{ratio}x</TooltipNumber> mayor.
      </>
    );
  }

  return (
    <>
      La tendencia va al alza: el promedio pasó de ~
      <TooltipNumber>{firstThirdPace}</TooltipNumber> unidades por día en los
      primeros 10 días a ~
      <TooltipNumber>{latestThirdPace}/día</TooltipNumber> en los últimos 10
      días, una relación de <TooltipNumber>{ratio}x</TooltipNumber>.
    </>
  );
}

function TooltipNumber({ children }: { children: ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>;
}

function toNumberOrNull(value: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatDecimal(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return value.toFixed(1);
}
