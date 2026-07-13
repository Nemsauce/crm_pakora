import "server-only";

const DROPI_API_BASE_URL = "https://api.dropi.co/api";
const IPIFY_URL = "https://api.ipify.org/?format=json";

const BROWSER_HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "es-419,es;q=0.8",
  "content-type": "application/json",
  origin: "https://app.dropi.co",
  referer: "https://app.dropi.co/",
  "sec-ch-ua": '"Chromium";v="148", "Brave";v="148", "Not/A)Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Linux"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
} as const;

type DropiAuthResult = {
  success: boolean;
  errorMessage?: string;
};

type DropiRequestResult =
  | { success: true; data: unknown }
  | { success: false; errorMessage: string };

type DropiLoginPayload = {
  email: string;
  password: string;
  white_brand_id: number;
  brand: string;
  ipAddress: string;
  otp: string | null;
  with_cdc: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string") {
    return readString(payload);
  }

  if (!isRecord(payload)) {
    return null;
  }

  for (const key of [
    "message",
    "errorMessage",
    "msg",
    "detail",
    "description",
    "reason",
  ]) {
    const message = readString(payload[key]);

    if (message) {
      return message;
    }
  }

  for (const key of ["error", "errors", "data"]) {
    const nested = payload[key];

    if (Array.isArray(nested)) {
      for (const entry of nested) {
        const message = extractErrorMessage(entry);

        if (message) {
          return message;
        }
      }
    } else {
      const message = extractErrorMessage(nested);

      if (message) {
        return message;
      }
    }
  }

  return null;
}

function hasExplicitFailure(payload: unknown): boolean {
  if (!isRecord(payload)) {
    return false;
  }

  if (payload.success === false || payload.ok === false || payload.status === false) {
    return true;
  }

  const error = payload.error;

  return Boolean(
    error === true ||
      (typeof error === "string" && error.trim()) ||
      (isRecord(error) && Object.keys(error).length > 0) ||
      (Array.isArray(error) && error.length > 0),
  );
}

function sanitizeErrorMessage(message: string, secretValues: string[]): string {
  let sanitized = message;

  for (const secret of secretValues) {
    if (secret) {
      sanitized = sanitized.replaceAll(secret, "[REDACTED]");
    }
  }

  sanitized = sanitized.replace(
    /\b(?:Bearer\s+)?eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gi,
    "[REDACTED]",
  );

  return sanitized.slice(0, 1_000);
}

async function readResponseBody(response: Response): Promise<unknown> {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

async function postToDropi(
  path: string,
  body: DropiLoginPayload | { token: string; code: string },
  authorization: string,
  secretValues: string[],
): Promise<DropiRequestResult> {
  try {
    const response = await fetch(`${DROPI_API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "x-authorization": authorization,
        "x-captcha-token": "",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const responseBody = await readResponseBody(response);

    if (!response.ok || hasExplicitFailure(responseBody)) {
      const dropiMessage =
        extractErrorMessage(responseBody) ??
        `Dropi request failed with HTTP ${response.status}`;

      return {
        success: false,
        errorMessage: sanitizeErrorMessage(dropiMessage, secretValues),
      };
    }

    return { success: true, data: responseBody };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Dropi request error";

    return {
      success: false,
      errorMessage: sanitizeErrorMessage(message, secretValues),
    };
  }
}

function getToken(payload: unknown): string | null {
  return isRecord(payload) ? readString(payload.token) : null;
}

function base32Decode(input: string): number[] {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalizedInput = input.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let index = 0; index < normalizedInput.length; index += 1) {
    value = (value << 5) | alphabet.indexOf(normalizedInput[index]);
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return output;
}

function sha1(buffer: number[]): number[] {
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const message = Array.from(buffer);
  const bitLength = message.length * 8;

  message.push(0x80);

  while (message.length % 64 !== 56) {
    message.push(0);
  }

  for (let index = 7; index >= 0; index -= 1) {
    message.push((bitLength / 2 ** (index * 8)) & 0xff);
  }

  for (let index = 0; index < message.length; index += 64) {
    const words: number[] = [];

    for (let wordIndex = 0; wordIndex < 16; wordIndex += 1) {
      words[wordIndex] =
        (message[index + wordIndex * 4] << 24) |
        (message[index + wordIndex * 4 + 1] << 16) |
        (message[index + wordIndex * 4 + 2] << 8) |
        message[index + wordIndex * 4 + 3];
    }

    for (let wordIndex = 16; wordIndex < 80; wordIndex += 1) {
      const word =
        words[wordIndex - 3] ^
        words[wordIndex - 8] ^
        words[wordIndex - 14] ^
        words[wordIndex - 16];
      words[wordIndex] = (word << 1) | (word >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let wordIndex = 0; wordIndex < 80; wordIndex += 1) {
      let f: number;
      let k: number;

      if (wordIndex < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (wordIndex < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (wordIndex < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const temporary =
        (((a << 5) | (a >>> 27)) + f + e + k + words[wordIndex]) >>> 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temporary;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const result: number[] = [];

  for (const hash of [h0, h1, h2, h3, h4]) {
    for (let index = 3; index >= 0; index -= 1) {
      result.push((hash >>> (index * 8)) & 0xff);
    }
  }

  return result;
}

function hmacSha1(key: number[], data: number[]): number[] {
  let normalizedKey = Array.from(key);

  if (normalizedKey.length > 64) {
    normalizedKey = sha1(normalizedKey);
  }

  while (normalizedKey.length < 64) {
    normalizedKey.push(0);
  }

  const innerPadding = normalizedKey.map((byte) => byte ^ 0x36);
  const outerPadding = normalizedKey.map((byte) => byte ^ 0x5c);

  return sha1([...outerPadding, ...sha1([...innerPadding, ...data])]);
}

function generateTotp(secret: string, offset = 0): string {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1_000);
  const timeStep = Math.floor(epoch / 30) + offset;
  const data = [
    0,
    0,
    0,
    0,
    (timeStep >>> 24) & 0xff,
    (timeStep >>> 16) & 0xff,
    (timeStep >>> 8) & 0xff,
    timeStep & 0xff,
  ];
  const hmac = hmacSha1(key, data);
  const dynamicOffset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[dynamicOffset] & 0x7f) << 24) |
      ((hmac[dynamicOffset + 1] & 0xff) << 16) |
      ((hmac[dynamicOffset + 2] & 0xff) << 8) |
      (hmac[dynamicOffset + 3] & 0xff)) %
    1_000_000;

  return String(code).padStart(6, "0");
}

function failure(step: string, errorMessage: string): DropiAuthResult {
  console.error(`${step}: failed - ${errorMessage}`);

  return { success: false, errorMessage };
}

export async function dropiAuth(): Promise<DropiAuthResult> {
  const email = process.env.DROPI_EMAIL;
  const password = process.env.DROPI_PASSWORD;
  const totpSecret = process.env.DROPI_TOTP_SECRET;

  if (!email || !password || !totpSecret) {
    return failure(
      "dropi configuration",
      "Missing DROPI_EMAIL, DROPI_PASSWORD, or DROPI_TOTP_SECRET",
    );
  }

  const baseSecrets = [password, totpSecret];
  let publicIp: string;

  try {
    const ipResponse = await fetch(IPIFY_URL, { cache: "no-store" });
    const ipPayload = (await ipResponse.json()) as unknown;
    const ip = isRecord(ipPayload) ? readString(ipPayload.ip) : null;

    if (!ipResponse.ok || !ip) {
      return failure("public IP lookup", "Could not obtain the public IP");
    }

    publicIp = ip;
    console.info("public IP lookup: ok");
  } catch {
    return failure("public IP lookup", "Could not obtain the public IP");
  }

  const loginPayload: DropiLoginPayload = {
    email,
    password,
    white_brand_id: 1,
    brand: "",
    ipAddress: publicIp,
    otp: null,
    with_cdc: false,
  };

  const firstBeforeLogin = await postToDropi(
    "/beforeLoginUnknownDevice",
    loginPayload,
    "Bearer undefined",
    baseSecrets,
  );

  if (!firstBeforeLogin.success) {
    return failure("login step 1", firstBeforeLogin.errorMessage);
  }

  console.info("login step 1: ok");

  const firstLogin = await postToDropi(
    "/login",
    loginPayload,
    "Bearer undefined",
    baseSecrets,
  );

  if (!firstLogin.success) {
    return failure("login step 2", firstLogin.errorMessage);
  }

  const temporaryToken = getToken(firstLogin.data);

  if (!temporaryToken) {
    return failure(
      "login step 2",
      sanitizeErrorMessage(
        extractErrorMessage(firstLogin.data) ??
          "Dropi did not return the temporary token",
        baseSecrets,
      ),
    );
  }

  console.info("login step 2: ok");

  // The live n8n workflow deliberately uses the previous 30-second time step.
  const totp = generateTotp(totpSecret, -1);
  const runtimeSecrets = [...baseSecrets, temporaryToken, totp];
  const verification = await postToDropi(
    "/auth/2fa/verify",
    { token: temporaryToken, code: totp },
    `Bearer ${temporaryToken}`,
    runtimeSecrets,
  );

  if (!verification.success) {
    return failure("2fa verify", verification.errorMessage);
  }

  console.info("2fa verify: ok");

  const secondBeforeLogin = await postToDropi(
    "/beforeLoginUnknownDevice",
    loginPayload,
    "Bearer undefined",
    runtimeSecrets,
  );

  if (!secondBeforeLogin.success) {
    return failure("before login 2", secondBeforeLogin.errorMessage);
  }

  console.info("before login 2: ok");

  const finalLogin = await postToDropi(
    "/login",
    { ...loginPayload, otp: totp },
    "Bearer undefined",
    runtimeSecrets,
  );

  if (!finalLogin.success) {
    return failure("final login", finalLogin.errorMessage);
  }

  const sessionToken = getToken(finalLogin.data);

  if (!sessionToken) {
    return failure(
      "final login",
      sanitizeErrorMessage(
        extractErrorMessage(finalLogin.data) ??
          "Dropi did not return the final session token",
        runtimeSecrets,
      ),
    );
  }

  console.info("final login: ok");

  return { success: true };
}
