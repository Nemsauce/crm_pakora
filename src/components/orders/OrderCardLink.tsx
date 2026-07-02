"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { Tables } from "@/lib/supabase/database.types";

import { OrderCard } from "./OrderCard";

type Order = Tables<"orders">;

type OrderCardLinkProps = {
  order: Order;
  selected: boolean;
};

export function OrderCardLink({ order, selected }: OrderCardLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggleDetail() {
    const params = new URLSearchParams(searchParams);

    if (selected) {
      params.delete("detalle");
    } else {
      params.set("detalle", String(order.id));
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleDetail();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className="cursor-pointer rounded-lg outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring"
      onClick={toggleDetail}
      onKeyDown={handleKeyDown}
    >
      <OrderCard order={order} selected={selected} />
    </div>
  );
}
