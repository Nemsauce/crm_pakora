import { BarChart3, DollarSign, Search } from "lucide-react";
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
] as const;

export default function CommandCenterPage() {
  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="border-b border-border pb-5">
        <p className="font-body text-xs uppercase text-text-secondary">
          Command Center
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Torre de control
        </h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
          Elige una vista para revisar la operación financiera, las métricas
          comerciales o nuevas oportunidades de producto.
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Link
              key={section.href}
              href={section.href}
              className="group rounded-2xl border border-border bg-bg-surface p-6 text-text-primary shadow-lg outline-none transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--color-accent)]/30 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-body text-xs uppercase text-text-secondary">
                    Command Center
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
