"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Loader2,
  MessagesSquare,
  Send,
  Users,
  X,
} from "lucide-react";
import { Dialog } from "radix-ui";
import {
  createContext,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type UIEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  markAsRead,
  sendMessage,
  type InternalChatDatabase,
  type InternalMessage,
} from "@/app/(app)/chat-actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

type TeamMember = Pick<
  Tables<"profiles">,
  "id" | "nombre" | "email" | "titulo"
>;

type InternalChatContextValue = {
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

type UnreadCounts = Record<string, number>;

const DEFAULT_DRAWER_WIDTH = 400;
const MIN_DRAWER_WIDTH = 320;
const MAX_DRAWER_WIDTH = 640;
const DRAWER_WIDTH_STORAGE_KEY = "crm-pakora:internal-chat-drawer-width";
const AUTO_SCROLL_BOTTOM_THRESHOLD = 80;
const MAX_MESSAGE_LENGTH = 4_000;
const UNREAD_PAGE_SIZE = 1_000;
const UNREAD_RECONCILE_DELAY = 80;
const UNREAD_SYNC_ERROR = "No se pudieron actualizar los mensajes sin leer.";
const HISTORY_SYNC_ERROR = "No se pudo cargar todo el historial del chat.";
const InternalChatContext = createContext<InternalChatContextValue | null>(
  null,
);

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

function useInternalChatContext() {
  const context = useContext(InternalChatContext);

  if (!context) {
    throw new Error(
      "Internal chat components must be inside InternalChatProvider",
    );
  }

  return context;
}

function getMemberLabel(member: TeamMember) {
  return member.nombre?.trim() || member.email;
}

function getMemberInitials(member: TeamMember) {
  const label = getMemberLabel(member);
  const words = label.split(/\s+/).filter(Boolean);
  const initials =
    words.length > 1
      ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`
      : words[0]?.slice(0, 2);

  return initials ? initials.toUpperCase() : "US";
}

function trimUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function formatMessageTime(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  return new Intl.DateTimeFormat("es-CO", {
    ...(isToday
      ? {}
      : {
          day: "2-digit",
          month: "short",
        }),
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sortMessages(messages: InternalMessage[]) {
  return [...messages].sort((left, right) => {
    const timeDifference =
      Date.parse(left.created_at) - Date.parse(right.created_at);

    return timeDifference || left.id - right.id;
  });
}

function upsertMessage(
  messages: InternalMessage[],
  incomingMessage: InternalMessage,
) {
  const existingIndex = messages.findIndex(
    (message) => message.id === incomingMessage.id,
  );

  if (existingIndex === -1) {
    return sortMessages([...messages, incomingMessage]);
  }

  const nextMessages = [...messages];
  const existingMessage = messages[existingIndex];
  nextMessages[existingIndex] = {
    ...incomingMessage,
    leido: existingMessage.leido || incomingMessage.leido,
  };

  return sortMessages(nextMessages);
}

function isNearMessageListBottom(container: HTMLDivElement) {
  return (
    container.scrollHeight - container.scrollTop - container.clientHeight <=
    AUTO_SCROLL_BOTTOM_THRESHOLD
  );
}

export function InternalChatProvider({ children }: { children: ReactNode }) {
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
    <InternalChatContext.Provider
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
    </InternalChatContext.Provider>
  );
}

export function InternalChatPushLayout({ children }: { children: ReactNode }) {
  const { drawerWidth, isOpen, isResizing } = useInternalChatContext();

  return (
    <div
      className={
        isResizing
          ? "min-w-0 transition-none"
          : "min-w-0 transition-[margin-right] duration-[var(--motion-duration-drawer)] ease-out motion-reduce:transition-none"
      }
      style={{ marginRight: isOpen ? drawerWidth : 0 }}
    >
      {children}
    </div>
  );
}

export function InternalChatDrawer() {
  const {
    drawerWidth,
    isOpen,
    isResizing,
    setDrawerWidth,
    setIsResizing,
  } = useInternalChatContext();
  const supabase = useMemo(
    () =>
      createClient() as unknown as SupabaseClient<InternalChatDatabase>,
    [],
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible",
  );
  const resizeStateRef = useRef<ResizeState | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const scrollOnNextMessageRef = useRef(false);
  const previousConversationRef = useRef<string | null>(null);
  const previousMessageCountRef = useRef(0);
  const previousOpenRef = useRef(false);
  const markReadInFlightRef = useRef<Set<string>>(new Set());
  const markReadFailedCutoffRef = useRef<Map<string, number>>(new Map());
  const unreadSyncVersionRef = useRef(0);
  const reconcileUnreadRef = useRef<() => void>(() => undefined);
  const resizeBounds =
    typeof window === "undefined"
      ? { minWidth: MIN_DRAWER_WIDTH, maxWidth: MAX_DRAWER_WIDTH }
      : getDrawerWidthBounds(window.innerWidth);

  const setMessageList = useCallback(
    (updater: (current: InternalMessage[]) => InternalMessage[]) => {
      setMessages(updater);
    },
    [],
  );

  const selectedMember = useMemo(
    () =>
      teamMembers.find((member) => member.id === selectedMemberId) ?? null,
    [selectedMemberId, teamMembers],
  );

  const conversationMessages = useMemo(() => {
    if (!currentUserId || !selectedMemberId) {
      return [];
    }

    return messages.filter(
      (message) =>
        (message.remitente_id === currentUserId &&
          message.destinatario_id === selectedMemberId) ||
        (message.remitente_id === selectedMemberId &&
          message.destinatario_id === currentUserId),
    );
  }, [currentUserId, messages, selectedMemberId]);

  const totalUnread = useMemo(
    () =>
      Object.values(unreadCounts).reduce(
        (total, conversationCount) => total + conversationCount,
        0,
      ),
    [unreadCounts],
  );
  const visibleError = error ?? realtimeError;

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
    if (!isOpen) {
      markReadFailedCutoffRef.current.clear();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleVisibilityChange() {
      setIsDocumentVisible(document.visibilityState === "visible");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    let isActive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let unreadReconcileTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadInternalChat() {
      setIsLoading(true);
      setError(null);
      setRealtimeError(null);

      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!isActive) {
        return;
      }

      if (userError || !userId) {
        setCurrentUserId(null);
        setTeamMembers([]);
        setSelectedMemberId(null);
        setMessageList(() => []);
        setUnreadCounts({});
        setError("No se pudo cargar el chat interno.");
        setIsLoading(false);
        return;
      }

      const activeUserId = userId;
      setCurrentUserId(activeUserId);

      function fetchRecentMessages() {
        return supabase
          .from("internal_messages")
          .select(
            "id,remitente_id,destinatario_id,mensaje,leido,created_at",
          )
          .or(
            `remitente_id.eq.${activeUserId},destinatario_id.eq.${activeUserId}`,
          )
          .order("created_at", { ascending: false })
          .limit(500);
      }

      const [membersResult, messagesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,nombre,email,titulo")
          .eq("activo", true)
          .neq("id", activeUserId),
        fetchRecentMessages(),
      ]);

      if (!isActive) {
        return;
      }

      const activeMembers = ((membersResult.data ?? []) as TeamMember[]).sort(
        (left, right) =>
          getMemberLabel(left).localeCompare(getMemberLabel(right), "es"),
      );
      const initialMessages = sortMessages(
        (messagesResult.data ?? []) as InternalMessage[],
      );

      setTeamMembers(activeMembers);
      setSelectedMemberId((current) =>
        current && activeMembers.some((member) => member.id === current)
          ? current
          : (activeMembers[0]?.id ?? null),
      );
      setMessageList(() => initialMessages);

      if (membersResult.error || messagesResult.error) {
        setError(HISTORY_SYNC_ERROR);
      }

      const activeMemberIds = new Set(
        activeMembers.map((member) => member.id),
      );

      async function syncUnreadMessages() {
        const syncVersion = ++unreadSyncVersionRef.current;
        const unreadMessages: InternalMessage[] = [];
        let rangeStart = 0;

        while (true) {
          const { data, error: unreadError } = await supabase
            .from("internal_messages")
            .select(
              "id,remitente_id,destinatario_id,mensaje,leido,created_at",
            )
            .eq("destinatario_id", activeUserId)
            .eq("leido", false)
            .order("id", { ascending: true })
            .range(rangeStart, rangeStart + UNREAD_PAGE_SIZE - 1);

          if (
            !isActive ||
            syncVersion !== unreadSyncVersionRef.current
          ) {
            return;
          }

          if (unreadError) {
            setError(UNREAD_SYNC_ERROR);
            return;
          }

          const page = (data ?? []) as InternalMessage[];
          unreadMessages.push(...page);

          if (page.length < UNREAD_PAGE_SIZE) {
            break;
          }

          rangeStart += UNREAD_PAGE_SIZE;
        }

        const relevantUnreadMessages = unreadMessages.filter((message) =>
          activeMemberIds.has(message.remitente_id),
        );

        const nextCounts = Object.fromEntries(
          activeMembers.map((member) => [member.id, 0]),
        ) as UnreadCounts;

        for (const message of relevantUnreadMessages) {
          nextCounts[message.remitente_id] =
            (nextCounts[message.remitente_id] ?? 0) + 1;
        }

        setMessageList((current) =>
          relevantUnreadMessages.reduce(
            (nextMessages, message) =>
              upsertMessage(nextMessages, message),
            current,
          ),
        );
        setUnreadCounts(nextCounts);
        setError((current) =>
          current === UNREAD_SYNC_ERROR ? null : current,
        );
      }

      function scheduleUnreadReconciliation(
        delay = UNREAD_RECONCILE_DELAY,
      ) {
        if (unreadReconcileTimer !== null) {
          clearTimeout(unreadReconcileTimer);
        }

        unreadReconcileTimer = setTimeout(() => {
          unreadReconcileTimer = null;
          void syncUnreadMessages();
        }, delay);
      }

      reconcileUnreadRef.current = () => scheduleUnreadReconciliation(0);

      async function reconcileRecentMessages() {
        const result = await fetchRecentMessages();

        if (!isActive) {
          return;
        }

        if (result.error) {
          setError(HISTORY_SYNC_ERROR);
          return;
        }

        const recentMessages = (result.data ?? []) as InternalMessage[];

        setMessageList((current) =>
          recentMessages.reduce(
            (nextMessages, message) =>
              upsertMessage(nextMessages, message),
            current,
          ),
        );
        setError((current) =>
          current === HISTORY_SYNC_ERROR ? null : current,
        );
      }

      await syncUnreadMessages();

      if (!isActive) {
        return;
      }

      setIsLoading(false);

      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData.session?.access_token) {
        await supabase.realtime.setAuth(sessionData.session.access_token);
      }

      if (!isActive) {
        return;
      }

      function handleRealtimeChange(
        payload:
          | {
              eventType: "INSERT" | "UPDATE";
              new: Record<string, unknown>;
              old: Record<string, unknown>;
            }
          | {
              eventType: "DELETE";
              new: Record<string, unknown>;
              old: Record<string, unknown>;
            },
      ) {
        if (payload.eventType === "INSERT") {
          const inserted = payload.new as InternalMessage;

          setMessageList((current) => upsertMessage(current, inserted));

          if (
            inserted.destinatario_id === activeUserId &&
            !inserted.leido &&
            activeMemberIds.has(inserted.remitente_id)
          ) {
            setUnreadCounts((current) => ({
              ...current,
              [inserted.remitente_id]:
                (current[inserted.remitente_id] ?? 0) + 1,
            }));
          }

          scheduleUnreadReconciliation();
          return;
        }

        if (payload.eventType === "UPDATE") {
          const updated = payload.new as InternalMessage;

          setMessageList((current) =>
            current.some((message) => message.id === updated.id)
              ? upsertMessage(current, updated)
              : current,
          );
          scheduleUnreadReconciliation();
          return;
        }

        const deleted = payload.old as Partial<InternalMessage>;

        if (typeof deleted.id === "number") {
          setMessageList((current) =>
            current.filter((message) => message.id !== deleted.id),
          );
        }

        scheduleUnreadReconciliation();
      }

      channel = supabase
        .channel(`internal-messages:${activeUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "internal_messages",
            filter: `remitente_id=eq.${activeUserId}`,
          },
          handleRealtimeChange,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "internal_messages",
            filter: `destinatario_id=eq.${activeUserId}`,
          },
          handleRealtimeChange,
        )
        .subscribe((status, realtimeError) => {
          console.log(
            "[InternalChatDrawer] realtime status:",
            status,
            realtimeError,
          );

          if (status === "SUBSCRIBED") {
            setRealtimeError(null);
            void reconcileRecentMessages();
            scheduleUnreadReconciliation(0);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setRealtimeError(
              "La conexión en tiempo real se interrumpió. Reconectando…",
            );
          }
        });
    }

    void loadInternalChat();

    return () => {
      isActive = false;
      unreadSyncVersionRef.current += 1;
      reconcileUnreadRef.current = () => undefined;

      if (unreadReconcileTimer !== null) {
        clearTimeout(unreadReconcileTimer);
      }

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [setMessageList, supabase]);

  useEffect(() => {
    if (
      !isOpen ||
      !isDocumentVisible ||
      isLoading ||
      !selectedMemberId ||
      !currentUserId
    ) {
      return;
    }

    const unreadMessages = messages.filter(
      (message) =>
        message.remitente_id === selectedMemberId &&
        message.destinatario_id === currentUserId &&
        !message.leido,
    );
    const knownUnreadCount = unreadCounts[selectedMemberId] ?? 0;

    if (unreadMessages.length === 0) {
      if (knownUnreadCount > 0) {
        reconcileUnreadRef.current();
      }

      return;
    }

    const memberId = selectedMemberId;
    const throughMessageId = Math.max(
      ...unreadMessages.map((message) => message.id),
    );

    if (
      markReadInFlightRef.current.has(memberId) ||
      markReadFailedCutoffRef.current.get(memberId) === throughMessageId
    ) {
      return;
    }

    markReadInFlightRef.current.add(memberId);

    void markAsRead(memberId, throughMessageId)
      .then((result) => {
        if (result.error) {
          markReadFailedCutoffRef.current.set(memberId, throughMessageId);
          setError(result.error);
          return;
        }

        markReadFailedCutoffRef.current.delete(memberId);
        unreadSyncVersionRef.current += 1;
        const markedMessageIds = new Set(result.markedMessageIds);

        setMessageList((current) =>
          current.map((message) =>
            markedMessageIds.has(message.id) && !message.leido
              ? { ...message, leido: true }
              : message,
          ),
        );
        setUnreadCounts((current) => ({
          ...current,
          [memberId]: Math.max(
            0,
            (current[memberId] ?? 0) - markedMessageIds.size,
          ),
        }));
      })
      .catch(() => {
        markReadFailedCutoffRef.current.set(memberId, throughMessageId);
        setError("No se pudieron marcar los mensajes como leídos.");
      })
      .finally(() => {
        markReadInFlightRef.current.delete(memberId);
        reconcileUnreadRef.current();
      });
  }, [
    currentUserId,
    isDocumentVisible,
    isLoading,
    isOpen,
    messages,
    selectedMemberId,
    setMessageList,
    unreadCounts,
  ]);

  useEffect(() => {
    const conversationChanged =
      previousConversationRef.current !== selectedMemberId;
    const hasNewMessage =
      conversationMessages.length > previousMessageCountRef.current;
    const drawerJustOpened = isOpen && !previousOpenRef.current;

    previousConversationRef.current = selectedMemberId;
    previousMessageCountRef.current = conversationMessages.length;
    previousOpenRef.current = isOpen;

    if (!isOpen) {
      return;
    }

    const shouldScroll =
      drawerJustOpened ||
      conversationChanged ||
      (hasNewMessage &&
        (scrollOnNextMessageRef.current || shouldAutoScrollRef.current));
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
        behavior:
          prefersReducedMotion || drawerJustOpened || conversationChanged
            ? "auto"
            : "smooth",
      });
      shouldAutoScrollRef.current = true;
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [conversationMessages.length, isOpen, selectedMemberId]);

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
      resizeState.startWidth + resizeState.startX - event.clientX,
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
        resizeState.startWidth + resizeState.startX - event.clientX,
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
      nextWidth = drawerWidth + 16;
    } else if (event.key === "ArrowRight") {
      nextWidth = drawerWidth - 16;
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

    if (!content || !selectedMemberId || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);
    scrollOnNextMessageRef.current = true;

    try {
      const result = await sendMessage(selectedMemberId, content);
      const sentMessage = result.message;

      if (result.error || !sentMessage) {
        setError(result.error ?? "No se pudo enviar el mensaje.");
        return;
      }

      setMessageList((current) => upsertMessage(current, sentMessage));
      setDraft("");
    } catch {
      setError("No se pudo enviar el mensaje.");
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
            className={`fixed bottom-6 right-6 z-[calc(var(--z-index-assistant-drawer)+1)] h-14 w-14 rounded-full bg-gradient-to-r from-accent-from to-accent-to text-[var(--color-on-accent)] shadow-xl hover:opacity-90 focus-visible:ring-[var(--color-accent)]/30 ${
              isResizing
                ? "transition-none"
                : "transition-[right,opacity,box-shadow] duration-[var(--motion-duration-drawer)] motion-reduce:transition-none"
            }`}
            style={
              isOpen
                ? {
                    right: `min(calc(${drawerWidth}px + 1rem), calc(100vw - 4.5rem))`,
                  }
                : undefined
            }
            aria-label={
              isOpen
                ? "Cerrar chat interno"
                : `Abrir chat interno${
                    totalUnread > 0 ? `: ${totalUnread} sin leer` : ""
                  }`
            }
            aria-controls="internal-chat-drawer"
            aria-expanded={isOpen}
            title={isOpen ? "Cerrar chat interno" : "Abrir chat interno"}
          >
            <MessagesSquare className="h-6 w-6" aria-hidden="true" />
            {totalUnread > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-risk-high px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold leading-none text-[var(--color-on-danger)] tabular-nums ring-2 ring-[var(--color-bg-surface)]">
                {trimUnreadCount(totalUnread)}
              </span>
            ) : null}
          </Button>
        </Dialog.Trigger>
      </Dialog.Portal>

      <Dialog.Portal>
        <style>{`
          @keyframes crm-internal-chat-drawer-enter {
            from {
              opacity: 0;
              transform: translateX(24px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          .crm-internal-chat-drawer[data-state="open"] {
            animation: crm-internal-chat-drawer-enter var(--motion-duration-drawer) cubic-bezier(0.2, 0.8, 0.2, 1) both;
          }

          @media (prefers-reduced-motion: reduce) {
            .crm-internal-chat-drawer[data-state="open"] {
              animation: none;
            }
          }
        `}</style>
        <Dialog.Content
          id="internal-chat-drawer"
          className="crm-internal-chat-drawer fixed inset-y-0 right-0 z-[var(--z-index-assistant-drawer)] flex flex-col border-l border-[var(--color-border-subtle)] bg-bg-surface text-[var(--foreground)] shadow-xl outline-none"
          style={{ width: drawerWidth, maxWidth: "100vw" }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="border-b border-[var(--color-border-subtle)] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Dialog.Title className="font-display text-lg font-semibold text-[var(--foreground)]">
                  Chat interno
                </Dialog.Title>
                <Dialog.Description className="mt-1 font-body text-sm text-[var(--muted-foreground)]">
                  Conversaciones directas con tu equipo.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="rounded-lg border-border bg-bg-surface text-[var(--foreground)] hover:bg-bg-page hover:text-[var(--foreground)]"
                  aria-label="Cerrar chat interno"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Dialog.Close>
            </div>
          </div>

          {visibleError ? (
            <p
              role="alert"
              className="border-b border-[var(--color-border-subtle)] bg-risk-high-bg px-5 py-2 font-body text-xs text-risk-high"
            >
              {visibleError}
            </p>
          ) : null}

          <div className="flex min-h-0 flex-1">
            <aside className="flex w-32 shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-bg-page/60">
              <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-3 py-3">
                <Users
                  className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
                  aria-hidden="true"
                />
                <span className="truncate font-display text-xs font-semibold text-text-primary">
                  Equipo
                </span>
              </div>

              <div
                className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2"
                aria-label="Conversaciones del equipo"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 px-2 py-8 text-xs text-text-secondary">
                    <Loader2
                      className="crm-loader-orbit h-4 w-4"
                      aria-hidden="true"
                    />
                    <span className="sr-only">Cargando equipo</span>
                  </div>
                ) : teamMembers.length === 0 ? (
                  <p className="px-2 py-8 text-center font-body text-xs leading-5 text-text-secondary">
                    No hay otras personas activas.
                  </p>
                ) : (
                  teamMembers.map((member) => {
                    const memberUnreadCount = unreadCounts[member.id] ?? 0;
                    const isSelected = member.id === selectedMemberId;

                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setSelectedMemberId(member.id)}
                        className={`w-full rounded-xl border px-2 py-2.5 text-left outline-none transition-colors duration-[var(--motion-duration-hover-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30 motion-reduce:transition-none ${
                          isSelected
                            ? "border-[var(--color-border-selected)] bg-[var(--color-bg-selected)]"
                            : "border-transparent hover:bg-[var(--color-bg-hover)]"
                        }`}
                        aria-pressed={isSelected}
                        aria-label={`${getMemberLabel(member)}${
                          memberUnreadCount > 0
                            ? `, ${memberUnreadCount} mensajes sin leer`
                            : ""
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10 font-display text-[10px] font-semibold text-[var(--color-accent)]">
                            {getMemberInitials(member)}
                          </span>
                          {memberUnreadCount > 0 ? (
                            <span className="ml-auto min-w-5 rounded-full bg-risk-high px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold leading-none text-[var(--color-on-danger)] tabular-nums">
                              {trimUnreadCount(memberUnreadCount)}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`mt-2 block truncate font-body text-xs ${
                            memberUnreadCount > 0
                              ? "font-semibold text-text-primary"
                              : "font-medium text-text-primary"
                          }`}
                        >
                          {getMemberLabel(member)}
                        </span>
                        {member.titulo?.trim() ? (
                          <span className="mt-0.5 block truncate font-body text-[10px] text-text-secondary">
                            {member.titulo.trim()}
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            <section
              className="flex min-w-0 flex-1 flex-col"
              aria-label={
                selectedMember
                  ? `Conversación con ${getMemberLabel(selectedMember)}`
                  : "Conversación"
              }
            >
              {selectedMember ? (
                <>
                  <div className="flex min-h-14 items-center gap-3 border-b border-[var(--color-border-subtle)] px-4 py-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10 font-display text-xs font-semibold text-[var(--color-accent)]">
                      {getMemberInitials(selectedMember)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold text-text-primary">
                        {getMemberLabel(selectedMember)}
                      </p>
                      <p className="truncate font-body text-[11px] text-text-secondary">
                        Mensaje directo
                      </p>
                    </div>
                  </div>

                  <div
                    ref={messageListRef}
                    className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-bg-page/60 p-4"
                    aria-live="polite"
                    onScroll={handleMessageListScroll}
                  >
                    {conversationMessages.length === 0 ? (
                      <div className="flex min-h-full flex-col items-center justify-center py-10 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                          <MessagesSquare
                            className="h-5 w-5"
                            aria-hidden="true"
                          />
                        </div>
                        <p className="mt-4 font-display text-sm font-semibold text-text-primary">
                          Inicia la conversación
                        </p>
                        <p className="mt-2 max-w-xs font-body text-xs leading-5 text-text-secondary">
                          Envía un mensaje directo a {getMemberLabel(selectedMember)}.
                        </p>
                      </div>
                    ) : (
                      conversationMessages.map((message) => {
                        const isOwnMessage =
                          message.remitente_id === currentUserId;

                        return (
                          <div
                            key={message.id}
                            className={`flex ${
                              isOwnMessage ? "justify-end" : "justify-start"
                            }`}
                          >
                            <article
                              className={`max-w-[88%] rounded-2xl px-3 py-2.5 font-body text-sm leading-5 shadow-sm ${
                                isOwnMessage
                                  ? "bg-gradient-to-r from-accent-from to-accent-to text-[var(--color-on-accent)]"
                                  : "border border-[var(--color-border-subtle)] bg-bg-surface text-text-primary"
                              }`}
                              aria-label={
                                isOwnMessage
                                  ? "Mensaje enviado por ti"
                                  : `Mensaje de ${getMemberLabel(selectedMember)}`
                              }
                            >
                              <p className="whitespace-pre-wrap break-words">
                                {message.mensaje}
                              </p>
                              <time
                                dateTime={message.created_at}
                                className={`mt-1.5 block text-right font-mono text-[10px] tabular-nums ${
                                  isOwnMessage
                                    ? "text-[var(--color-on-accent)]"
                                    : "text-text-secondary"
                                }`}
                              >
                                {formatMessageTime(message.created_at)}
                              </time>
                            </article>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form
                    onSubmit={handleSubmit}
                    className="border-t border-[var(--color-border-subtle)] bg-bg-surface p-3"
                  >
                    <label className="sr-only" htmlFor="internal-chat-message">
                      Mensaje para {getMemberLabel(selectedMember)}
                    </label>
                    <div className="flex items-end gap-2">
                      <textarea
                        id="internal-chat-message"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isSending}
                        rows={2}
                        maxLength={MAX_MESSAGE_LENGTH}
                        placeholder="Escribe un mensaje…"
                        className="min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-border bg-bg-page px-3 py-2 font-body text-sm text-text-primary outline-none placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--color-accent)] focus-visible:ring-3 focus-visible:ring-[var(--color-accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <Button
                        type="submit"
                        size="icon"
                        disabled={!draft.trim() || isSending}
                        className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-r from-accent-from to-accent-to text-[var(--color-on-accent)] hover:opacity-90"
                        aria-label="Enviar mensaje"
                      >
                        {isSending ? (
                          <Loader2
                            className="crm-loader-orbit h-4 w-4"
                            aria-hidden="true"
                          />
                        ) : (
                          <Send className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                    <p className="mt-2 font-body text-[10px] text-text-secondary">
                      Enter para enviar · Shift + Enter para una nueva línea
                    </p>
                  </form>
                </>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="mt-4 font-display text-sm font-semibold text-text-primary">
                    Selecciona una persona
                  </p>
                  <p className="mt-2 max-w-xs font-body text-xs leading-5 text-text-secondary">
                    Elige a alguien del equipo para ver la conversación.
                  </p>
                </div>
              )}
            </section>
          </div>

          <div
            role="separator"
            aria-label="Cambiar ancho del chat interno"
            aria-orientation="vertical"
            aria-valuemin={resizeBounds.minWidth}
            aria-valuemax={resizeBounds.maxWidth}
            aria-valuenow={drawerWidth}
            aria-valuetext={`${drawerWidth} píxeles`}
            tabIndex={0}
            className="group absolute inset-y-0 left-0 z-10 w-3 -translate-x-1/2 cursor-col-resize touch-none outline-none"
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
