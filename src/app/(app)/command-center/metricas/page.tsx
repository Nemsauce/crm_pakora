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
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="border-b border-border pb-5">
        <p className="font-body text-xs uppercase text-text-secondary">
          Command Center
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Métricas
        </h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
          Pedidos por producto, estados y porcentajes sobre el histórico
          completo.
        </p>
        <p className="mt-2 font-body text-sm text-text-secondary">
          Histórico completo, todos los períodos.
        </p>
      </div>

      <div className="mt-6">
        <ProductSummaryTable rows={productRows} />
      </div>
    </section>
  );
}
