import { paymentsApiBase } from "@/lib/stripe/config";

export type CompanyRecord = {
  orgNumber: string;
  name: string;
  street: string;
  city: string;
  postalCode?: string;
  fTax: "yes" | "no" | "unsure" | null;
  source: "bolagsverket" | "manual";
};

export type CompanySearch = {
  configured: boolean;
  nameSearch: boolean;
  results: Omit<CompanyRecord, "fTax">[];
  message: string;
};

export function orgDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function formatOrg(digits: string) {
  if (digits.length < 7) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

export function validOrg(digits: string) {
  if (!/^\d{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    let n = Number(digits[i]);
    if (i % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** Real companies from the API. An empty list means manual entry, never a fake register. */
export async function searchCompanies(query: string, signal?: AbortSignal): Promise<CompanySearch> {
  const base = paymentsApiBase();
  if (!base) {
    return { configured: false, nameSearch: false, results: [], message: "Vi hämtar företagsuppgifterna automatiskt." };
  }
  const response = await fetch(`${base}/api/companies/search?q=${encodeURIComponent(query)}`, { signal });
  const data = (await response.json().catch(() => ({}))) as Partial<CompanySearch>;
  if (!response.ok) {
    return { configured: true, nameSearch: false, results: [], message: "Vi hämtar företagsuppgifterna automatiskt." };
  }
  return {
    configured: Boolean(data.configured),
    nameSearch: Boolean(data.nameSearch),
    results: Array.isArray(data.results) ? data.results : [],
    message: data.message || "",
  };
}
