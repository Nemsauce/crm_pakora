import { BarChart3, DollarSign, Search, Users } from "lucide-react";
import Link from "next/link";

const sections = [
  {
    title: "Finanzas",
    description: "Ganancia neta y movimientos por categoría.",
    href: "/command-center/finanzas",
    icon: DollarSign,
  },
  {
    title: "Métricas",
    description: "Pedidos, estados y desempeño por producto.",
    href: "/command-center/metricas",
    icon: BarChart3,
  },
  {
    title: "Investigación",
    description: "Productos sugeridos para testear.",
    href: "/command-center/investigacion",
    icon: Search,
  },
  {
    title: "Productividad",
    description: "Rendimiento del equipo por tarea.",
    href: "/command-center/productividad",
    icon: Users,
  },
] as const;

export default function CommandCenterPage() {
  return (
    <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="border-b border-[var(--color-border-subtle)] pb-5">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
          Torre de control
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Vista general
        </h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
          Elige una vista para revisar la operación financiera, las métricas
          comerciales, la productividad del equipo o nuevas oportunidades de
          producto.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Link
              key={section.href}
              href={section.href}
              className="crm-tactile-card group rounded-2xl border border-transparent bg-[var(--color-bg-surface-elevated)] p-6 text-text-primary shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-body text-xs uppercase text-text-secondary">
                    Torre de control
                  </p>
                  <h2 className="mt-3 font-display text-xl font-semibold text-text-primary">
                    {section.title}
                  </h2>
                </div>
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-badge-nuevo-bg)] text-[var(--color-badge-nuevo)] ring-1 ring-[var(--color-badge-nuevo-bg)]"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <p className="mt-5 max-w-xl font-body text-sm text-text-secondary">
                {section.description}
              </p>
              <p className="mt-6 font-body text-sm font-semibold text-[var(--color-accent)]">
                Abrir {section.title}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
