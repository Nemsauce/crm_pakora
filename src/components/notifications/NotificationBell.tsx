"use client";

import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/(app)/notifications-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

type Notification = Pick<
  Tables<"notifications">,
  | "id"
  | "titulo"
  | "mensaje"
  | "created_at"
  | "leida"
  | "order_id"
  | "task_id"
  | "tipo"
  | "user_id"
>;

function formatRelativeTime(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const diffMs = Date.now() - timestamp;
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSeconds < 60) {
    return "ahora";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffMinutes < 60) {
    return `hace ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `hace ${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 30) {
    return `hace ${diffDays} d`;
  }

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp));
}

function trimUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export function NotificationBell() {
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationsRef = useRef<Notification[]>([]);
  const baseDocumentTitleRef = useRef<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingNotificationId, setPendingNotificationId] = useState<
    number | null
  >(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const setNotificationList = useCallback(
    (updater: (current: Notification[]) => Notification[]) => {
      setNotifications((current) => {
        const next = updater(current);
        notificationsRef.current = next;
        return next;
      });
    },
    [],
  );

  const markLocalNotificationRead = useCallback(
    (notificationId: number) => {
      const existing = notificationsRef.current.find(
        (notification) => notification.id === notificationId,
      );

      setNotificationList((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, leida: true }
            : notification,
        ),
      );

      if (existing && !existing.leida) {
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    },
    [setNotificationList],
  );

  const markLocalAllRead = useCallback(() => {
    setNotificationList((current) =>
      current.map((notification) => ({ ...notification, leida: true })),
    );
    setUnreadCount(0);
  }, [setNotificationList]);

  useEffect(() => {
    const baseTitle = document.title.replace(/^\(\d+\)\s*/, "");
    baseDocumentTitleRef.current = baseTitle;

    return () => {
      document.title = baseTitle;
    };
  }, []);

  useEffect(() => {
    const baseTitle =
      baseDocumentTitleRef.current ??
      document.title.replace(/^\(\d+\)\s*/, "");

    baseDocumentTitleRef.current = baseTitle;
    document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle;
  }, [unreadCount]);

  useEffect(() => {
    let isActive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadNotifications() {
      setIsLoading(true);
      setError(null);

      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!isActive) {
        return;
      }

      if (userError || !userId) {
        setNotifications([]);
        notificationsRef.current = [];
        setUnreadCount(0);
        setError("No se pudieron cargar las notificaciones.");
        setIsLoading(false);
        return;
      }

      const activeUserId = userId;
      const [notificationsResult, unreadResult] = await Promise.all([
        supabase
          .from("notifications")
          .select(
            "id,titulo,mensaje,created_at,leida,order_id,task_id,tipo,user_id",
          )
          .eq("user_id", activeUserId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", activeUserId)
          .eq("leida", false),
      ]);

      if (!isActive) {
        return;
      }

      if (notificationsResult.error || unreadResult.error) {
        setError("No se pudieron cargar las notificaciones.");
        setIsLoading(false);
        return;
      }

      const initialNotifications =
        (notificationsResult.data ?? []) as Notification[];

      notificationsRef.current = initialNotifications;
      setNotifications(initialNotifications);
      setUnreadCount(unreadResult.count ?? 0);
      setIsLoading(false);

      async function syncUnreadCount() {
        const { count, error: countError } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", activeUserId)
          .eq("leida", false);

        if (!isActive || countError) {
          return;
        }

        setUnreadCount(count ?? 0);
      }

      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData.session?.access_token) {
        await supabase.realtime.setAuth(sessionData.session.access_token);
      }

      if (!isActive) {
        return;
      }

      channel = supabase
        .channel(`notifications:${activeUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${activeUserId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const inserted = payload.new as Notification;

              setNotificationList((current) => [
                inserted,
                ...current.filter(
                  (notification) => notification.id !== inserted.id,
                ),
              ].slice(0, 20));

              if (!inserted.leida) {
                setUnreadCount((current) => current + 1);
              }

              void syncUnreadCount();

              return;
            }

            if (payload.eventType === "UPDATE") {
              const updated = payload.new as Notification;
              const existing = notificationsRef.current.find(
                (notification) => notification.id === updated.id,
              );

              setNotificationList((current) =>
                current.map((notification) =>
                  notification.id === updated.id ? updated : notification,
                ),
              );

              if (existing && existing.leida !== updated.leida) {
                setUnreadCount((current) =>
                  updated.leida
                    ? Math.max(0, current - 1)
                    : current + 1,
                );
              }

              void syncUnreadCount();

              return;
            }

            if (payload.eventType === "DELETE") {
              const deleted = payload.old as Partial<Notification>;
              const existing = notificationsRef.current.find(
                (notification) => notification.id === deleted.id,
              );

              setNotificationList((current) =>
                current.filter(
                  (notification) => notification.id !== deleted.id,
                ),
              );

              if (existing && !existing.leida) {
                setUnreadCount((current) => Math.max(0, current - 1));
              }

              void syncUnreadCount();
            }
          },
        )
        .subscribe((status, err) => {
          console.log("[NotificationBell] realtime status:", status, err);
        });
    }

    void loadNotifications();

    return () => {
      isActive = false;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [setNotificationList, supabase]);

  async function handleMarkRead(notification: Notification) {
    if (notification.leida || pendingNotificationId === notification.id) {
      return;
    }

    setPendingNotificationId(notification.id);
    setError(null);

    const result = await markNotificationRead(notification.id);

    if (result.error) {
      setError(result.error);
    } else {
      markLocalNotificationRead(notification.id);
    }

    setPendingNotificationId(null);
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0 || isMarkingAll) {
      return;
    }

    setIsMarkingAll(true);
    setError(null);

    const result = await markAllNotificationsRead();

    if (result.error) {
      setError(result.error);
    } else {
      markLocalAllRead();
    }

    setIsMarkingAll(false);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]"
          aria-label={`Notificaciones${
            unreadCount > 0 ? `: ${unreadCount} sin leer` : ""
          }`}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-risk-high px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold leading-none text-primary-foreground tabular-nums ring-2 ring-[var(--color-bg-surface)]">
              {trimUnreadCount(unreadCount)}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-96 rounded-2xl border border-border bg-bg-surface p-1 text-[var(--foreground)] shadow-md"
      >
        <DropdownMenuLabel className="flex items-center justify-between gap-3 px-3 py-3 font-body font-normal">
          <div>
            <p className="font-display text-sm font-semibold text-[var(--foreground)]">
              Notificaciones
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              {unreadCount > 0
                ? `${unreadCount} sin leer`
                : "Todo al día"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={unreadCount === 0 || isMarkingAll}
            onClick={(event) => {
              event.preventDefault();
              void handleMarkAllRead();
            }}
            className="rounded-full px-3 text-xs text-[var(--muted-foreground)] hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)] disabled:opacity-40"
          >
            {isMarkingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Marcar todas
          </Button>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-border" />

        <div className="max-h-[min(28rem,calc(100vh-8rem))] overflow-y-auto p-1">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cargando
            </div>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-8 text-center font-body text-sm text-[var(--muted-foreground)]">
              No hay notificaciones recientes.
            </p>
          ) : (
            <div className="space-y-1">
              {notifications.map((notification) => {
                const isPending = pendingNotificationId === notification.id;

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      void handleMarkRead(notification);
                    }}
                    className="flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[var(--color-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        notification.leida
                          ? "bg-[var(--muted-foreground)]/30"
                          : "bg-risk-high"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate font-body text-sm ${
                          notification.leida
                            ? "font-medium text-[var(--foreground)]"
                            : "font-semibold text-[var(--foreground)]"
                        }`}
                      >
                        {notification.titulo}
                      </span>
                      {notification.mensaje ? (
                        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--muted-foreground)]">
                          {notification.mensaje}
                        </span>
                      ) : null}
                      <span className="mt-1 block font-mono text-[11px] tabular-nums text-[var(--muted-foreground)]">
                        {formatRelativeTime(notification.created_at)}
                      </span>
                    </span>
                    {isPending ? (
                      <Loader2
                        className="mt-1 h-4 w-4 shrink-0 animate-spin text-[var(--muted-foreground)]"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error ? (
          <>
            <DropdownMenuSeparator className="bg-border" />
            <p className="px-3 py-2 font-body text-xs text-risk-high">
              {error}
            </p>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
