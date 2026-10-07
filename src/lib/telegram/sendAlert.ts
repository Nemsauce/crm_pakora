import "server-only";

const REQUEST_TIMEOUT_MS = 15_000;
/** Telegram rejects a sendMessage body over 4096 characters. */
export const TELEGRAM_MESSAGE_LIMIT = 4096;

/**
 * Sends one HTML message to the alert chat. Returns whether Telegram actually
 * accepted it, so a caller can keep a watermark unadvanced and retry later
 * instead of treating a failed send as delivered.
 *
 * The message must already be valid Telegram HTML: external text (campaign, ad
 * and product names) has to be escaped by the caller that interpolates it.
 */
export async function sendTelegramAlert(message: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    console.error(
      "[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured; alert not sent.",
    );
    return false;
  }

  if (!message.trim()) {
    console.error("[telegram] Refused to send an empty alert.");
    return false;
  }

  if (message.length > TELEGRAM_MESSAGE_LIMIT) {
    console.error(
      `[telegram] Alert is ${message.length} characters, over the ${TELEGRAM_MESSAGE_LIMIT} limit; alert not sent.`,
    );
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    const payload: unknown = await response.json().catch(() => null);
    const accepted =
      Boolean(payload) &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      (payload as Record<string, unknown>).ok === true;

    // Telegram can answer HTTP 200 with ok:false (bad HTML, blocked bot). Only
    // ok:true means the message reached the chat.
    if (!response.ok || !accepted) {
      const description =
        payload &&
        typeof payload === "object" &&
        typeof (payload as Record<string, unknown>).description === "string"
          ? (payload as Record<string, unknown>).description
          : "no description";

      // Log the status and Telegram's own description only. The request URL
      // embeds the bot token and must never reach the logs.
      console.error(
        `[telegram] sendMessage rejected with HTTP ${response.status}: ${String(description).slice(0, 300)}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      `[telegram] sendMessage could not be completed: ${error instanceof Error ? error.name : "unknown error"}`,
    );
    return false;
  }
}
