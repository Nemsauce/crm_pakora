"use client";

import { Bell, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type TopBarProps = {
  userEmail: string | null;
};

function getInitials(userEmail: string | null) {
  const fallback = "US";

  if (!userEmail) {
    return fallback;
  }

  const localPart = userEmail.split("@")[0] ?? "";
  const letters = localPart.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2);

  return letters ? letters.toUpperCase() : fallback;
}

export function TopBar({ userEmail }: TopBarProps) {
  const router = useRouter();
  const initials = getInitials(userEmail);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
        </Button>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)]/10 font-display text-sm font-semibold text-[var(--color-accent)] outline-none ring-1 ring-[var(--color-accent)]/10 transition-colors hover:bg-[var(--color-accent)]/20 focus-visible:ring-2 focus-visible:ring-ring"
              title={userEmail ?? "Usuario activo"}
              aria-label={`Usuario ${userEmail ?? "activo"}`}
            >
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-56 rounded-2xl border border-border bg-bg-surface p-1 text-[var(--foreground)] shadow-md"
          >
            <DropdownMenuLabel className="truncate px-2 py-1.5 font-mono text-xs font-normal text-[var(--muted-foreground)]">
              {userEmail ?? "Usuario activo"}
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
