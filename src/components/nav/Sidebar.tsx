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
    <aside className="relative isolate flex h-full w-full overflow-hidden border-r border-border bg-bg-surface/45 text-text-primary shadow-2xl shadow-accent-from/20 backdrop-blur-3xl lg:w-72">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-bg-base/35" />
      <div className="sidebar-liquid-blob sidebar-liquid-blob--one pointer-events-none absolute -left-16 top-8 -z-10 h-44 w-44 bg-gradient-to-br from-accent-from/55 to-accent-to/35 blur-2xl" />
      <div className="sidebar-liquid-blob sidebar-liquid-blob--two pointer-events-none absolute -right-24 top-56 -z-10 h-60 w-60 bg-gradient-to-tr from-accent-to/45 to-accent-from/25 blur-3xl" />
      <div className="sidebar-liquid-blob sidebar-liquid-blob--three pointer-events-none absolute -bottom-20 left-10 -z-10 h-52 w-52 bg-gradient-to-br from-accent-from/40 to-accent-to/30 blur-2xl" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-bg-surface/50" />

      <div className="relative z-10 flex min-h-full w-full flex-col">
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
          className="sidebar-active-nav flex h-10 items-center gap-3 rounded-md border border-accent-to/70 bg-gradient-to-r from-accent-from via-accent-to to-accent-from bg-[length:220%_100%] px-3 font-body text-sm font-medium text-bg-base shadow-lg shadow-accent-from/25 outline-none transition-colors hover:text-bg-base focus-visible:ring-2 focus-visible:ring-ring"
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
              className="flex h-10 cursor-not-allowed items-center gap-3 rounded-md px-3 font-body text-sm text-text-secondary opacity-70"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="min-w-0 flex-1">{item.label}</span>
              <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase leading-none text-text-secondary">
                próximamente
              </span>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="rounded-md bg-bg-surface/80 p-3">
          <p className="font-body text-xs text-text-secondary">Sesión</p>
          <p className="mt-1 truncate font-mono text-xs text-text-primary">
            {userEmail ?? "Usuario activo"}
          </p>
          <form action={logout} className="mt-3">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-8 w-full justify-start gap-2 border-border bg-bg-surface/80 text-text-primary hover:bg-bg-surface hover:text-text-primary"
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
