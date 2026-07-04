"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { createClient } from "@/lib/supabase/client";

type TopBarProps = {
  profile: TopBarProfile;
};

export type TopBarProfile = {
  email: string | null;
  nombre: string | null;
  titulo: string | null;
  role: string | null;
  telegram_chat_id: string | null;
};

function getPrimaryLabel(profile: TopBarProfile) {
  return profile.nombre?.trim() || profile.email || "Usuario activo";
}

function getInitials(profile: TopBarProfile) {
  const fallback = "US";
  const name = profile.nombre?.trim();

  if (name) {
    const nameParts = name.split(/\s+/).filter(Boolean);
    const letters =
      nameParts.length > 1
        ? `${nameParts[0]?.[0] ?? ""}${nameParts[1]?.[0] ?? ""}`
        : nameParts[0]?.slice(0, 2);

    return letters ? letters.toUpperCase() : fallback;
  }

  if (!profile.email) {
    return fallback;
  }

  const localPart = profile.email.split("@")[0] ?? "";
  const letters = localPart.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2);

  return letters ? letters.toUpperCase() : fallback;
}

function formatRoleLabel(role: string | null) {
  if (!role) {
    return "Sin rol";
  }

  return role
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function TopBar({ profile }: TopBarProps) {
  const router = useRouter();
  const initials = getInitials(profile);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const primaryLabel = getPrimaryLabel(profile);
  const titulo = profile.titulo?.trim();
  const showEmailLine = Boolean(profile.nombre?.trim() && profile.email);
  const telegramLinked = profile.telegram_chat_id !== null;

  async function handleLogout() {
    setIsSigningOut(true);

    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" });

    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex h-20 shrink-0 items-center justify-end border-b border-border bg-bg-surface px-6 sm:px-8">
      <div className="flex items-center gap-2">
        <NotificationBell />

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)]/10 font-display text-sm font-semibold text-[var(--color-accent)] outline-none ring-1 ring-[var(--color-accent)]/10 transition-colors hover:bg-[var(--color-accent)]/20 focus-visible:ring-2 focus-visible:ring-ring"
              title={primaryLabel}
              aria-label={`Usuario ${primaryLabel}`}
            >
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-72 rounded-2xl border border-border bg-bg-surface p-1 text-[var(--foreground)] shadow-md"
          >
            <DropdownMenuLabel className="space-y-3 px-3 py-3 font-body font-normal">
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold text-[var(--foreground)]">
                  {primaryLabel}
                </p>
                {titulo ? (
                  <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                    {titulo}
                  </p>
                ) : null}
                {showEmailLine ? (
                  <p className="mt-1 truncate font-mono text-[11px] text-[var(--muted-foreground)]">
                    {profile.email}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--color-accent)]/10 px-2.5 py-1 font-body text-xs font-semibold text-[var(--color-accent)]">
                  {formatRoleLabel(profile.role)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <span
                  className={`h-2 w-2 rounded-full ${
                    telegramLinked
                      ? "bg-risk-low"
                      : "bg-[var(--muted-foreground)]/40"
                  }`}
                  aria-hidden="true"
                />
                <span>Telegram</span>
                <span className="font-medium text-[var(--foreground)]">
                  {telegramLinked ? "Conectado" : "No vinculado"}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              disabled={isSigningOut}
              onSelect={(event) => {
                event.preventDefault();
                void handleLogout();
              }}
              className="gap-2 rounded-lg px-2 py-1.5 font-body text-sm text-[var(--foreground)] focus:bg-[var(--color-accent)]/10 focus:text-[var(--color-accent)]"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {isSigningOut ? "Cerrando..." : "Cerrar sesión"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
