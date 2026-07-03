import Link from "next/link";

import { Button } from "@/components/ui/button";
import { OrderCardLink } from "@/components/orders/OrderCardLink";
import { OrderDetailDrawer } from "@/components/orders/OrderDetailDrawer";
import { OrderFilters } from "@/components/orders/OrderFilters";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

const PAGE_SIZE = 24;

type SearchParams = {
  pais?: string;
  estado_crm?: string;
  nivel_riesgo?: string;
  q?: string;
  detalle?: string;
  page?: string;
};

type PedidosPageProps = {
  searchParams: Promise<SearchParams>;
};

type Pais = Database["public"]["Enums"]["pais_enum"];
type EstadoCrm = Database["public"]["Enums"]["estado_crm_enum"];

const validCountries = new Set<string>(["CO", "MX"]);
const validStatuses = new Set<string>([
  "nuevo",
  "en_ruta",
  "entregado",
  "cancelado",
  "devolucion",
]);
const validRisks = new Set<string>(["alto", "medio", "bajo", "sin_datos"]);

function escapeIlikeTerm(term: string) {
  return term.replace(/[%,]/g, "");
}

function getPage(value: string | undefined) {
  const page = Number(value);

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

function createPageHref(searchParams: SearchParams, page: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") {
      params.set(key, value);
    }
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/pedidos?${query}` : "/pedidos";
}

export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  const params = await searchParams;
  const page = getPage(params.page);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("*")
    .order("fecha", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (params.pais && validCountries.has(params.pais)) {
    query = query.eq("pais", params.pais as Pais);
  }

  if (params.estado_crm && validStatuses.has(params.estado_crm)) {
    query = query.eq("estado_crm", params.estado_crm as EstadoCrm);
  }

  if (params.nivel_riesgo && validRisks.has(params.nivel_riesgo)) {
    if (params.nivel_riesgo === "sin_datos") {
      query = query.or("nivel_riesgo.is.null,nivel_riesgo.eq.sin_datos");
    } else {
      query = query.eq("nivel_riesgo", params.nivel_riesgo);
    }
  }

  const searchTerm = params.q?.trim();

  if (searchTerm) {
    const term = escapeIlikeTerm(searchTerm);
    query = query.or(
      `nombre.ilike.%${term}%,apellido.ilike.%${term}%,numero_orden.ilike.%${term}%`,
    );
  }

  const { data: orders, error } = await query;

  if (error) {
    throw new Error(`No se pudieron cargar los pedidos: ${error.message}`);
  }

  const orderList = orders ?? [];
  const selectedOrderId = params.detalle ?? null;
  const hasPreviousPage = page > 1;
  const hasNextPage = orderList.length === PAGE_SIZE;

  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <style>{`
        @keyframes crm-fade-slide-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .crm-list-entrance {
          opacity: 0;
          animation: crm-fade-slide-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .crm-list-entrance {
            opacity: 1;
            transform: none;
            animation: none;
          }
        }
      `}</style>

      <div className="border-b border-border pb-4">
        <p className="font-body text-xs uppercase text-text-secondary">
          Pedidos
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Lista de pedidos
        </h1>
      </div>

      <div className="mt-5">
        <OrderFilters />
      </div>

      {orderList.length > 0 ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orderList.map((order, index) => (
            <div
              key={order.id}
              className="crm-list-entrance"
              style={{
                animationDelay: `${Math.min(index * 40, 480)}ms`,
              }}
            >
              <OrderCardLink
                order={order}
                selected={String(order.id) === selectedOrderId}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-border bg-bg-base p-6 font-body text-sm text-text-secondary">
          No hay pedidos que coincidan con estos filtros.
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <Button
          asChild={hasPreviousPage}
          type="button"
          variant="outline"
          disabled={!hasPreviousPage}
          className="border-border bg-bg-base text-text-primary hover:bg-bg-base hover:text-text-primary"
        >
          {hasPreviousPage ? (
            <Link href={createPageHref(params, page - 1)}>Anterior</Link>
          ) : (
            "Anterior"
          )}
        </Button>

        <p className="font-mono text-sm text-text-secondary">Página {page}</p>

        <Button
          asChild={hasNextPage}
          type="button"
          variant="outline"
          disabled={!hasNextPage}
          className="border-border bg-bg-base text-text-primary hover:bg-bg-base hover:text-text-primary"
        >
          {hasNextPage ? (
            <Link href={createPageHref(params, page + 1)}>Siguiente</Link>
          ) : (
            "Siguiente"
          )}
        </Button>
      </div>

      <OrderDetailDrawer />
    </section>
  );
}
