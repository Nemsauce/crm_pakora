import { NextResponse, type NextRequest } from "next/server";

import {
  createDropkillerSessionToken,
  DropkillerAuthError,
  fetchDropkillerProducts,
  fetchProductSaturation,
  isEnabledDropkillerConfig,
  type DropkillerConfig,
} from "@/lib/dropkiller/fetchDropkillerProducts";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const FINALISTS_PER_COUNTRY = 10;
const SATURATION_DELAY_MS = 400;

type SweetSpotFinalist = {
  external_id: string | null;
  dropkiller_uuid: string | null;
  country_code: string | null;
  captured_at: string | null;
  es_sweet_spot: boolean | null;
};

type ProvidersCountUpdateFilter = PromiseLike<{
  error: { message: string } | null;
}> & {
  eq: (column: string, value: string) => ProvidersCountUpdateFilter;
};

type ProvidersCountTable = {
  update: (values: { providers_count: number }) => ProvidersCountUpdateFilter;
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
    const supabase = createAdminClient();
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
    const jwt =
      configs.length > 0 ? await createDropkillerSessionToken() : null;
    const results = await fetchDropkillerProducts(
      configs,
      capturedAt,
      jwt ?? undefined,
    );
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

    const saturation = jwt
      ? await resolveFinalistProviderCounts(supabase, jwt)
      : { finalists: 0, providersCountResolved: 0 };

    return NextResponse.json({
      capturedAt,
      summary: results.map((result) => ({
        platform: result.platform,
        country: result.country,
        productsStored: result.products.length,
      })),
      totalProductsStored: rows.length,
      saturation,
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

async function resolveFinalistProviderCounts(
  supabase: ReturnType<typeof createAdminClient>,
  jwt: string,
) {
  const { data, error } = await supabase.rpc(
    "dropkiller_sweet_spot_candidates",
  );

  if (error) {
    console.error(
      "Failed to load Dropkiller sweet-spot finalists",
      error.message,
    );

    return { finalists: 0, providersCountResolved: 0 };
  }

  const finalists = selectTopFinalists(
    (data ?? []) as unknown as SweetSpotFinalist[],
  );
  let providersCountResolved = 0;

  for (let index = 0; index < finalists.length; index += 1) {
    const finalist = finalists[index];

    if (
      !finalist.external_id ||
      !finalist.dropkiller_uuid ||
      !finalist.country_code ||
      !finalist.captured_at
    ) {
      console.warn("Skipping Dropkiller saturation lookup with missing data", {
        externalId: finalist.external_id,
        countryCode: finalist.country_code,
      });
      continue;
    }

    const providersCount = await fetchProductSaturation(
      jwt,
      finalist.dropkiller_uuid,
      finalist.country_code,
    );

    if (providersCount === null) {
      console.warn("Dropkiller saturation lookup failed", {
        externalId: finalist.external_id,
        countryCode: finalist.country_code,
      });
    } else {
      const table = supabase.from(
        "dropkiller_products_daily",
      ) as unknown as ProvidersCountTable;
      const { error: updateError } = await table
        .update({ providers_count: providersCount })
        .eq("external_id", finalist.external_id)
        .eq("captured_at", finalist.captured_at);

      if (updateError) {
        console.error("Failed to store Dropkiller providers_count", {
          externalId: finalist.external_id,
          capturedAt: finalist.captured_at,
          message: updateError.message,
        });
      } else {
        providersCountResolved += 1;
      }
    }

    if (index < finalists.length - 1) {
      await delay(SATURATION_DELAY_MS);
    }
  }

  return { finalists: finalists.length, providersCountResolved };
}

function selectTopFinalists(rows: SweetSpotFinalist[]) {
  const countryCounts = new Map<string, number>();
  const finalists: SweetSpotFinalist[] = [];

  for (const row of rows) {
    if (
      row.es_sweet_spot !== true ||
      (row.country_code !== "CO" && row.country_code !== "MX")
    ) {
      continue;
    }

    const count = countryCounts.get(row.country_code) ?? 0;

    if (count >= FINALISTS_PER_COUNTRY) {
      continue;
    }

    countryCounts.set(row.country_code, count + 1);
    finalists.push(row);
  }

  return finalists;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
