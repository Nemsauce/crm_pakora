import { NextResponse } from "next/server";

type ExchangeRateResponse = {
  rates?: {
    COP?: number;
  };
  time_last_update_utc?: string;
};

const ERROR_MESSAGE = "No se pudo obtener la tasa de cambio";

export async function GET() {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/MXN", {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: ERROR_MESSAGE }, { status: 502 });
    }

    const data = (await response.json()) as ExchangeRateResponse;
    const rate = data.rates?.COP;

    if (!Number.isFinite(rate) || rate === undefined || rate <= 0) {
      return NextResponse.json({ error: ERROR_MESSAGE }, { status: 502 });
    }

    return NextResponse.json({
      rate,
      timestamp: data.time_last_update_utc ?? new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: ERROR_MESSAGE }, { status: 502 });
  }
}
