import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { dropiAuthWithToken } from "@/lib/dropi/dropiAuth";
import { dropiAuthMXWithToken } from "@/lib/dropi/dropiAuthMX";
import { createAdminClient } from "@/lib/supabase/admin";

export type DropiCountry = "CO" | "MX";

export type DropiSession = {
  token: string;
  expiresAt: string;
  source: "cache" | "fresh";
};

type DropiSessionRow = {
  token: string;
  expires_at: string;
};

type GetDropiSessionOptions = {
  forceRefresh?: boolean;
};

const EXPIRATION_SAFETY_MARGIN_MS = 5 * 60 * 1_000;

export class DropiSessionError extends Error {
  constructor(
    message: string,
    readonly kind: "cache" | "login" | "token",
  ) {
    super(message);
    this.name = "DropiSessionError";
  }
}

function getSessionsClient() {
  // dropi_sessions was migrated after the last generated database.types.ts.
  // Keep this narrow untyped cast local until those generated types are refreshed.
  return createAdminClient() as unknown as SupabaseClient;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const segments = token.split(".");

  if (segments.length !== 3) {
    throw new DropiSessionError("Dropi returned a non-JWT session token", "token");
  }

  try {
    const payload = JSON.parse(
      Buffer.from(segments[1], "base64url").toString("utf8"),
    ) as unknown;

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("JWT payload is not an object");
    }

    return payload as Record<string, unknown>;
  } catch (error) {
    if (error instanceof DropiSessionError) {
      throw error;
    }

    throw new DropiSessionError(
      "Dropi returned a session token with an invalid JWT payload",
      "token",
    );
  }
}

export function getDropiTokenExpiresAt(token: string) {
  const payload = decodeJwtPayload(token);
  const expiration = payload.exp;

  if (typeof expiration !== "number" || !Number.isFinite(expiration)) {
    throw new DropiSessionError(
      "Dropi session token did not include a valid exp claim",
      "token",
    );
  }

  const expiresAt = new Date(expiration * 1_000);

  if (!Number.isFinite(expiresAt.getTime())) {
    throw new DropiSessionError(
      "Dropi session token contained an invalid exp claim",
      "token",
    );
  }

  return expiresAt;
}

function readCachedSession(
  row: DropiSessionRow | null,
  now: number,
): DropiSession | null {
  if (!row?.token || !row.expires_at) {
    return null;
  }

  const storedExpiration = Date.parse(row.expires_at);

  if (
    !Number.isFinite(storedExpiration) ||
    storedExpiration <= now + EXPIRATION_SAFETY_MARGIN_MS
  ) {
    return null;
  }

  try {
    const tokenExpiration = getDropiTokenExpiresAt(row.token).getTime();

    if (tokenExpiration <= now + EXPIRATION_SAFETY_MARGIN_MS) {
      return null;
    }

    return {
      token: row.token,
      expiresAt: new Date(tokenExpiration).toISOString(),
      source: "cache",
    };
  } catch {
    return null;
  }
}

async function getCachedSession(pais: DropiCountry) {
  const supabase = getSessionsClient();
  const { data, error } = await supabase
    .from("dropi_sessions")
    .select("token, expires_at")
    .eq("pais", pais)
    .maybeSingle();

  if (error) {
    throw new DropiSessionError(
      `Could not read the cached Dropi ${pais} session: ${error.message}`,
      "cache",
    );
  }

  return readCachedSession(data as DropiSessionRow | null, Date.now());
}

async function loginFresh(pais: DropiCountry) {
  const authResult =
    pais === "CO"
      ? await dropiAuthWithToken()
      : await dropiAuthMXWithToken();

  if (!authResult.success) {
    throw new DropiSessionError(
      `Dropi ${pais} login failed: ${authResult.errorMessage}`,
      "login",
    );
  }

  const expiresAt = getDropiTokenExpiresAt(authResult.token);

  if (expiresAt.getTime() <= Date.now() + EXPIRATION_SAFETY_MARGIN_MS) {
    throw new DropiSessionError(
      `Dropi ${pais} returned a session token too close to expiration`,
      "token",
    );
  }

  const supabase = getSessionsClient();
  const refreshedAt = new Date().toISOString();
  const { error } = await supabase.from("dropi_sessions").upsert(
    {
      pais,
      token: authResult.token,
      expires_at: expiresAt.toISOString(),
      updated_at: refreshedAt,
    },
    { onConflict: "pais" },
  );

  if (error) {
    throw new DropiSessionError(
      `Could not cache the Dropi ${pais} session: ${error.message}`,
      "cache",
    );
  }

  console.info(`Dropi ${pais} session cache: refreshed`);

  return {
    token: authResult.token,
    expiresAt: expiresAt.toISOString(),
    source: "fresh",
  } satisfies DropiSession;
}

export async function getDropiSession(
  pais: DropiCountry,
  options: GetDropiSessionOptions = {},
): Promise<DropiSession> {
  if (!options.forceRefresh) {
    const cachedSession = await getCachedSession(pais);

    if (cachedSession) {
      console.info(`Dropi ${pais} session cache: hit`);
      return cachedSession;
    }
  }

  return loginFresh(pais);
}

export function isDropiAuthenticationError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return /\b(?:401|403)\b|unauthori[sz]ed|forbidden|token[^\n]*(?:invalid|expired)|(?:invalid|expired)[^\n]*token|jwt[^\n]*expired|session[^\n]*(?:invalid|expired)/i.test(
    message,
  );
}

export async function withDropiSessionRetry<T>(
  pais: DropiCountry,
  operation: (token: string) => Promise<T>,
): Promise<T> {
  const session = await getDropiSession(pais);

  try {
    return await operation(session.token);
  } catch (error) {
    if (session.source !== "cache" || !isDropiAuthenticationError(error)) {
      throw error;
    }

    console.warn(
      `Cached Dropi ${pais} session was rejected; refreshing and retrying once`,
    );
    const refreshedSession = await getDropiSession(pais, {
      forceRefresh: true,
    });

    return operation(refreshedSession.token);
  }
}
