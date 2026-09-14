import "server-only";

export type EditableCampaignStatus = "ACTIVE" | "PAUSED";

export class MetaCampaignStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaCampaignStatusError";
  }
}

function apiErrorMessage(code: unknown, httpStatus: number) {
  if (httpStatus === 429 || [4, 17, 32, 613, 80000, 80004].includes(Number(code))) {
    return "Meta alcanzó un límite de uso. Esperá unos minutos y volvé a intentar.";
  }
  if (code === 190 || httpStatus === 401) {
    return "El token de Meta venció o no es válido. Actualizalo antes de intentar nuevamente.";
  }
  if (code === 10 || code === 200 || code === 294 || httpStatus === 403) {
    return "Meta rechazó el cambio por permisos. Revisá ads_management y el acceso a la cuenta publicitaria.";
  }
  return "Meta rechazó la solicitud. Revisá el estado y los permisos de la campaña en Ads Manager.";
}

async function requestCampaign(
  url: string,
  token: string,
  status?: EditableCampaignStatus,
): Promise<Record<string, unknown>> {
  const unknownOutcome =
    "No se pudo confirmar el cambio con Meta. Verificá el estado en Ads Manager y sincronizá las campañas antes de reintentar.";
  let response: Response;
  let payload: unknown;

  try {
    response = await fetch(url, {
      method: status ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}` },
      body: status ? new URLSearchParams({ status }) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    payload = await response.json();
  } catch {
    // Never expose fetch errors, URLs, raw API messages, or credentials.
    throw new MetaCampaignStatusError(
      status ? unknownOutcome : "No se pudo consultar el estado actual en Meta. Volvé a intentar.",
    );
  }

  const body = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
  if (!response.ok || body?.error) {
    const error = body?.error as { code?: unknown } | undefined;
    throw new MetaCampaignStatusError(apiErrorMessage(error?.code, response.status));
  }
  if (!body || (status && body.success !== true)) {
    throw new MetaCampaignStatusError(
      status ? unknownOutcome : "Meta no devolvió un estado de campaña válido.",
    );
  }
  return body;
}

export async function updateCampaignStatus(
  campaignId: string,
  status: EditableCampaignStatus,
  adAccountId: string,
): Promise<void> {
  if (
    !/^\d+$/.test(campaignId) ||
    !/^(act_)?\d+$/.test(adAccountId) ||
    (status !== "ACTIVE" && status !== "PAUSED")
  ) {
    throw new MetaCampaignStatusError("La campaña o el estado solicitado no es válido.");
  }
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new MetaCampaignStatusError("META_ACCESS_TOKEN no está configurado en el servidor.");
  }

  const url = `https://graph.facebook.com/v21.0/${campaignId}`;
  const current = await requestCampaign(`${url}?fields=id,account_id,status`, token);
  if (current.id !== campaignId || current.account_id !== adAccountId.replace(/^act_/, "")) {
    throw new MetaCampaignStatusError("La campaña no corresponde a la cuenta publicitaria registrada.");
  }
  if (current.status !== "ACTIVE" && current.status !== "PAUSED") {
    throw new MetaCampaignStatusError(
      "Esta campaña no se puede pausar o reactivar desde el CRM. Revisá si está archivada o eliminada en Meta.",
    );
  }
  // Setting an explicit state is idempotent. Do not retry writes automatically.
  if (current.status !== status) {
    await requestCampaign(url, token, status);
  }
}
