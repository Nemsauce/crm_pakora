import { NextResponse, type NextRequest } from "next/server";

import {
  DropkillerAuthError,
  fetchDropkillerProducts,
  isEnabledDropkillerConfig,
  type DropkillerConfig,
  type DropkillerProductDailyRow,
} from "@/lib/dropkiller/fetchDropkillerProducts";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type SupabaseError = {
  message: string;
};

type UntypedSupabaseTable = {
  select: (columns: string) => Promise<{
    data: unknown[] | null;
    error: SupabaseError | null;
  }>;
  upsert: (
    rows: DropkillerProductDailyRow[],
    options: { onConflict: string },
  ) => Promise<{
    error: SupabaseError | null;
  }>;
};

type UntypedSupabaseClient = {
  from: (table: string) => UntypedSupabaseTable;
};

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(
    cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`,
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient() as unknown as UntypedSupabaseClient;
    const { data: configRows, error: configError } = await supabase
      .from("dropkiller_config")
      .select("*");

    if (configError) {
      return NextResponse.json(
        { error: "Failed to load Dropkiller config" },
        { status: 500 },
      );
    }

    const configs = normalizeConfigs(configRows).filter(
      isEnabledDropkillerConfig,
    );
    const capturedAt = new Date().toISOString().slice(0, 10);
    const results = await fetchDropkillerProducts(configs, capturedAt);
    const rows = results.flatMap((result) => result.products);

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("dropkiller_products_daily")
        .upsert(rows, { onConflict: "external_id,captured_at" });

      if (upsertError) {
        return NextResponse.json(
          { error: "Failed to store Dropkiller products" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      capturedAt,
      summary: results.map((result) => ({
        platform: result.platform,
        country: result.country,
        productsStored: result.products.length,
      })),
      totalProductsStored: rows.length,
    });
  } catch (error) {
    const errorMessage =
      error instanceof DropkillerAuthError
        ? error.message
        : "Failed to sync Dropkiller products";

    console.error(
      "Failed to sync Dropkiller products",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function normalizeConfigs(configRows: unknown[] | null): DropkillerConfig[] {
  if (!Array.isArray(configRows)) {
    return [];
  }

  return configRows
    .map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return null;
      }

      const record = row as Record<string, unknown>;

      if (
        typeof record.platform !== "string" ||
        typeof record.country_code !== "string"
      ) {
        return null;
      }

      const config: DropkillerConfig = {
        platform: record.platform,
        country_code: record.country_code,
      };

      if (typeof record.activo === "boolean") {
        config.activo = record.activo;
      }

      if (typeof record.enabled === "boolean") {
        config.enabled = record.enabled;
      }

      return config;
    })
    .filter((row): row is DropkillerConfig => Boolean(row));
}
