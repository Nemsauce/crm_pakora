"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

export function RefreshFinanzasButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      onClick={handleRefresh}
      disabled={isPending}
      variant="outline"
      className="h-10 rounded-full border-border bg-bg-surface px-5 font-body font-semibold text-text-primary shadow-sm hover:bg-bg-page hover:text-text-primary disabled:opacity-60"
    >
      {isPending ? (
        <Loader2 aria-hidden="true" className="animate-spin" />
      ) : (
        <RefreshCw aria-hidden="true" />
      )}
      {isPending ? "Actualizando..." : "Actualizar vista"}
    </Button>
  );
}
