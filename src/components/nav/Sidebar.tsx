"use client";

import { ClipboardList, LayoutDashboard, ListTodo, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type SidebarProps = {
  userEmail: string | null;
};

const navItems = [
  {
    label: "Pedidos",
    href: "/pedidos",
    icon: ClipboardList,
  },
  {
    label: "Tareas",
    href: "/tareas",
    icon: ListTodo,
  },
  {
    label: "Command Center",
    href: "/command-center",
    icon: LayoutDashboard,
  },
] as const;

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function PakoraLogoMark() {
  return (
    <svg
      className="h-8 w-8 shrink-0 drop-shadow-sm"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="pakora-logo-gradient"
          x1="8"
          y1="6"
          x2="32"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--color-accent-from)" />
          <stop offset="1" stopColor="var(--color-accent-to)" />
        </linearGradient>
      </defs>
      <path
        d="M20 6.25C24.1 6.25 27.2 9.05 27.2 12.75C27.2 16.45 24.1 20 20 20C15.9 20 12.8 16.45 12.8 12.75C12.8 9.05 15.9 6.25 20 6.25Z"
        fill="url(#pakora-logo-gradient)"
      />
      <path
        d="M33.75 20C33.75 24.1 30.95 27.2 27.25 27.2C23.55 27.2 20 24.1 20 20C20 15.9 23.55 12.8 27.25 12.8C30.95 12.8 33.75 15.9 33.75 20Z"
        fill="url(#pakora-logo-gradient)"
        opacity="0.9"
      />
      <path
        d="M20 33.75C15.9 33.75 12.8 30.95 12.8 27.25C12.8 23.55 15.9 20 20 20C24.1 20 27.2 23.55 27.2 27.25C27.2 30.95 24.1 33.75 20 33.75Z"
        fill="url(#pakora-logo-gradient)"
        opacity="0.78"
      />
      <path
        d="M6.25 20C6.25 15.9 9.05 12.8 12.75 12.8C16.45 12.8 20 15.9 20 20C20 24.1 16.45 27.2 12.75 27.2C9.05 27.2 6.25 24.1 6.25 20Z"
        fill="url(#pakora-logo-gradient)"
        opacity="0.88"
      />
      <circle cx="20" cy="20" r="3.8" fill="var(--color-bg-surface)" />
    </svg>
  );
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSigningOut(true);

    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" });

    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-full border-b border-border bg-bg-surface text-[var(--foreground)] lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex min-h-full w-full flex-col">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <PakoraLogoMark />
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold tracking-normal">
                CRM Pakora
              </p>
              <p className="mt-1 font-body text-xs text-[var(--muted-foreground)]">
                Torre de control COD
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isCurrentPath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-10 items-center gap-3 rounded-2xl px-3 font-body text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "border border-[var(--color-accent)]/15 bg-gradient-to-r from-accent-from/15 to-accent-to/25 font-semibold text-[var(--color-accent)] shadow-md shadow-[var(--color-accent)]/10 hover:from-accent-from/20 hover:to-accent-to/30 dark:border-[var(--color-accent)]/40 dark:from-accent-from/20 dark:to-accent-to/10 dark:shadow-lg dark:shadow-[var(--color-accent)]/25 dark:hover:from-accent-from/25 dark:hover:to-accent-to/15"
                    : "font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}

        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-2xl border border-border bg-bg-surface p-3 shadow-lg">
            <p className="font-body text-xs text-[var(--muted-foreground)]">Sesión</p>
            <p className="mt-1 truncate font-mono text-xs text-[var(--foreground)]">
              {userEmail ?? "Usuario activo"}
            </p>
            <form onSubmit={handleLogout} className="mt-3">
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={isSigningOut}
                className="h-8 w-full justify-start gap-2 rounded-lg border-border bg-bg-surface text-[var(--foreground)] hover:bg-bg-page hover:text-[var(--foreground)]"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {isSigningOut ? "Cerrando..." : "Cerrar sesión"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
