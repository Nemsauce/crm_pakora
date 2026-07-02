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
] as const;

const disabledItems = [
  {
    label: "Command Center",
    icon: LayoutDashboard,
  },
] as const;

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
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
    <aside className="flex h-full w-full border-b border-border bg-bg-surface text-text-primary lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex min-h-full w-full flex-col">
        <div className="border-b border-border px-5 py-4">
          <p className="font-display text-lg font-semibold tracking-normal">
            CRM Pakora
          </p>
          <p className="mt-1 font-body text-xs text-text-secondary">
            Torre de control COD
          </p>
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
                className={`flex h-10 items-center gap-3 rounded-lg px-3 font-body text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "border border-accent/10 bg-accent/10 text-accent hover:bg-accent/15"
                    : "text-text-secondary hover:bg-bg-page hover:text-text-primary"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {disabledItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                aria-disabled="true"
                className="flex h-10 cursor-not-allowed items-center gap-3 rounded-lg px-3 font-body text-sm text-text-secondary"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="min-w-0 flex-1">{item.label}</span>
                <span className="rounded-full border border-border bg-bg-page px-2 py-0.5 font-mono text-[0.625rem] uppercase leading-none text-text-secondary">
                  próximamente
                </span>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-2xl border border-border bg-bg-surface p-3 shadow-lg">
            <p className="font-body text-xs text-text-secondary">Sesión</p>
            <p className="mt-1 truncate font-mono text-xs text-text-primary">
              {userEmail ?? "Usuario activo"}
            </p>
            <form onSubmit={handleLogout} className="mt-3">
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={isSigningOut}
                className="h-8 w-full justify-start gap-2 rounded-lg border-border bg-bg-surface text-text-primary hover:bg-bg-page hover:text-text-primary"
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
