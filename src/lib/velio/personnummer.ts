/** Swedish personnummer, YYYYMMDD plus four digits. Luhn uses the 10-digit form. */

export function personDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 12);
}

export function luhnOk(ten: string) {
  let sum = 0;
  for (let i = 0; i < ten.length; i++) {
    let digit = Number(ten[i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

function realDate(yyyymmdd: string) {
  const year = Number(yyyymmdd.slice(0, 4));
  const month = Number(yyyymmdd.slice(4, 6));
  const day = Number(yyyymmdd.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validatePersonnummer(raw: string): { ok: true; digits: string } | { ok: false; message: string } {
  const digits = personDigits(raw);
  if (digits.length !== 12) return { ok: false, message: "Skriv personnummer som ÅÅÅÅMMDD-XXXX." };
  if (!realDate(digits.slice(0, 8))) return { ok: false, message: "Datumet i personnumret stämmer inte." };
  if (!luhnOk(digits.slice(2))) return { ok: false, message: "Kontrollsiffran stämmer inte." };
  return { ok: true, digits };
}

/** Last four digits are bullets when masked. The full number is never returned for display. */
export function formatPerson(digits: string, masked: boolean) {
  const value = personDigits(digits);
  const date = value.slice(0, 8);
  const rest = value.slice(8);
  if (!date) return "";
  if (!rest) return date;
  const tail = masked ? "••••".slice(0, rest.length) : rest;
  return `${date}-${tail}`;
}
