import Link from "next/link";

const tabs = [
  { label: "Colombia", href: "/costeos/co", active: true },
  { label: "México", href: "/costeos/mx", active: false },
] as const;

export default function CosteosColombiaPage() {
  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="border-b border-border pb-4">
        <p className="font-body text-xs uppercase text-text-secondary">
          COSTEOS
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Colombia
        </h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
          Calculadora operativa para validar margen antes de escalar producto.
        </p>
      </div>

      <nav className="mt-5 flex gap-2" aria-label="Países de costeos">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={`rounded-full px-4 py-2 font-body text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tab.active
                ? "bg-gradient-to-r from-accent-from to-accent-to font-semibold text-white shadow-md shadow-[var(--color-accent)]/20"
                : "border border-border bg-bg-surface font-medium text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mt-5 rounded-2xl border border-border bg-bg-surface p-6 shadow-lg">
        <p className="font-display text-lg font-semibold text-text-primary">
          Calculadora de costeos — en construcción
        </p>
        <p className="mt-2 font-body text-sm text-text-secondary">
          La calculadora real llega en el siguiente commit.
        </p>
      </div>
    </section>
  );
}
