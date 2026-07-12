import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyShopifyWebhook(
  rawBody: string,
  hmacHeader: string | null,
  secret: string,
) {
  if (!hmacHeader || !secret) {
    return false;
  }

  const expectedBase64 = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  const expected = Buffer.from(expectedBase64, "base64");
  const received = Buffer.from(hmacHeader.trim(), "base64");

  if (received.length !== expected.length) {
    const maxLength = Math.max(received.length, expected.length);
    const paddedReceived = Buffer.alloc(maxLength);
    const paddedExpected = Buffer.alloc(maxLength);

    received.copy(paddedReceived);
    expected.copy(paddedExpected);
    timingSafeEqual(paddedReceived, paddedExpected);

    return false;
  }

  return timingSafeEqual(received, expected);
}
