import { NextResponse, type NextRequest } from "next/server";

import { fetchDropiOrdersCO } from "@/lib/dropi/fetchDropiOrdersCO";
import {
  fetchDropiWalletCO,
  type DropiWalletMovementCO,
} from "@/lib/dropi/fetchDropiWalletCO";
import {
  syncDropiOrdersCO,
  type SyncDropiOrdersCOResult,
} from "@/lib/dropi/syncDropiOrdersCO";
import {
  DropiSessionError,
  withDropiSessionRetry,
} from "@/lib/dropi/getDropiSession";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import {
  checkStaleOrders,
  type CheckStaleOrdersResult,
} from "@/lib/tasks/checkStaleOrders";

export const runtime = "nodejs";
export const maxDuration = 300;

type WalletMovementInsert =
  Database["public"]["Tables"]["wallet_movements"]["Insert"];

export type SyncDropiCOResult = SyncDropiOrdersCOResult & {
  walletMovementsFetched: number;
  walletMovementsStored: number;
  staleOrdersChecked: number;
  staleTasksCreated: number;
  staleOrderErrors: CheckStaleOrdersResult["errors"];
  staleOrdersError: string | null;
};

const WALLET_UPSERT_MAX_ATTEMPTS = 3;
const WALLET_UPSERT_RETRY_DELAY_MS = 2_000;

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(
    cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`,
  );
}

function failureSummary(errorMessage: string): SyncDropiCOResult {
  return {
    ordersFromDropi: 0,
    ordersMatched: 0,
    ordersWithMissingHistory: 0,
    orderUpdateErrors: [errorMessage],
    walletMovementsFetched: 0,
    walletMovementsStored: 0,
    staleOrdersChecked: 0,
    staleTasksCreated: 0,
    staleOrderErrors: [],
    staleOrdersError: null,
  };
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function storeWalletMovements(
  walletMovements: DropiWalletMovementCO[],
) {
  if (walletMovements.length === 0) {
    return 0;
  }

  const supabase = createAdminClient();

  for (
    let attempt = 1;
    attempt <= WALLET_UPSERT_MAX_ATTEMPTS;
    attempt += 1
  ) {
    const { error } = await supabase
      .from("wallet_movements")
      .upsert(walletMovements as WalletMovementInsert[], {
        onConflict: "pais,id_movimiento_dropi",
        ignoreDuplicates: false,
      });

    if (!error) {
      return walletMovements.length;
    }

    if (attempt === WALLET_UPSERT_MAX_ATTEMPTS) {
      throw error;
    }

    await delay(WALLET_UPSERT_RETRY_DELAY_MS);
  }

  return 0;
}

async function getStaleOrdersSummary(): Promise<
  Pick<
    SyncDropiCOResult,
    | "staleOrdersChecked"
    | "staleTasksCreated"
    | "staleOrderErrors"
    | "staleOrdersError"
  >
> {
  try {
    const result = await checkStaleOrders();

    return {
      staleOrdersChecked: result.processed,
      staleTasksCreated: result.tasksCreated,
      staleOrderErrors: result.errors,
      staleOrdersError: null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown stale-orders error";

    console.error("Failed to check stale orders during Dropi CO sync", error);

    return {
      staleOrdersChecked: 0,
      staleTasksCreated: 0,
      staleOrderErrors: [],
      staleOrdersError: errorMessage,
    };
  }
}

export async function runDropiSyncCO(): Promise<SyncDropiCOResult> {
  const dropiOrders = await withDropiSessionRetry("CO", fetchDropiOrdersCO);
  const result = await syncDropiOrdersCO(dropiOrders);
  const walletMovements = await withDropiSessionRetry(
    "CO",
    fetchDropiWalletCO,
  );
  const walletMovementsStored = await storeWalletMovements(walletMovements);
  const staleOrdersSummary = await getStaleOrdersSummary();

  return {
    ...result,
    walletMovementsFetched: walletMovements.length,
    walletMovementsStored,
    ...staleOrdersSummary,
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runDropiSyncCO());
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown Dropi CO sync error";

    console.error("Dropi CO sync failed", errorMessage);

    return NextResponse.json(failureSummary(errorMessage), {
      status:
        error instanceof DropiSessionError && error.kind === "login" ? 502 : 500,
    });
  }
}
