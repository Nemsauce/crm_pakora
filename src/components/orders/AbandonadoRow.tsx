"use client";

import { format, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Sparkles,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Select } from "radix-ui";

import {
  suggestAbandonadoMessage,
  updateAbandonadoEstado,
  type EstadoAbandonado,
} from "@/app/(app)/pedidos/abandonados-actions";
import { Button } from "@/components/ui/button";
import { formatPhoneForWhatsApp } from "@/lib/whatsapp/formatPhoneForWhatsApp";

export type AbandonadoListItem = {
  id: number;
  pais: "CO" | "MX";
  codigo_externo: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  nombre_producto: string | null;
  precio: number | string | null;
  fecha_abandono: string | null;
  estado: EstadoAbandonado;
  sincronizado_en: string;
};

const STATUS_OPTIONS: Array<{
  value: EstadoAbandonado;
  label: string;
}> = [
  { value: "nuevo", label: "Nuevo" },
  { value: "contactado", label: "Contactado" },
  { value: "recuperado", label: "Recuperado" },
  { value: "descartado", label: "Descartado" },
];

const STATUS_TONE: Record<EstadoAbandonado, string> = {
  nuevo:
    "bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)]",
  contactado:
    "bg-[var(--color-accent-blue-bg)] text-[var(--color-accent-blue)]",
  recuperado: "bg-positive-bg text-positive",
  descartado: "bg-bg-page text-text-secondary",
};

function getCustomerName(row: AbandonadoListItem) {
  return [row.nombre, row.apellido]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ") || "Cliente sin nombre";
}

function getLocation(row: AbandonadoListItem) {
  return [row.ciudad, row.departamento]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ") || "Ubicación sin registrar";
}

function formatAbandonmentDate(value: string | null) {
  if (!value) {
    return "Fecha sin registrar";
  }

  const parsed = parseISO(value);

  return isValid(parsed)
    ? format(parsed, "d 'de' MMMM 'de' yyyy", { locale: es })
    : "Fecha inválida";
}

function formatPrice(value: AbandonadoListItem["precio"], pais: "CO" | "MX") {
  if (value === null || (typeof value === "string" && !value.trim())) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Intl.NumberFormat(pais === "CO" ? "es-CO" : "es-MX", {
    style: "currency",
    currency: pais === "CO" ? "COP" : "MXN",
    maximumFractionDigits: 0,
  }).format(parsed);
}

function SuggestionCopyButton({ suggestion }: { suggestion: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(suggestion);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-bg-page px-2.5 font-mono text-xs font-semibold tabular-nums text-text-primary outline-none transition-colors hover:bg-bg-surface focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Copiar sugerencia de IA"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-positive" aria-hidden="true" />
          <span className="font-body text-positive">Copiado</span>
        </>
      ) : (
        <>
          <Copy
            className="h-3.5 w-3.5 text-text-secondary"
            aria-hidden="true"
          />
          <span className="font-body">Copiar</span>
        </>
      )}
    </button>
  );
}

export function AbandonadoRow({ row }: { row: AbandonadoListItem }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [stateOverride, setStateOverride] = useState<{
    base: EstadoAbandonado;
    value: EstadoAbandonado;
  } | null>(null);
  const [stateFeedback, setStateFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [isUpdatingState, startStateTransition] = useTransition();
  const [isSuggesting, startSuggestionTransition] = useTransition();
  const selectedState =
    stateOverride?.base === row.estado ? stateOverride.value : row.estado;
  const customerName = getCustomerName(row);
  const price = formatPrice(row.precio, row.pais);
  const whatsappNumber = row.telefono
    ? formatPhoneForWhatsApp(row.telefono, row.pais)
    : "";
  const whatsappUrl = whatsappNumber
    ? `https://api.whatsapp.com/send/?phone=${whatsappNumber}${
        suggestion ? `&text=${encodeURIComponent(suggestion)}` : ""
      }`
    : null;
  const displayPhone = whatsappNumber
    ? `+${whatsappNumber}`
    : row.telefono?.trim() || "Sin teléfono";

  function handleStateChange(nextState: string) {
    const state = nextState as EstadoAbandonado;
    const previousState = selectedState;
    setStateOverride({ base: row.estado, value: state });
    setStateFeedback(null);

    startStateTransition(async () => {
      try {
        const result = await updateAbandonadoEstado(row.id, state);

        if (result.error !== null) {
          setStateOverride({ base: row.estado, value: previousState });
          setStateFeedback({ type: "error", message: result.error });
          return;
        }

        setStateOverride({ base: row.estado, value: result.estado });
        setStateFeedback({ type: "success", message: "Estado actualizado." });
        const params = new URLSearchParams(searchParams);
        const activeStateFilter = params.get("estado_abandonado");

        if (activeStateFilter && activeStateFilter !== result.estado) {
          params.delete("page");
          const query = params.toString();
          const currentQuery = searchParams.toString();

          if (query === currentQuery) {
            router.refresh();
          } else {
            router.replace(query ? `${pathname}?${query}` : pathname, {
              scroll: false,
            });
          }
        } else {
          router.refresh();
        }
      } catch {
        setStateOverride({ base: row.estado, value: previousState });
        setStateFeedback({
          type: "error",
          message: "No se pudo actualizar el estado.",
        });
      }
    });
  }

  function handleSuggest() {
    setSuggestionError(null);

    startSuggestionTransition(async () => {
      try {
        const result = await suggestAbandonadoMessage(row.id);

        if (result.error !== null) {
          setSuggestionError(result.error);
          return;
        }

        setSuggestion(result.suggestion);
      } catch {
        setSuggestionError(
          "No se pudo generar la sugerencia. Intenta nuevamente.",
        );
      }
    });
  }

  return (
    <article className="rounded-2xl border border-border bg-bg-surface p-4 shadow-md">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-bg-page px-3 py-1 font-mono text-xs font-semibold tabular-nums text-text-secondary">
              {row.codigo_externo}
            </span>
            <span className="rounded-full bg-[var(--color-badge-nuevo-bg)] px-3 py-1 font-mono text-xs font-semibold text-[var(--color-badge-nuevo)]">
              {row.pais}
            </span>
          </div>
          <h2 className="mt-3 truncate font-display text-lg font-semibold text-text-primary">
            {customerName}
          </h2>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-1 lg:items-end">
          <Select.Root
            value={selectedState}
            onValueChange={handleStateChange}
            disabled={isUpdatingState}
          >
            <Select.Trigger
              className={`inline-flex h-9 items-center gap-2 rounded-full px-3 font-body text-xs font-semibold outline-none transition-colors focus:ring-2 focus:ring-ring disabled:opacity-60 ${STATUS_TONE[selectedState]}`}
              aria-label={`Estado de ${customerName}`}
            >
              {isUpdatingState ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              <Select.Value />
              <Select.Icon>
                <ChevronDown className="h-3.5 w-3.5" />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                position="popper"
                sideOffset={6}
                className="z-50 overflow-hidden rounded-2xl border border-border bg-bg-surface text-text-primary shadow-md"
              >
                <Select.Viewport className="p-1">
                  {STATUS_OPTIONS.map((option) => (
                    <Select.Item
                      key={option.value}
                      value={option.value}
                      className="relative flex h-8 cursor-default select-none items-center rounded-lg px-2 font-body text-sm text-text-primary outline-none data-[highlighted]:bg-[var(--color-accent)]/10 data-[highlighted]:text-[var(--color-accent)]"
                    >
                      <Select.ItemText>{option.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
          <div aria-live="polite">
            {stateFeedback ? (
              <p
                className={`font-body text-xs ${
                  stateFeedback.type === "success"
                    ? "text-positive"
                    : "text-negative"
                }`}
              >
                {stateFeedback.message}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-w-0 gap-2">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="font-body text-xs text-text-secondary">Teléfono</dt>
            <dd className="truncate font-mono text-sm font-semibold tabular-nums text-text-primary">
              {displayPhone}
            </dd>
          </div>
        </div>

        <div className="flex min-w-0 gap-2">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="font-body text-xs text-text-secondary">Producto</dt>
            <dd className="font-body text-sm font-semibold text-text-primary">
              {row.nombre_producto?.trim() || "Sin producto identificado"}
            </dd>
            {price ? (
              <dd className="font-mono text-xs font-semibold tabular-nums text-positive">
                {price}
              </dd>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="font-body text-xs text-text-secondary">Ubicación</dt>
            <dd className="font-body text-sm font-semibold text-text-primary">
              {getLocation(row)}
            </dd>
          </div>
        </div>

        <div className="flex min-w-0 gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="font-body text-xs text-text-secondary">Abandonado</dt>
            <dd className="font-body text-sm font-semibold text-text-primary">
              {formatAbandonmentDate(row.fecha_abandono)}
            </dd>
          </div>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleSuggest}
          disabled={isSuggesting}
          className="h-9 rounded-full border-border bg-bg-surface px-4 text-text-primary hover:bg-bg-page hover:text-text-primary"
        >
          {isSuggesting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
          {isSuggesting
            ? "Generando..."
            : suggestion
              ? "Regenerar mensaje"
              : "Sugerir mensaje"}
        </Button>

        {whatsappUrl ? (
          <Button
            asChild
            className="h-9 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 text-bg-surface hover:opacity-90"
          >
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp
            </a>
          </Button>
        ) : (
          <Button type="button" disabled className="h-9 rounded-full px-4">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            WhatsApp
          </Button>
        )}
      </div>

      <div className="mt-3" aria-live="polite" aria-busy={isSuggesting}>
        {suggestion ? (
          <div className="rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-body text-xs font-semibold uppercase text-[var(--color-accent)]">
                Sugerencia de IA
              </p>
              <SuggestionCopyButton suggestion={suggestion} />
            </div>
            <p className="mt-3 whitespace-pre-wrap font-body text-sm leading-relaxed text-text-primary">
              {suggestion}
            </p>
          </div>
        ) : null}

        {suggestionError ? (
          <p className="mt-2 font-body text-xs text-negative" role="alert">
            {suggestionError}
          </p>
        ) : null}
      </div>
    </article>
  );
}
