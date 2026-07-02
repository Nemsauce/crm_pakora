"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const rangeOptions = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
] as const;

type DateRangeSelectorProps = {
  currentRange: string;
};

export function DateRangeSelector({ currentRange }: DateRangeSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateRange(range: string) {
    const params = new URLSearchParams(searchParams);
    params.set("range", range);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      className="inline-flex rounded-full border border-border bg-bg-surface p-1 shadow-lg"
      aria-label="Rango de fechas"
    >
      {rangeOptions.map((option) => {
        const isActive = option.value === currentRange;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            className={`h-9 rounded-full px-4 font-body text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
              isActive
                ? "bg-accent/10 text-accent"
                : "text-text-secondary hover:bg-bg-page hover:text-text-primary"
            }`}
            onClick={() => updateRange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
