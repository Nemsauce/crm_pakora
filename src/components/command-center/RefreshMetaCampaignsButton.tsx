"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

export type RefreshMetaCampaignsResult =
  | { ok: true; message: string; partial?: boolean }
  | { ok: false; message: string };

type RefreshMetaCampaignsButtonProps = {
  refreshAction: () => Promise<RefreshMetaCampaignsResult>;
};

export function RefreshMetaCampaignsButton({
  refreshAction,
}: RefreshMetaCampaignsButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<RefreshMetaCampaignsResult | null>(null);

  function handleRefresh() {
    setResult(null);

    startTransition(async () => {
      try {
        const nextResult = await refreshAction();
        setResult(nextResult);

        if (nextResult.ok) {
          router.refresh();
        }
      } catch {
        setResult({
          ok: false,
          message: "No se pudieron actualizar las campañas. Intenta nuevamente.",
        });
      }
    });
  }

  return (
    <div className="flex max-w-full flex-col items-start gap-2 sm:items-end">
      <Button
        type="button"
        onClick={handleRefresh}
        disabled={isPending}
        className="h-10 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-5 font-body font-semibold text-[var(--color-on-accent)] shadow-md shadow-[var(--color-accent)]/20 hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <RefreshCw aria-hidden="true" />
        )}
        {isPending ? "Actualizando..." : "Actualizar"}
      </Button>

      {result ? (
        <p
          role={result.ok ? "status" : "alert"}
          className={`max-w-sm font-body text-xs ${
            result.ok
              ? result.partial
                ? "text-risk-medium"
                : "text-positive"
              : "text-negative"
          }`}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
