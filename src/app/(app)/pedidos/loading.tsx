import type { CSSProperties } from "react";

function SkeletonRow({ index }: { index: number }) {
  return (
    <div
      className={`${index < 3 ? "crm-list-enter " : ""}crm-shimmer grid min-h-[var(--density-row-height-comfortable)] grid-cols-[minmax(0,1fr)_5rem] items-center gap-3 rounded-lg border border-transparent bg-[var(--color-bg-surface-elevated)] px-3 py-2 shadow-sm lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.1fr)_minmax(0,0.75fr)_minmax(0,0.85fr)]`}
      style={
        index < 3
          ? ({ "--motion-stagger-index": index } as CSSProperties)
          : undefined
      }
    >
      <div className="min-w-0 space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-[var(--color-bg-surface-subtle)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--color-bg-surface-subtle)]" />
      </div>
      <div className="h-6 w-16 justify-self-end rounded-full bg-[var(--color-bg-surface-subtle)] lg:justify-self-start" />
      <div className="hidden h-6 w-16 rounded-full bg-[var(--color-bg-surface-subtle)] lg:block" />
      <div className="hidden h-3.5 w-4/5 rounded bg-[var(--color-bg-surface-subtle)] lg:block" />
      <div className="hidden h-3.5 w-1/2 rounded bg-[var(--color-bg-surface-subtle)] lg:block" />
      <div className="hidden h-3.5 w-2/3 rounded bg-[var(--color-bg-surface-subtle)] lg:block" />
    </div>
  );
}

export default function PedidosLoading() {
  return (
    <section className="min-h-screen bg-[var(--color-bg-surface-base)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="border-b border-[var(--color-border-subtle)] pb-4">
        <div className="crm-shimmer h-3 w-16 rounded bg-[var(--color-bg-surface-elevated)]" />
        <div className="crm-shimmer mt-3 h-7 w-56 rounded bg-[var(--color-bg-surface-elevated)]" />
      </div>
      <div className="crm-shimmer mt-5 h-20 rounded-2xl border border-transparent bg-[var(--color-bg-surface-subtle)] shadow-sm" />
      <div className="mt-5 overflow-hidden rounded-xl bg-[var(--color-bg-surface-subtle)] p-1 shadow-sm">
        <div className="hidden min-h-[var(--density-row-height-compact)] items-center gap-3 px-3 lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.1fr)_minmax(0,0.75fr)_minmax(0,0.85fr)]">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="crm-shimmer h-2.5 w-2/3 rounded bg-[var(--color-bg-surface-elevated)]"
            />
          ))}
        </div>
        <div className="grid gap-1">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonRow key={index} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
