import { ProductSummaryTable } from "@/components/command-center/ProductSummaryTable";
import { createClient } from "@/lib/supabase/server";

export default async function CommandCenterMetricasPage() {
  const supabase = await createClient();
  const { data: productSummaryData, error: productSummaryError } =
    await supabase.rpc("product_order_summary");

  if (productSummaryError) {
    throw new Error(
      `No se pudo cargar el resumen por producto: ${productSummaryError.message}`,
    );
  }

  const productRows = productSummaryData ?? [];

  return (
    <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-transparent bg-[var(--color-bg-surface-subtle)] p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-body text-xs uppercase text-text-secondary">
            Torre de control
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            Métricas
          </h1>
          <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
            Pedidos por producto, estados y porcentajes sobre el histórico
            completo.
          </p>
        </div>

        <p className="w-fit rounded-full bg-[var(--color-bg-surface-elevated)] px-3 py-2 font-body text-xs font-semibold text-text-secondary shadow-sm">
          Histórico completo, todos los períodos.
        </p>
      </header>

      <div className="mt-5">
        <ProductSummaryTable rows={productRows} />
      </div>
    </section>
  );
}
