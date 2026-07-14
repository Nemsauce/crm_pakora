export function formatPhoneForWhatsApp(
  telefono: string,
  pais: "CO" | "MX",
): string {
  const digits = telefono.replace(/\D/g, "").replace(/^0+/, "");

  if (!digits) {
    return "";
  }

  if (pais === "CO") {
    return digits.startsWith("57") ? digits : `57${digits}`;
  }

  const localNumber =
    digits.length === 13 && digits.startsWith("521")
      ? digits.slice(3)
      : digits.length === 12 && digits.startsWith("52")
        ? digits.slice(2)
        : digits;

  if (localNumber.length !== 10) {
    console.warn(
      `Could not format MX WhatsApp phone: expected 10 national digits, received ${localNumber.length}`,
    );
    return "";
  }

  return `521${localNumber}`;
}
