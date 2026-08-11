"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";

import type { Tables } from "@/lib/supabase/database.types";

import { OrderCard } from "./OrderCard";

type Order = Tables<"orders">;

type OrderCardLinkProps = {
  order: Order;
  selected: boolean;
  staggerIndex?: number;
};

export function OrderCardLink({
  order,
  selected,
  staggerIndex = 0,
}: OrderCardLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const animateEntrance = staggerIndex < 3;

  function toggleDetail() {
    const params = new URLSearchParams(searchParams);

    if (selected) {
      params.delete("detalle");
    } else {
      params.set("detalle", String(order.id));
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
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
      style={
        animateEntrance
          ? ({ "--motion-stagger-index": staggerIndex } as CSSProperties)
          : undefined
      }
      className={`${animateEntrance ? "crm-list-enter " : ""}cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      onClick={toggleDetail}
      onKeyDown={handleKeyDown}
    >
      <OrderCard order={order} selected={selected} />
    </div>
  );
}
