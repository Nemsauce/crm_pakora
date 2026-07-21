"use client";

import { Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";

import {
  searchOrders,
  type GlobalSearchResult,
} from "@/app/(app)/search-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchStatus = "idle" | "loading" | "done" | "error";
type EstadoCrm = GlobalSearchResult["estado_crm"];

const estadoLabel: Record<EstadoCrm, string> = {
  nuevo: "Nuevo",
  en_ruta: "En tránsito",
  entregado: "Entregado",
  cancelado: "Cancelado",
  devolucion: "Devolución",
};

const estadoClassName: Record<EstadoCrm, string> = {
  nuevo: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  en_ruta: "bg-bg-page text-[var(--foreground)]",
  entregado: "bg-risk-low-bg text-risk-low",
  cancelado: "bg-risk-high-bg text-risk-high",
  devolucion: "bg-risk-high-bg text-risk-high",
};

function getCustomerName(result: GlobalSearchResult) {
  return [result.nombre, result.apellido].filter(Boolean).join(" ") ||
    "Cliente sin nombre";
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const requestId = ++latestRequestRef.current;
    const term = query.trim();

    if (!isOpen || !term) {
      return;
    }

    const timer = window.setTimeout(() => {
      setStatus("loading");

      void searchOrders(term)
        .then((response) => {
          if (latestRequestRef.current !== requestId) {
            return;
          }

          setResults(response.results);
          setStatus(response.error ? "error" : "done");
        })
        .catch(() => {
          if (latestRequestRef.current !== requestId) {
            return;
          }

          setResults([]);
          setStatus("error");
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [isOpen, query]);

  function handleQueryChange(value: string) {
    setQuery(value);

    if (value.trim()) {
      setResults([]);
      setStatus("loading");
    } else {
      latestRequestRef.current += 1;
      setResults([]);
      setStatus("idle");
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]"
          aria-label="Buscar pedidos"
          title="Buscar pedidos (Ctrl+K)"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--color-text-primary)]/20" />
        <Dialog.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-bg-surface text-[var(--foreground)] shadow-xl outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search
              className="h-5 w-5 shrink-0 text-[var(--muted-foreground)]"
              aria-hidden="true"
            />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="Nombre, teléfono o número de orden"
              aria-label="Buscar pedidos"
              className="h-11 flex-1 border-0 bg-transparent p-0 font-body text-base text-[var(--foreground)] shadow-none focus-visible:ring-0"
            />
            {status === "loading" ? (
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin text-[var(--muted-foreground)]"
                aria-label="Buscando"
              />
            ) : null}
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-[var(--muted-foreground)] hover:bg-bg-page hover:text-[var(--foreground)]"
                aria-label="Cerrar búsqueda"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <Dialog.Title className="sr-only">Buscar pedidos</Dialog.Title>
          <Dialog.Description className="sr-only">
            Busca pedidos por cliente, teléfono o número de orden.
          </Dialog.Description>

          <div className="max-h-[min(28rem,65vh)] overflow-y-auto p-2">
            {!query.trim() ? (
              <p className="px-4 py-12 text-center font-body text-sm text-[var(--muted-foreground)]">
                Escribe para buscar
              </p>
            ) : status === "error" ? (
              <p className="px-4 py-12 text-center font-body text-sm text-risk-high">
                No se pudo completar la búsqueda.
              </p>
            ) : status === "done" && results.length === 0 ? (
              <p className="px-4 py-12 text-center font-body text-sm text-[var(--muted-foreground)]">
                Sin resultados
              </p>
            ) : (
              <ul className="space-y-1">
                {results.map((result) => (
                  <li key={result.id}>
                    <Link
                      href={`/pedidos?detalle=${result.id}`}
                      onClick={() => setIsOpen(false)}
                      className="flex items-start justify-between gap-4 rounded-xl px-3 py-3 outline-none transition-colors hover:bg-[var(--color-accent)]/10 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold tabular-nums text-[var(--muted-foreground)]">
                            {result.numero_orden ?? `ID ${result.id}`}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 font-body text-xs font-semibold ${estadoClassName[result.estado_crm]}`}
                          >
                            {estadoLabel[result.estado_crm]}
                          </span>
                        </span>
                        <span className="mt-1 block truncate font-body text-sm font-semibold text-[var(--foreground)]">
                          {getCustomerName(result)}
                        </span>
                        <span className="mt-1 block truncate font-body text-xs text-[var(--muted-foreground)]">
                          {result.nombre_producto?.trim() ||
                            "Producto sin nombre"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-4 py-2 font-body text-xs text-[var(--muted-foreground)]">
            <span className="font-mono">Esc</span> para cerrar
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
