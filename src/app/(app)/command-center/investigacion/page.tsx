import {
  SweetSpotCard,
  type SweetSpotCandidate,
  type SweetSpotCountry,
} from "@/components/command-center/SweetSpotCard";
import { createClient } from "@/lib/supabase/server";

type SweetSpotRpcClient = {
  rpc: (
    functionName: "dropkiller_sweet_spot_candidates",
  ) => Promise<{
    data: SweetSpotCandidate[] | null;
    error: { message: string } | null;
  }>;
};

const countryLabel: Record<SweetSpotCountry, string> = {
  CO: "Colombia",
  MX: "México",
};

const countries = ["CO", "MX"] as const satisfies readonly SweetSpotCountry[];

export default async function CommandCenterInvestigacionPage() {
  const supabase = await createClient();
  const { data: candidatesData, error: candidatesError } =
    await (supabase as unknown as SweetSpotRpcClient).rpc(
      "dropkiller_sweet_spot_candidates",
    );

  if (candidatesError) {
    throw new Error(
      `No se pudieron cargar los productos sugeridos: ${candidatesError.message}`,
    );
  }

  const candidates = (candidatesData ?? []).filter(isSweetSpotCandidate);

  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="border-b border-border pb-5">
        <p className="font-body text-xs uppercase text-text-secondary">
          Command Center
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Investigación
        </h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
          Productos sugeridos para testear según su nivel de demanda,
          consistencia y tendencia ascendente.
        </p>
        <p className="mt-2 font-body text-sm text-text-secondary">
          Curado automáticamente desde Dropkiller.
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {countries.map((country) => (
          <SweetSpotCountrySection
            key={country}
            country={country}
            candidates={candidates
              .filter((candidate) => candidate.country_code === country)
              .slice(0, 10)}
          />
        ))}
      </div>
    </section>
  );
}

function SweetSpotCountrySection({
  country,
  candidates,
}: {
  country: SweetSpotCountry;
  candidates: SweetSpotCandidate[];
}) {
  return (
    <section className="min-w-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            {countryLabel[country]}
          </p>
          <h3 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Sweet spots
          </h3>
        </div>
        <p className="font-body text-sm text-text-secondary">
          Productos sugeridos
        </p>
      </div>

      {candidates.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {candidates.map((candidate) => (
            <SweetSpotCard
              key={`${candidate.country_code}-${candidate.external_id}`}
              candidate={candidate}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-bg-page p-4 font-body text-sm text-text-secondary">
          Sin datos
        </div>
      )}
    </section>
  );
}

function isSweetSpotCandidate(
  candidate: SweetSpotCandidate,
): candidate is SweetSpotCandidate {
  return (
    candidate.es_sweet_spot === true &&
    (candidate.country_code === "CO" || candidate.country_code === "MX")
  );
}
