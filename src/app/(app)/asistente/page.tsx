"use client";

import { Loader2, MessageCircle, Send } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
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

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [activeOrder, setActiveOrder] = useState<ActiveOrderSummary | null>(
    null,
  );
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draft.trim();

    if (!content || isSending) {
      return;
    }

    const history = messages.map(({ role, content: previousContent }) => ({
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
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="border-b border-border pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-body text-xs uppercase text-text-secondary">
              Operación interna
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Asistente de pedidos
            </h1>
            <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
              Consulta un pedido por número de orden o teléfono. El asistente
              usa su historial completo, tareas y conversación de WhatsApp.
            </p>
          </div>

          {activeOrder ? (
            <div className="inline-flex max-w-full items-center gap-2 self-start rounded-full border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 px-3 py-2 font-body text-xs font-semibold text-[var(--color-accent)]">
              <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                Pedido activo: {getActiveOrderLabel(activeOrder)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex min-h-[calc(100vh-17rem)] flex-col overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-lg">
        <div className="border-b border-border px-5 py-4">
          <p className="font-display text-base font-semibold text-text-primary">
            Conversación
          </p>
          <p className="mt-1 font-body text-sm text-text-secondary">
            El historial se conserva solo mientras esta página permanezca
            abierta.
          </p>
        </div>

        <div
          className="flex-1 space-y-4 overflow-y-auto bg-bg-page/60 p-5"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-4 font-display text-base font-semibold text-text-primary">
                Empecemos por un pedido
              </p>
              <p className="mt-2 max-w-sm font-body text-sm text-text-secondary">
                Escribe una pregunta que incluya un número como #1234 o el
                teléfono del cliente.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <article
                  className={`max-w-[min(42rem,88%)] whitespace-pre-wrap rounded-2xl px-4 py-3 font-body text-sm leading-6 shadow-sm ${
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
              placeholder="Ej. ¿Qué pasó con el pedido #1234?"
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
      </div>
    </section>
  );
}
