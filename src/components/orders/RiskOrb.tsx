type RiskOrbProps = {
  nivelRiesgo: string | null;
};

const riskClassName = {
  bajo: "bg-risk-low shadow-risk-low/40 [--risk-orb-duration:3.6s]",
  medio: "bg-risk-medium shadow-risk-medium/40 [--risk-orb-duration:2.2s]",
  alto: "bg-risk-high shadow-risk-high/50 [--risk-orb-duration:1.1s]",
  sin_datos: "bg-text-secondary shadow-none",
} as const;

function normalizeRisk(nivelRiesgo: string | null) {
  if (
    nivelRiesgo === "bajo" ||
    nivelRiesgo === "medio" ||
    nivelRiesgo === "alto"
  ) {
    return nivelRiesgo;
  }

  return "sin_datos";
}

export function RiskOrb({ nivelRiesgo }: RiskOrbProps) {
  const risk = normalizeRisk(nivelRiesgo);
  const isAnimated = risk !== "sin_datos";

  return (
    <>
      <span
        aria-label={`Riesgo ${risk === "sin_datos" ? "sin datos" : risk}`}
        className={[
          "risk-orb inline-block size-3.5 shrink-0 rounded-full shadow-[0_0_16px_currentColor]",
          riskClassName[risk],
          isAnimated ? "risk-orb--animated" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <style>{`
        .risk-orb--animated {
          animation: risk-orb-pulse var(--risk-orb-duration) ease-in-out infinite;
          transform-origin: center;
        }

        @keyframes risk-orb-pulse {
          0%, 100% {
            transform: scale(0.86);
            opacity: 0.72;
          }
          50% {
            transform: scale(1.16);
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .risk-orb--animated {
            animation: none;
            transform: none;
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
