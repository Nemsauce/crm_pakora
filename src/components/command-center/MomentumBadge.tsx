"use client";

import type { ReactNode } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

type MomentumBadgeProps = {
  momentumRatio: number | string | null;
  ritmo7d: number | string | null;
  ritmo23dPrevio: number | string | null;
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
  momentumRatio,
  ritmo7d,
  ritmo23dPrevio,
}: MomentumBadgeProps) {
  const ratio = toNumber(momentumRatio);
  const tier = getMomentumTier(ratio);
  const config = tierConfig[tier];
  const tooltipText = getTooltipText({
    tier,
    momentumRatio: ratio,
    ritmo7d: toNumber(ritmo7d),
    ritmo23dPrevio: toNumber(ritmo23dPrevio),
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

function getMomentumTier(momentumRatio: number): MomentumTier {
  if (momentumRatio >= 3) {
    return "explosivo";
  }

  if (momentumRatio >= 1.5) {
    return "acelerando";
  }

  return "subiendo";
}

function getTooltipText({
  tier,
  momentumRatio,
  ritmo7d,
  ritmo23dPrevio,
}: {
  tier: MomentumTier;
  momentumRatio: number;
  ritmo7d: number;
  ritmo23dPrevio: number;
}) {
  const currentPace = formatDecimal(ritmo7d);
  const previousPace = formatDecimal(ritmo23dPrevio);
  const ratio = formatDecimal(momentumRatio);

  if (tier === "explosivo") {
    return (
      <>
        Se está vendiendo ~<TooltipNumber>{currentPace}</TooltipNumber>{" "}
        unidades por día en la última semana; eso es{" "}
        <TooltipNumber>{ratio}x</TooltipNumber> más rápido que el ritmo de las 3
        semanas anteriores (~<TooltipNumber>{previousPace}/día</TooltipNumber>
        ).
      </>
    );
  }

  if (tier === "acelerando") {
    return (
      <>
        La demanda está tomando velocidad: ~
        <TooltipNumber>{currentPace}</TooltipNumber> unidades por día esta semana
        frente a ~<TooltipNumber>{previousPace}/día</TooltipNumber> en las 3
        semanas previas, una mejora de{" "}
        <TooltipNumber>{ratio}x</TooltipNumber>.
      </>
    );
  }

  return (
    <>
      Está subiendo de forma sana: ~<TooltipNumber>{currentPace}</TooltipNumber>{" "}
      unidades por día en los últimos 7 días versus ~
      <TooltipNumber>{previousPace}/día</TooltipNumber> antes, con{" "}
      <TooltipNumber>{ratio}x</TooltipNumber> de momentum.
    </>
  );
}

function TooltipNumber({ children }: { children: ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>;
}

function toNumber(value: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatDecimal(value: number) {
  if (!Number.isFinite(value)) {
    return "0.0";
  }

  return value.toFixed(1);
}
