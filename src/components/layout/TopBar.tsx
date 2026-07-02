import { Bell, Search } from "lucide-react";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";

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
  const initials = getInitials(userEmail);

  return (
    <header className="flex h-20 shrink-0 items-center justify-end border-b border-border bg-bg-surface px-6 sm:px-8">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]"
          aria-label="Buscar"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </Button>

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

        <div
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)]/10 font-display text-sm font-semibold text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/10"
          title={userEmail ?? "Usuario activo"}
          aria-label={`Usuario ${userEmail ?? "activo"}`}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
