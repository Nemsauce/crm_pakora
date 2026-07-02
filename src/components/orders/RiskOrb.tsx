type RiskOrbProps = {
  nivelRiesgo: string | null;
};

const riskClassName = {
  bajo: "bg-risk-low",
  medio: "bg-risk-medium",
  alto: "bg-risk-high",
  sin_datos: "bg-text-secondary/40",
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

  return (
    <span
      aria-label={`Riesgo ${risk === "sin_datos" ? "sin datos" : risk}`}
      className={`inline-block size-3 shrink-0 rounded-full ${riskClassName[risk]}`}
    />
  );
}
