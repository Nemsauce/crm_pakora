export function formatPhoneForWhatsApp(
  telefono: string,
  pais: "CO" | "MX",
): string {
  if (pais === "MX") {
    throw new Error("WhatsApp phone formatting for MX is not yet implemented");
  }

  const digits = telefono.replace(/\D/g, "").replace(/^0+/, "");

  if (!digits) {
    return "";
  }

  return digits.startsWith("57") ? digits : `57${digits}`;
}
