import { ClipboardList, LayoutDashboard, ListTodo, LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type SidebarProps = {
  userEmail: string | null;
};

async function logout() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });

  redirect("/login");
}

const disabledItems = [
  {
    label: "Tareas",
    icon: ListTodo,
  },
  {
    label: "Command Center",
    icon: LayoutDashboard,
  },
];

export function Sidebar({ userEmail }: SidebarProps) {
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
          <Link
            href="/pedidos"
            aria-current="page"
            className="flex h-10 items-center gap-3 rounded-lg border border-accent/10 bg-accent/10 px-3 font-body text-sm font-medium text-accent outline-none transition-colors hover:bg-accent/15 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            <span>Pedidos</span>
          </Link>

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
            <form action={logout} className="mt-3">
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-8 w-full justify-start gap-2 rounded-lg border-border bg-bg-surface text-text-primary hover:bg-bg-page hover:text-text-primary"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
