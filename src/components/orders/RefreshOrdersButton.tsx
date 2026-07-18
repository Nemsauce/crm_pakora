"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  triggerDropiSync,
  type TriggerDropiSyncResult,
} from "@/app/(app)/pedidos/actions";
import { Button } from "@/components/ui/button";

export function RefreshOrdersButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<TriggerDropiSyncResult | null>(null);

  function handleRefresh() {
    setResult(null);

    startTransition(async () => {
      try {
        const nextResult = await triggerDropiSync();
        setResult(nextResult);
        router.refresh();
      } catch {
        setResult({
          ok: false,
          message: "No se pudieron actualizar los pedidos. Intenta nuevamente.",
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
        className="h-10 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-5 font-body font-semibold text-bg-surface shadow-md shadow-[var(--color-accent)]/20 hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <RefreshCw aria-hidden="true" />
        )}
        {isPending ? "Actualizando..." : "Refrescar"}
      </Button>

      {result ? (
        <p
          role={result.ok ? "status" : "alert"}
          className={`max-w-sm font-body text-xs ${
            result.ok ? "text-positive" : "text-negative"
          }`}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
