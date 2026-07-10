"use client";

import { ExternalLink, ImageIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { removeSavedProduct } from "@/app/(app)/command-center/investigacion/actions";
import { Button } from "@/components/ui/button";

import type { SweetSpotCountry } from "./SweetSpotCard";

export type SavedDropkillerProduct = {
  id: string | number;
  external_id: string;
  dropkiller_uuid: string | null;
  country_code: SweetSpotCountry;
  nombre_producto: string | null;
  sale_price: number | string | null;
  primary_image_url: string | null;
  sold_units_last_7_days: number | string | null;
  sold_units_last_30_days: number | string | null;
  total_sold_units: number | string | null;
  providers_count: number | string | null;
};

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
} satisfies Record<SweetSpotCountry, Intl.NumberFormat>;

const countFormatter = {
  CO: new Intl.NumberFormat("es-CO"),
  MX: new Intl.NumberFormat("es-MX"),
} satisfies Record<SweetSpotCountry, Intl.NumberFormat>;

export function SavedProductCard({
  product,
}: {
  product: SavedDropkillerProduct;
}) {
  const productName = product.nombre_producto || "Producto sin nombre";
  const productUrl = getDropkillerProductUrl(product.dropkiller_uuid);
  const removeAction = removeSavedProduct.bind(null, product.id);

  return (
    <article
      className={[
        "relative rounded-2xl border border-border bg-bg-surface p-5 text-text-primary shadow-lg",
        productUrl
          ? "cursor-pointer transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl focus-within:ring-2 focus-within:ring-[var(--color-accent)] focus-within:ring-offset-2 focus-within:ring-offset-bg-page motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          : "",
      ].join(" ")}
    >
      {productUrl ? (
        <a
          href={productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-0 rounded-2xl outline-none"
        >
          <span className="sr-only">Abrir {productName} en Dropkiller</span>
        </a>
      ) : null}

      <div
        className={`relative z-10 ${productUrl ? "pointer-events-none" : ""}`}
      >
        <div className="flex min-w-0 items-start gap-4">
          <ProductThumbnail
            src={product.primary_image_url}
            productName={productName}
          />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <p className="font-body text-xs font-semibold uppercase text-text-secondary">
                  {product.country_code === "CO" ? "Colombia" : "México"}
                </p>
                <h3 className="mt-1 break-words font-display text-lg font-semibold text-text-primary">
                  {productName}
                </h3>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <p className="font-mono text-lg font-semibold tabular-nums text-text-primary">
                  {formatCurrency(product.country_code, product.sale_price)}
                </p>
                {productUrl ? (
                  <ExternalLink
                    aria-hidden="true"
                    className="h-4 w-4 text-text-secondary"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="font-body text-xs font-semibold uppercase text-text-secondary">
            Datos guardados
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Stat
              label="Vendidas"
              value={formatCount(product.country_code, product.total_sold_units)}
            />
            <Stat
              label="Últimos 7 días"
              value={formatCount(
                product.country_code,
                product.sold_units_last_7_days,
              )}
            />
            <Stat
              label="Últimos 30 días"
              value={formatCount(
                product.country_code,
                product.sold_units_last_30_days,
              )}
            />
            <Stat
              label="Competencia"
              value={formatProviders(
                product.country_code,
                product.providers_count,
              )}
            />
          </dl>
        </div>

        <form
          action={removeAction}
          className="pointer-events-auto relative z-20 mt-5 flex justify-end"
        >
          <RemoveButton />
        </form>
      </div>
    </article>
  );
}

function ProductThumbnail({
  src,
  productName,
}: {
  src: string | null;
  productName: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-border bg-bg-page text-text-secondary">
        <ImageIcon aria-hidden="true" className="h-7 w-7" />
        <span className="sr-only">Imagen no disponible</span>
      </div>
    );
  }

  return (
    // Dropkiller serves product images from dynamic CDN hosts not configured in Next/Image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={productName}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-20 w-20 shrink-0 rounded-xl border border-border bg-bg-page object-cover"
    />
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="destructive"
      size="sm"
      disabled={pending}
      className="rounded-full"
    >
      <Trash2 aria-hidden="true" />
      {pending ? "Quitando..." : "Quitar de guardados"}
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-body text-xs text-text-secondary">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-text-primary">
        {value}
      </dd>
    </div>
  );
}

function formatCurrency(
  country: SweetSpotCountry,
  value: number | string | null,
) {
  const numberValue = toNumberOrNull(value);
  return numberValue === null
    ? "—"
    : currencyFormatter[country].format(numberValue);
}

function formatCount(
  country: SweetSpotCountry,
  value: number | string | null,
) {
  const numberValue = toNumberOrNull(value);
  return numberValue === null
    ? "—"
    : countFormatter[country].format(numberValue);
}

function formatProviders(
  country: SweetSpotCountry,
  value: number | string | null,
) {
  const numberValue = toNumberOrNull(value);

  if (numberValue === null) {
    return "Sin datos";
  }

  return `${countFormatter[country].format(numberValue)} ${
    numberValue === 1 ? "vendedor" : "vendedores"
  }`;
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

function getDropkillerProductUrl(value: string | null) {
  const uuid = value?.trim();
  return uuid
    ? `https://www.dropkiller.com/dashboard/products/${encodeURIComponent(uuid)}`
    : null;
}
