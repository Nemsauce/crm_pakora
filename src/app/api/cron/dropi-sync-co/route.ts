import { NextResponse, type NextRequest } from "next/server";

import { dropiAuthWithToken } from "@/lib/dropi/dropiAuth";
import { fetchDropiOrdersCO } from "@/lib/dropi/fetchDropiOrdersCO";
import {
  fetchDropiWalletCO,
  type DropiWalletMovementCO,
} from "@/lib/dropi/fetchDropiWalletCO";
import {
  syncDropiOrdersCO,
  type SyncDropiOrdersCOResult,
} from "@/lib/dropi/syncDropiOrdersCO";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 300;

type WalletMovementInsert =
  Database["public"]["Tables"]["wallet_movements"]["Insert"];

type SyncDropiCOResult = SyncDropiOrdersCOResult & {
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

function failureSummary(errorMessage: string): SyncDropiCOResult {
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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authResult = await dropiAuthWithToken();

  if (!authResult.success) {
    return NextResponse.json(
      failureSummary(`Dropi login failed: ${authResult.errorMessage}`),
      { status: 502 },
    );
  }

  try {
    const dropiOrders = await fetchDropiOrdersCO(authResult.token);
    const result = await syncDropiOrdersCO(dropiOrders);
    const walletMovements = await fetchDropiWalletCO(authResult.token);
    const walletMovementsStored =
      await storeWalletMovements(walletMovements);

    return NextResponse.json({
      ...result,
      walletMovementsFetched: walletMovements.length,
      walletMovementsStored,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown Dropi CO sync error";

    console.error("Dropi CO sync failed", errorMessage);

    return NextResponse.json(failureSummary(errorMessage), { status: 500 });
  }
}
