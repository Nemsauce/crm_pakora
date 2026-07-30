"use client";

import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Dialog } from "radix-ui";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import {
  createContext,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type UIEvent,
  useContext,
  useEffect,
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

type AssistantContextValue = {
  isOpen: boolean;
  drawerWidth: number;
  setDrawerWidth: (drawerWidth: number) => void;
  isResizing: boolean;
  setIsResizing: (isResizing: boolean) => void;
};

type ResizeState = {
  pointerId: number;
  startX: number;
  startWidth: number;
  currentWidth: number;
  previousCursor: string;
  previousUserSelect: string;
};

const DEFAULT_DRAWER_WIDTH = 400;
const MIN_DRAWER_WIDTH = 320;
const MAX_DRAWER_WIDTH = 640;
const DRAWER_WIDTH_STORAGE_KEY = "crm-pakora:assistant-drawer-width";
const AUTO_SCROLL_BOTTOM_THRESHOLD = 80;
const AssistantContext = createContext<AssistantContextValue | null>(null);

const assistantMarkdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-3 last:mb-0">{children}</p>
  ),
  h1: ({ children }) => (
    <h1
      className="mb-2 mt-4 font-display text-base font-semibold text-text-primary first:mt-0"
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className="mb-2 mt-4 font-display text-sm font-semibold text-text-primary first:mt-0"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className="mb-2 mt-4 font-body text-sm font-semibold text-text-primary first:mt-0"
    >
      {children}
    </h3>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-text-primary">
      {children}
    </strong>
  ),
  ul: ({ children }) => (
    <ul
      className="my-3 list-disc space-y-1 pl-5 marker:text-[var(--color-accent)]"
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      className="my-3 list-decimal space-y-1 pl-5 marker:font-semibold marker:text-[var(--color-accent)]"
    >
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="pl-1">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="my-3 border-l-2 border-[var(--color-accent)]/50 pl-3 text-text-secondary"
    >
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      className="font-medium text-[var(--color-accent)] underline decoration-[var(--color-accent)]/50 underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code
      className="rounded bg-bg-page px-1 py-0.5 font-mono text-[0.8125rem]"
    >
      {children}
    </code>
  ),
};

function getDrawerWidthBounds(viewportWidth: number) {
  const safeViewportWidth = Math.max(0, Math.floor(viewportWidth));
  const minWidth = Math.min(MIN_DRAWER_WIDTH, safeViewportWidth);
  const maxWidth = Math.max(
    minWidth,
    Math.floor(Math.min(MAX_DRAWER_WIDTH, safeViewportWidth / 2)),
  );

  return { minWidth, maxWidth };
}

function clampDrawerWidth(drawerWidth: number, viewportWidth: number) {
  const { minWidth, maxWidth } = getDrawerWidthBounds(viewportWidth);

  return Math.round(Math.min(maxWidth, Math.max(minWidth, drawerWidth)));
}

function readStoredDrawerWidth() {
  try {
    const storedValue = window.localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsedValue = Number(storedValue);

    return Number.isFinite(parsedValue) && parsedValue > 0
      ? parsedValue
      : null;
  } catch {
    return null;
  }
}

function persistDrawerWidth(drawerWidth: number) {
  try {
    window.localStorage.setItem(
      DRAWER_WIDTH_STORAGE_KEY,
      String(Math.round(drawerWidth)),
    );
  } catch {
    // localStorage may be unavailable in privacy-restricted browser contexts.
  }
}

function getInitialDrawerWidth() {
  if (typeof window === "undefined") {
    return DEFAULT_DRAWER_WIDTH;
  }

  return clampDrawerWidth(
    readStoredDrawerWidth() ?? DEFAULT_DRAWER_WIDTH,
    window.innerWidth,
  );
}

function useAssistantContext() {
  const context = useContext(AssistantContext);

  if (!context) {
    throw new Error("Assistant components must be inside AssistantProvider");
  }

  return context;
}

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

function isNearMessageListBottom(container: HTMLDivElement) {
  return (
    container.scrollHeight - container.scrollTop - container.clientHeight <=
    AUTO_SCROLL_BOTTOM_THRESHOLD
  );
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(getInitialDrawerWidth);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    function handleWindowResize() {
      setDrawerWidth((currentWidth) =>
        clampDrawerWidth(currentWidth, window.innerWidth),
      );
    }

    window.addEventListener("resize", handleWindowResize);

    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  function handleOpenChange(open: boolean) {
    setIsOpen(open);

    if (!open) {
      setIsResizing(false);
    }
  }

  return (
    <AssistantContext.Provider
      value={{
        isOpen,
        drawerWidth,
        setDrawerWidth,
        isResizing,
        setIsResizing,
      }}
    >
      <Dialog.Root modal={false} open={isOpen} onOpenChange={handleOpenChange}>
        {children}
      </Dialog.Root>
    </AssistantContext.Provider>
  );
}

export function AssistantPushLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { drawerWidth, isOpen, isResizing } = useAssistantContext();

  return (
    <div
      className={
        isResizing
          ? "min-w-0 transition-none"
          : "min-w-0 transition-[margin-left] duration-200 ease-out motion-reduce:transition-none"
      }
      style={{ marginLeft: isOpen ? drawerWidth : 0 }}
    >
      {children}
    </div>
  );
}

export function AssistantDrawer() {
  const {
    drawerWidth,
    isOpen,
    isResizing,
    setDrawerWidth,
    setIsResizing,
  } = useAssistantContext();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [activeOrder, setActiveOrder] = useState<ActiveOrderSummary | null>(
    null,
  );
  const [isSending, setIsSending] = useState(false);
  const historyStartIndexRef = useRef(0);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const scrollOnNextMessageRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  const detailOrderId = getDetailOrderId(searchParams.get("detalle"));
  const resizeBounds =
    typeof window === "undefined"
      ? { minWidth: MIN_DRAWER_WIDTH, maxWidth: MAX_DRAWER_WIDTH }
      : getDrawerWidthBounds(window.innerWidth);

  useEffect(() => {
    function cleanupResizeInteraction() {
      const resizeState = resizeStateRef.current;

      if (resizeState) {
        resizeStateRef.current = null;
        document.body.style.cursor = resizeState.previousCursor;
        document.body.style.userSelect = resizeState.previousUserSelect;
      }
    }

    if (!isOpen) {
      cleanupResizeInteraction();
    }

    return cleanupResizeInteraction;
  }, [isOpen]);

  useEffect(() => {
    const hasNewMessage = messages.length > previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    if (!hasNewMessage) {
      return;
    }

    const shouldScroll =
      scrollOnNextMessageRef.current || shouldAutoScrollRef.current;
    scrollOnNextMessageRef.current = false;

    if (!shouldScroll) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const container = messageListRef.current;

      if (!container) {
        return;
      }

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      container.scrollTo({
        top: container.scrollHeight,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
      shouldAutoScrollRef.current = true;
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [messages.length]);

  function handleResizePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || resizeStateRef.current) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: drawerWidth,
      currentWidth: drawerWidth,
      previousCursor: document.body.style.cursor,
      previousUserSelect: document.body.style.userSelect,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    setIsResizing(true);
  }

  function handleResizePointerMove(event: PointerEvent<HTMLDivElement>) {
    const resizeState = resizeStateRef.current;

    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return;
    }

    const nextWidth = clampDrawerWidth(
      resizeState.startWidth + event.clientX - resizeState.startX,
      window.innerWidth,
    );

    resizeState.currentWidth = nextWidth;
    setDrawerWidth(nextWidth);
  }

  function finishResize(
    event: PointerEvent<HTMLDivElement>,
    useFinalPointerPosition: boolean,
  ) {
    const resizeState = resizeStateRef.current;

    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return;
    }

    if (useFinalPointerPosition) {
      resizeState.currentWidth = clampDrawerWidth(
        resizeState.startWidth + event.clientX - resizeState.startX,
        window.innerWidth,
      );
      setDrawerWidth(resizeState.currentWidth);
    }

    resizeStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    document.body.style.cursor = resizeState.previousCursor;
    document.body.style.userSelect = resizeState.previousUserSelect;
    persistDrawerWidth(resizeState.currentWidth);
    setIsResizing(false);
  }

  function handleLostPointerCapture(event: PointerEvent<HTMLDivElement>) {
    const resizeState = resizeStateRef.current;

    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return;
    }

    resizeStateRef.current = null;
    document.body.style.cursor = resizeState.previousCursor;
    document.body.style.userSelect = resizeState.previousUserSelect;
    persistDrawerWidth(resizeState.currentWidth);
    setIsResizing(false);
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const { minWidth, maxWidth } = getDrawerWidthBounds(window.innerWidth);
    let nextWidth: number | null = null;

    if (event.key === "ArrowLeft") {
      nextWidth = drawerWidth - 16;
    } else if (event.key === "ArrowRight") {
      nextWidth = drawerWidth + 16;
    } else if (event.key === "Home") {
      nextWidth = minWidth;
    } else if (event.key === "End") {
      nextWidth = maxWidth;
    }

    if (nextWidth === null) {
      return;
    }

    event.preventDefault();
    const clampedWidth = clampDrawerWidth(nextWidth, window.innerWidth);
    setDrawerWidth(clampedWidth);
    persistDrawerWidth(clampedWidth);
  }

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

    scrollOnNextMessageRef.current = true;
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

  function handleMessageListScroll(event: UIEvent<HTMLDivElement>) {
    shouldAutoScrollRef.current = isNearMessageListBottom(event.currentTarget);
  }

  return (
    <>
      <Dialog.Portal forceMount>
        <Dialog.Trigger asChild>
          <Button
            type="button"
            size="icon"
            className={`fixed bottom-6 left-6 z-[100] h-14 w-14 rounded-full bg-gradient-to-r from-accent-from to-accent-to text-bg-surface shadow-xl hover:opacity-90 focus-visible:ring-[var(--color-accent)]/30 ${
              isResizing
                ? "transition-none"
                : "transition-[left,opacity,box-shadow] duration-200 motion-reduce:transition-none"
            }`}
            style={
              isOpen
                ? {
                    left: `min(calc(${drawerWidth}px + 1rem), calc(100vw - 4.5rem))`,
                  }
                : undefined
            }
            aria-label={
              isOpen ? "Cerrar asistente" : "Abrir asistente de pedidos"
            }
            aria-controls="assistant-drawer"
            aria-expanded={isOpen}
            title={
              isOpen ? "Cerrar asistente" : "Abrir asistente de pedidos"
            }
          >
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
          </Button>
        </Dialog.Trigger>
      </Dialog.Portal>

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
          className="crm-assistant-drawer fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-bg-surface text-[var(--foreground)] shadow-xl outline-none"
          style={{ width: drawerWidth, maxWidth: "100vw" }}
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
          ref={messageListRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-bg-page/60 p-5"
          aria-live="polite"
          onScroll={handleMessageListScroll}
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
                  className={`max-w-[88%] rounded-2xl px-4 py-3 font-body text-sm leading-6 shadow-sm ${
                    message.role === "user"
                      ? "whitespace-pre-wrap bg-gradient-to-r from-accent-from to-accent-to text-bg-surface"
                      : "border border-border bg-bg-surface text-text-primary"
                  }`}
                >
                  {message.role === "user" ? (
                    message.content
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkBreaks]}
                      components={assistantMarkdownComponents}
                    >
                      {message.content}
                    </ReactMarkdown>
                  )}
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

          <div
            role="separator"
            aria-label="Cambiar ancho del asistente"
            aria-orientation="vertical"
            aria-valuemin={resizeBounds.minWidth}
            aria-valuemax={resizeBounds.maxWidth}
            aria-valuenow={drawerWidth}
            aria-valuetext={`${drawerWidth} píxeles`}
            tabIndex={0}
            className="group absolute inset-y-0 right-0 z-10 w-3 translate-x-1/2 cursor-col-resize touch-none outline-none"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={(event) => finishResize(event, true)}
            onPointerCancel={(event) => finishResize(event, false)}
            onLostPointerCapture={handleLostPointerCapture}
            onKeyDown={handleResizeKeyDown}
          >
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:w-0.5 group-hover:bg-[var(--color-accent)] group-focus-visible:w-0.5 group-focus-visible:bg-[var(--color-accent)]" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </>
  );
}
