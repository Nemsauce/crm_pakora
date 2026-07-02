type RiskOrbProps = {
  nivelRiesgo: string | null;
};

const riskClassName = {
  bajo: {
    outer: "bg-risk-low-bg",
    inner: "bg-risk-low",
  },
  medio: {
    outer: "bg-risk-medium-bg",
    inner: "bg-risk-medium",
  },
  alto: {
    outer: "bg-risk-high-bg",
    inner: "bg-risk-high",
  },
  sin_datos: {
    outer: "bg-bg-page",
    inner: "bg-text-secondary",
  },
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
  const riskClass = riskClassName[risk];

  return (
    <span
      aria-label={`Riesgo ${risk === "sin_datos" ? "sin datos" : risk}`}
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full ${riskClass.outer}`}
    >
      <span className={`size-2.5 rounded-full ${riskClass.inner}`} />
    </span>
  );
}
