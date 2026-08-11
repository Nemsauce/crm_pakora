import type { CSSProperties } from "react";

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="crm-list-enter crm-shimmer min-h-56 rounded-2xl border border-border/30 bg-bg-surface p-4 shadow-sm"
      style={{ "--motion-stagger-index": Math.min(index, 8) } as CSSProperties}
    >
      <div className="flex items-start gap-3">
        <div className="size-3 rounded-full bg-border" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-bg-page" />
          <div className="h-3 w-28 rounded bg-bg-page" />
        </div>
        <div className="h-6 w-20 rounded-full bg-bg-page" />
      </div>
      <div className="mt-6 space-y-3">
        <div className="h-3 w-1/2 rounded bg-bg-page" />
        <div className="h-4 w-full rounded bg-bg-page" />
        <div className="h-4 w-4/5 rounded bg-bg-page" />
      </div>
      <div className="mt-8 flex items-end justify-between border-t border-border pt-3">
        <div className="h-8 w-28 rounded bg-bg-page" />
        <div className="h-8 w-24 rounded bg-bg-page" />
      </div>
    </div>
  );
}

export default function PedidosLoading() {
  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="border-b border-border pb-4">
        <div className="crm-shimmer h-3 w-16 rounded bg-bg-surface" />
        <div className="crm-shimmer mt-3 h-7 w-56 rounded bg-bg-surface" />
      </div>
      <div className="crm-shimmer mt-5 h-24 rounded-2xl border border-border/30 bg-bg-surface shadow-sm" />
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} index={index} />
        ))}
      </div>
    </section>
  );
}
