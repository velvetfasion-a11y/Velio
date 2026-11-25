/**
 * Company lookup seam. A Bolagsverket or Roaring client can replace
 * `lookupCompany` later. This build only has a local demoregister:
 * nothing is sent to a registry, and F-skatt is not a Skatteverket check.
 */

export type CompanyRecord = {
  orgNumber: string;
  name: string;
  street: string;
  city: string;
  fTax: "yes" | "no" | "unsure";
  source: "placeholder";
};

const samples: Record<string, Omit<CompanyRecord, "orgNumber" | "source">> = {
  "5566778899": { name: "Lind Städ AB", street: "Götgatan 12", city: "Stockholm", fTax: "yes" },
  "5599887766": { name: "Söder El & Service AB", street: "Folkungagatan 16", city: "Stockholm", fTax: "yes" },
};

export function orgDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function formatOrg(digits: string) {
  if (digits.length < 7) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

export async function lookupCompany(raw: string): Promise<CompanyRecord> {
  const digits = orgDigits(raw);
  if (digits.length !== 10) throw new Error("Organisationsnummer skrivs som 10 siffror.");
  await new Promise((resolve) => setTimeout(resolve, 420));
  const known = samples[digits];
  const tail = Number(digits.slice(-1));
  const fallback = {
    name: ["Nordhem Service AB", "Mälarens Hantverk AB", "Hammarby Tillsyn AB"][tail % 3],
    street: ["Hornsgatan 88", "Sveavägen 42", "Ringvägen 100"][tail % 3],
    city: "Stockholm",
    fTax: (tail % 5 === 0 ? "unsure" : "yes") as CompanyRecord["fTax"],
  };
  return { orgNumber: formatOrg(digits), source: "placeholder", ...(known ?? fallback) };
}
