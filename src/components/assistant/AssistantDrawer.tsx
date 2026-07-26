"use client";

import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Dialog } from "radix-ui";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useRef,
  useState,
} from "react";

import {
  askOrderAssistant,
  type ActiveOrderSummary,
  type OrderAssistantChatMessage,
} from "@/app/(app)/asistente/actions";
import { Button } from "@/components/ui/button";

type ChatMessage = OrderAssistantChatMessage & {
  id: string;
};

function getMessageId(role: OrderAssistantChatMessage["role"]) {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getActiveOrderLabel(activeOrder: ActiveOrderSummary) {
  const orderLabel = activeOrder.numeroOrden ?? `ID ${activeOrder.id}`;

  return activeOrder.customerName
    ? `${orderLabel} · ${activeOrder.customerName}`
    : orderLabel;
}

function getDetailOrderId(value: string | null) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const orderId = Number(value);

  return Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog.Root modal={false} open={isOpen} onOpenChange={setIsOpen}>
      {children}
    </Dialog.Root>
  );
}

export function AssistantDrawerTrigger({
  children,
}: {
  children: ReactElement;
}) {
  return <Dialog.Trigger asChild>{children}</Dialog.Trigger>;
}

export function AssistantDrawer() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [activeOrder, setActiveOrder] = useState<ActiveOrderSummary | null>(
    null,
  );
  const [isSending, setIsSending] = useState(false);
  const historyStartIndexRef = useRef(0);
  const detailOrderId = getDetailOrderId(searchParams.get("detalle"));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draft.trim();

    if (!content || isSending) {
      return;
    }

    const history = messages
      .slice(historyStartIndexRef.current)
      .map(({ role, content: previousContent }) => ({
        role,
        content: previousContent,
      }));
    const userMessage: ChatMessage = {
      id: getMessageId("user"),
      role: "user",
      content,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsSending(true);

    try {
      const result = await askOrderAssistant({
        message: content,
        history,
        activeOrderId: activeOrder?.id ?? null,
        detailOrderId,
      });

      setMessages((current) => [
        ...current,
        {
          id: getMessageId("assistant"),
          role: "assistant",
          content: result.answer,
        },
      ]);
      setActiveOrder(result.activeOrder);

      if (result.historyReset) {
        historyStartIndexRef.current = messages.length;
      }
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: getMessageId("assistant"),
          role: "assistant",
          content:
            "No pude procesar la consulta en este momento. Intenta nuevamente.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <Dialog.Portal>
      <style>{`
        @keyframes crm-assistant-drawer-enter {
          from {
            opacity: 0;
            transform: translateX(-24px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .crm-assistant-drawer[data-state="open"] {
          animation: crm-assistant-drawer-enter 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .crm-assistant-drawer[data-state="open"] {
            animation: none;
          }
        }
      `}</style>
      <Dialog.Content
        id="assistant-drawer"
        className="crm-assistant-drawer fixed inset-y-0 left-0 z-50 flex w-full max-w-xl flex-col border-r border-border bg-bg-surface text-[var(--foreground)] shadow-xl outline-none"
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-lg font-semibold text-[var(--foreground)]">
                Asistente de pedidos
              </Dialog.Title>
              <Dialog.Description className="mt-1 font-body text-sm text-[var(--muted-foreground)]">
                Consulta pedidos sin salir de tu flujo de trabajo.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-lg border-border bg-bg-surface text-[var(--foreground)] hover:bg-bg-page hover:text-[var(--foreground)]"
                aria-label="Cerrar asistente"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          {activeOrder ? (
            <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 px-3 py-2 font-body text-xs font-semibold text-[var(--color-accent)]">
              <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                Pedido activo: {getActiveOrderLabel(activeOrder)}
              </span>
            </div>
          ) : null}
        </div>

        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-bg-page/60 p-5"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center py-12 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-4 font-display text-base font-semibold text-text-primary">
                Empecemos por un pedido
              </p>
              <p className="mt-2 max-w-sm font-body text-sm text-text-secondary">
                {detailOrderId
                  ? "Haz una pregunta sobre el pedido que tienes abierto."
                  : "Escribe una pregunta que incluya un número como #1234 o el teléfono del cliente."}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <article
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 font-body text-sm leading-6 shadow-sm ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-accent-from to-accent-to text-bg-surface"
                      : "border border-border bg-bg-surface text-text-primary"
                  }`}
                >
                  {message.content}
                </article>
              </div>
            ))
          )}

          {isSending ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-bg-surface px-4 py-3 font-body text-sm text-text-secondary shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Revisando el pedido…
              </div>
            </div>
          ) : null}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-border bg-bg-surface p-4"
        >
          <label className="sr-only" htmlFor="asistente-pedido-mensaje">
            Pregunta sobre un pedido
          </label>
          <div className="flex items-end gap-3">
            <textarea
              id="asistente-pedido-mensaje"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              rows={2}
              placeholder={
                detailOrderId
                  ? "Ej. ¿Cuál es la guía?"
                  : "Ej. ¿Qué pasó con el pedido #1234?"
              }
              className="min-h-11 flex-1 resize-y rounded-xl border border-border bg-bg-page px-3 py-2 font-body text-sm text-text-primary outline-none placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--color-accent)] focus-visible:ring-3 focus-visible:ring-[var(--color-accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <Button
              type="submit"
              disabled={!draft.trim() || isSending}
              className="h-11 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 text-bg-surface hover:opacity-90"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Enviar</span>
              <span className="sr-only sm:hidden">Enviar pregunta</span>
            </Button>
          </div>
          <p className="mt-2 font-body text-xs text-text-secondary">
            Enter para enviar · Shift + Enter para una nueva línea
          </p>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
