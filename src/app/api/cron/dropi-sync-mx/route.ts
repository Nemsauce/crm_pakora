import { NextResponse, type NextRequest } from "next/server";

import { fetchDropiOrdersMX } from "@/lib/dropi/fetchDropiOrdersMX";
import {
  fetchDropiWalletMX,
  type DropiWalletMovementMX,
} from "@/lib/dropi/fetchDropiWalletMX";
import {
  syncDropiOrdersMX,
  type SyncDropiOrdersMXResult,
} from "@/lib/dropi/syncDropiOrdersMX";
import {
  DropiSessionError,
  withDropiSessionRetry,
} from "@/lib/dropi/getDropiSession";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 300;

type WalletMovementInsert =
  Database["public"]["Tables"]["wallet_movements"]["Insert"];

export type SyncDropiMXResult = SyncDropiOrdersMXResult & {
  walletMovementsFetched: number;
  walletMovementsStored: number;
};

const WALLET_UPSERT_MAX_ATTEMPTS = 3;
const WALLET_UPSERT_RETRY_DELAY_MS = 2_000;

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(
    cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`,
  );
}

function failureSummary(errorMessage: string): SyncDropiMXResult {
  return {
    ordersFromDropi: 0,
    ordersMatched: 0,
    ordersWithMissingHistory: 0,
    orderUpdateErrors: [errorMessage],
    walletMovementsFetched: 0,
    walletMovementsStored: 0,
  };
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function storeWalletMovements(
  walletMovements: DropiWalletMovementMX[],
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

export async function runDropiSyncMX(): Promise<SyncDropiMXResult> {
  const dropiOrders = await withDropiSessionRetry("MX", fetchDropiOrdersMX);
  const result = await syncDropiOrdersMX(dropiOrders);
  const walletMovements = await withDropiSessionRetry(
    "MX",
    fetchDropiWalletMX,
  );
  const walletMovementsStored = await storeWalletMovements(walletMovements);

  return {
    ...result,
    walletMovementsFetched: walletMovements.length,
    walletMovementsStored,
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runDropiSyncMX());
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown Dropi MX sync error";

    console.error("Dropi MX sync failed", errorMessage);

    return NextResponse.json(failureSummary(errorMessage), {
      status:
        error instanceof DropiSessionError && error.kind === "login" ? 502 : 500,
    });
  }
}
