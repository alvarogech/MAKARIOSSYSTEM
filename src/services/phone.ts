/**
 * Formatação e validação de telefone brasileiro para exibição no dashboard
 * de inscrições. Função pura — nunca modifica o valor original armazenado,
 * só a apresentação.
 */
function normalizeDigits(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  return digits;
}

/** "(62) 99999-9999" ou "(62) 3333-3333". Formato não reconhecido: devolve o valor original, sem inventar. */
export function formatBrazilianPhone(phone: string): string {
  const digits = normalizeDigits(phone);

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return phone;
}

/** Celular com WhatsApp: DDD (2 dígitos) + 9 + 8 dígitos = 11 dígitos. */
export function isValidBrazilianMobile(phone: string): boolean {
  const digits = normalizeDigits(phone);
  return digits.length === 11 && digits[2] === "9";
}

/** DDD (2 dígitos) + 8 ou 9 dígitos de número — o mínimo para um link de WhatsApp fazer sentido. */
export function isValidBrazilianPhone(phone: string): boolean {
  const digits = normalizeDigits(phone);
  return digits.length === 10 || digits.length === 11;
}
