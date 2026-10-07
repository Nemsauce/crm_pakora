import "server-only";

export const TELEGRAM_MESSAGE_LIMIT = 4096;

export async function sendTelegramAlert(
  message: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    console.error("Telegram alert requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID");
    return false;
  }
  if (!message || message.length > TELEGRAM_MESSAGE_LIMIT) {
    console.error("Telegram alert message is empty or exceeds the message limit");
    return false;
  }

  try {
    const timeout = AbortSignal.timeout(30_000);
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
        cache: "no-store",
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      },
    );
    const body: unknown = await response.json();
    if (response.ok && body !== null && typeof body === "object" &&
      "ok" in body && body.ok === true) {
      return true;
    }
    // Neither Telegram's response nor raw fetch errors are safe to log: they
    // can include the URL containing the bot token.
    console.error(`Telegram rejected the alert (HTTP ${response.status})`);
  } catch {
    console.error("Telegram alert request failed or timed out");
  }
  return false;
}
