export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    },
  );

  if (!response.ok) {
    const responseText = await response.text();

    throw new Error(
      `Telegram sendMessage failed with ${response.status} ${response.statusText}: ${responseText.slice(0, 500)}`,
    );
  }
}
