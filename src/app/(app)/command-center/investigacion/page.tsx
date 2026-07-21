import { Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RefreshDropkillerButton } from "@/components/command-center/RefreshDropkillerButton";
import {
  SavedProductCard,
  type SavedDropkillerProduct,
} from "@/components/command-center/SavedProductCard";
import {
  SweetSpotCard,
  type SweetSpotCandidate,
  type SweetSpotCountry,
} from "@/components/command-center/SweetSpotCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchDropkillerProduct,
  type DropkillerProductSearchResult,
} from "@/lib/dropkiller/searchDropkillerProduct";
import { createClient } from "@/lib/supabase/server";

type SweetSpotRpcClient = {
  rpc: (
    functionName: "dropkiller_sweet_spot_candidates",
  ) => Promise<{
    data: SweetSpotCandidate[] | null;
    error: { message: string } | null;
  }>;
};

type SavedProductsReadClient = {
  from(table: "dropkiller_saved_products"): {
    select: (columns: "*") => Promise<{
      data: SavedDropkillerProduct[] | null;
      error: { message: string } | null;
    }>;
  };
};

type PageProps = {
  searchParams: Promise<{
    vista?: string | string[];
    producto?: string | string[];
    pais_producto?: string | string[];
  }>;
};

type InvestigationView = "sugeridos" | "guardados";

type ProductLookupState =
  | { status: "idle" }
  | { status: "found"; result: DropkillerProductSearchResult }
  | { status: "not_found"; productId: string; country: SweetSpotCountry }
  | { status: "error" };

const countryLabel: Record<SweetSpotCountry, string> = {
  CO: "Colombia",
  MX: "México",
};

const countries = ["CO", "MX"] as const satisfies readonly SweetSpotCountry[];

async function submitProductLookup(formData: FormData) {
  "use server";

  const productId = String(formData.get("product_id") ?? "").trim();
  const countryValue = String(formData.get("product_country") ?? "CO");
  const viewValue = String(formData.get("view") ?? "sugeridos");
  const country = countryValue === "MX" ? "MX" : "CO";
  const params = new URLSearchParams({
    producto: productId.slice(0, 100),
    pais_producto: country,
  });

  if (viewValue === "guardados") {
    params.set("vista", "guardados");
  }

  redirect(`/command-center/investigacion?${params.toString()}`);
}

export default async function CommandCenterInvestigacionPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const view = getView(params.vista);
  const searchedProductId = getSingleValue(params.producto).trim().slice(0, 100);
  const searchedCountry = getSearchCountry(params.pais_producto);
  const supabase = await createClient();
  const savedProductsClient = supabase as unknown as SavedProductsReadClient;
  const [savedProductsResult, productLookup] = await Promise.all([
    savedProductsClient.from("dropkiller_saved_products").select("*"),
    loadProductLookup(searchedProductId, searchedCountry),
  ]);
  const { data: savedProductsData, error: savedProductsError } =
    savedProductsResult;

  if (savedProductsError) {
    throw new Error(
      `No se pudieron cargar los productos guardados: ${savedProductsError.message}`,
    );
  }

  const savedProducts = (savedProductsData ?? []).filter(isSavedProduct);
  const savedKeys = new Set(
    savedProducts.map((product) =>
      getSavedProductKey(product.country_code, product.external_id),
    ),
  );

  if (view === "guardados") {
    return (
      <InvestigationShell
        view={view}
        searchedProductId={searchedProductId}
        searchedCountry={searchedCountry}
        productLookup={productLookup}
        savedKeys={savedKeys}
      >
        <SavedProductsSection products={savedProducts} />
      </InvestigationShell>
    );
  }

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
    <InvestigationShell
      view={view}
      searchedProductId={searchedProductId}
      searchedCountry={searchedCountry}
      productLookup={productLookup}
      savedKeys={savedKeys}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        {countries.map((country) => (
          <SweetSpotCountrySection
            key={country}
            country={country}
            candidates={candidates
              .filter((candidate) => candidate.country_code === country)
              .slice(0, 10)}
            savedKeys={savedKeys}
          />
        ))}
      </div>
    </InvestigationShell>
  );
}

function InvestigationShell({
  view,
  searchedProductId,
  searchedCountry,
  productLookup,
  savedKeys,
  children,
}: {
  view: InvestigationView;
  searchedProductId: string;
  searchedCountry: SweetSpotCountry;
  productLookup: ProductLookupState;
  savedKeys: Set<string>;
  children: React.ReactNode;
}) {
  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="border-b border-border pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-body text-xs uppercase text-text-secondary">
              Torre de control
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

          <RefreshDropkillerButton />
        </div>

        <nav
          aria-label="Vista de investigación"
          className="mt-5 inline-flex rounded-xl border border-border bg-bg-page p-1"
        >
          <ViewTab
            href="/command-center/investigacion"
            active={view === "sugeridos"}
          >
            Sugeridos
          </ViewTab>
          <ViewTab
            href="/command-center/investigacion?vista=guardados"
            active={view === "guardados"}
          >
            Guardados
          </ViewTab>
        </nav>
      </div>

      <div className="mt-6">
        <ProductLookupSection
          view={view}
          productId={searchedProductId}
          country={searchedCountry}
          lookup={productLookup}
          savedKeys={savedKeys}
        />
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}

function ProductLookupSection({
  view,
  productId,
  country,
  lookup,
  savedKeys,
}: {
  view: InvestigationView;
  productId: string;
  country: SweetSpotCountry;
  lookup: ProductLookupState;
  savedKeys: Set<string>;
}) {
  const clearHref =
    view === "guardados"
      ? "/command-center/investigacion?vista=guardados"
      : "/command-center/investigacion";

  return (
    <section className="rounded-2xl border border-border bg-bg-surface p-5 shadow-lg">
      <div>
        <p className="font-body text-xs uppercase text-text-secondary">
          Consulta puntual
        </p>
        <h2 className="mt-2 font-display text-lg font-semibold text-text-primary">
          Analizar producto por ID
        </h2>
        <p className="mt-2 max-w-3xl font-body text-sm text-text-secondary">
          Consulta el producto en vivo y compara su ritmo con la muestra diaria
          almacenada para el país seleccionado.
        </p>
      </div>

      <form
        action={submitProductLookup}
        className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto] md:items-end"
      >
        <input type="hidden" name="view" value={view} />
        <label className="grid gap-1.5">
          <span className="font-body text-xs text-text-secondary">
            ID Dropi / Dropkiller
          </span>
          <Input
            name="product_id"
            defaultValue={productId}
            required
            maxLength={100}
            inputMode="numeric"
            placeholder="Ej. 2091078"
            className="h-11 rounded-xl border-border bg-bg-page font-mono tabular-nums text-text-primary"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="font-body text-xs text-text-secondary">País</span>
          <select
            name="product_country"
            defaultValue={country}
            className="h-11 rounded-xl border border-border bg-bg-page px-3 font-body text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="CO">Colombia</option>
            <option value="MX">México</option>
          </select>
        </label>
        <Button
          type="submit"
          className="h-11 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-5 text-bg-surface hover:opacity-90"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Buscar
        </Button>
      </form>

      {lookup.status === "not_found" ? (
        <div className="mt-5 rounded-2xl border border-border bg-bg-page p-4 font-body text-sm text-text-secondary">
          Producto {lookup.productId} no encontrado en {countryLabel[lookup.country]}.
        </div>
      ) : null}

      {lookup.status === "error" ? (
        <div className="mt-5 rounded-2xl border border-risk-high/20 bg-risk-high-bg p-4 font-body text-sm text-risk-high">
          No se pudo consultar Dropkiller en este momento. Intenta nuevamente.
        </div>
      ) : null}

      {lookup.status === "found" ? (
        <div className="mt-5">
          <div className="mb-3 flex justify-end">
            <Link
              href={clearHref}
              className="font-body text-xs font-semibold text-[var(--color-accent)] hover:underline"
            >
              Limpiar consulta
            </Link>
          </div>
          <SweetSpotCard
            candidate={lookup.result.product}
            isSaved={savedKeys.has(
              getSavedProductKey(
                lookup.result.product.country_code,
                lookup.result.product.external_id,
              ),
            )}
            comparisonLabel={`Comparado contra los ${lookup.result.comparisonSize} productos de mayor movimiento hoy en ${countryLabel[lookup.result.product.country_code]}.`}
            showRawSignals
          />
        </div>
      ) : null}
    </section>
  );
}

function ViewTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "rounded-lg px-4 py-2 font-body text-sm font-semibold transition-colors",
        active
          ? "bg-bg-surface text-text-primary shadow-sm"
          : "text-text-secondary hover:text-text-primary",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function SweetSpotCountrySection({
  country,
  candidates,
  savedKeys,
}: {
  country: SweetSpotCountry;
  candidates: SweetSpotCandidate[];
  savedKeys: Set<string>;
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
              isSaved={savedKeys.has(
                getSavedProductKey(
                  candidate.country_code,
                  candidate.external_id,
                ),
              )}
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

function SavedProductsSection({
  products,
}: {
  products: SavedDropkillerProduct[];
}) {
  return (
    <section>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Lista compartida
          </p>
          <h2 className="mt-2 font-display text-lg font-semibold text-text-primary">
            Productos guardados
          </h2>
        </div>
        <p className="font-body text-sm text-text-secondary">
          {products.length} {products.length === 1 ? "producto" : "productos"}
        </p>
      </div>

      {products.length > 0 ? (
        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {products.map((product) => (
            <SavedProductCard key={String(product.id)} product={product} />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-border bg-bg-surface p-6 font-body text-sm text-text-secondary shadow-lg">
          Aún no hay productos guardados.
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

function isSavedProduct(
  product: SavedDropkillerProduct,
): product is SavedDropkillerProduct {
  return (
    product.id !== null &&
    product.id !== undefined &&
    Boolean(String(product.external_id).trim()) &&
    (product.country_code === "CO" || product.country_code === "MX")
  );
}

function getSavedProductKey(
  country: SweetSpotCountry,
  externalId: string | number | null,
) {
  return `${country}:${externalId === null ? "" : String(externalId).trim()}`;
}

function getView(value: string | string[] | undefined): InvestigationView {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved === "guardados" ? "guardados" : "sugeridos";
}

function getSearchCountry(
  value: string | string[] | undefined,
): SweetSpotCountry {
  return getSingleValue(value) === "MX" ? "MX" : "CO";
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

async function loadProductLookup(
  productId: string,
  country: SweetSpotCountry,
): Promise<ProductLookupState> {
  if (!productId) {
    return { status: "idle" };
  }

  try {
    const result = await searchDropkillerProduct(productId, country);

    return result
      ? { status: "found", result }
      : { status: "not_found", productId, country };
  } catch (error) {
    console.error(
      "On-demand Dropkiller product lookup failed",
      error instanceof Error ? error.message : "Unknown error",
    );

    return { status: "error" };
  }
}
