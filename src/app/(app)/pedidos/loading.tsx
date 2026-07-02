function SkeletonCard() {
  return (
    <div className="min-h-56 rounded-lg border border-border bg-bg-base p-4">
      <div className="flex items-start gap-3">
        <div className="size-3.5 rounded-full bg-text-secondary motion-safe:animate-pulse" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-bg-surface motion-safe:animate-pulse" />
          <div className="h-3 w-28 rounded bg-bg-surface motion-safe:animate-pulse" />
        </div>
        <div className="h-6 w-20 rounded bg-bg-surface motion-safe:animate-pulse" />
      </div>
      <div className="mt-6 space-y-3">
        <div className="h-3 w-1/2 rounded bg-bg-surface motion-safe:animate-pulse" />
        <div className="h-4 w-full rounded bg-bg-surface motion-safe:animate-pulse" />
        <div className="h-4 w-4/5 rounded bg-bg-surface motion-safe:animate-pulse" />
      </div>
      <div className="mt-8 flex items-end justify-between border-t border-border pt-3">
        <div className="h-8 w-28 rounded bg-bg-surface motion-safe:animate-pulse" />
        <div className="h-8 w-24 rounded bg-bg-surface motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

export default function PedidosLoading() {
  return (
    <section className="min-h-screen px-6 py-6 sm:px-8">
      <div className="border-b border-border pb-4">
        <div className="h-3 w-16 rounded bg-bg-base motion-safe:animate-pulse" />
        <div className="mt-3 h-7 w-56 rounded bg-bg-base motion-safe:animate-pulse" />
      </div>
      <div className="mt-5 h-24 rounded-lg border border-border bg-bg-base motion-safe:animate-pulse" />
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </section>
  );
}
