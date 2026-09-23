/**
 * Normalização de telefone para link do WhatsApp (doc: dashboard de
 * inscrições). Função pura — o telefone já chega ao banco só com dígitos
 * (ver enrollmentRequestSchema), sempre DDD + número, sem código do país.
 */
export function buildWhatsAppLink(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  // Remove um zero de tronco isolado antes do DDD (ex.: "0" + "62..."),
  // nunca confundir com um DDD que comece com 0 (não existe no Brasil).
  if (digits.length === 12 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Já vem com código do país (55 + DDD de 2 dígitos + 8 ou 9 dígitos).
  const alreadyHasCountryCode =
    digits.startsWith("55") && (digits.length === 12 || digits.length === 13);

  const withCountryCode = alreadyHasCountryCode ? digits : `55${digits}`;

  return `https://wa.me/${withCountryCode}`;
}
