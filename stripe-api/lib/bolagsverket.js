/** Free Bolagsverket "värdefulla datamängder" lookup. Org number only; name search is not in this API. */

const TOKEN_URL = process.env.BOLAGSVERKET_TOKEN_URL || "https://portal.api.bolagsverket.se/oauth2/token";
const API_BASE = (process.env.BOLAGSVERKET_API_BASE || "https://gw.api.bolagsverket.se/vardefulla-datamangder/v1").replace(/\/$/, "");

let cached = { token: "", exp: 0 };

export function bolagsverketConfigured() {
  return Boolean(process.env.BOLAGSVERKET_CLIENT_ID && process.env.BOLAGSVERKET_CLIENT_SECRET);
}

export function orgDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

export function formatOrg(digits) {
  if (digits.length < 7) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

/** Luhn check used for Swedish organisation numbers. */
export function validOrg(digits) {
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

async function accessToken() {
  if (cached.token && Date.now() < cached.exp) return cached.token;
  const id = process.env.BOLAGSVERKET_CLIENT_ID || "";
  const secret = process.env.BOLAGSVERKET_CLIENT_SECRET || "";
  if (!id || !secret) return "";
  const body = new URLSearchParams({ grant_type: "client_credentials", scope: "vardefulla-datamangder:read" });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const error = new Error(data.error_description || data.error || "Bolagsverket nekade inloggningen");
    error.status = response.status === 401 ? 401 : 502;
    throw error;
  }
  cached = { token: data.access_token, exp: Date.now() + Math.max(30, Number(data.expires_in || 3600) - 60) * 1000 };
  return cached.token;
}

function companyFrom(org) {
  const names = org.organisationsnamn?.organisationsnamnLista || [];
  const official = names.find((item) => item.organisationsnamntyp?.kod === "FORETAGSNAMN") || names[0];
  const address = org.postadressOrganisation?.postadress || {};
  const identity = org.organisationsidentitet?.identitetsbeteckning || "";
  const digits = orgDigits(identity);
  if (!official?.namn || !digits) return null;
  if (org.avregistreradOrganisation?.avregistreringsdatum) return null;
  return {
    orgNumber: formatOrg(digits),
    name: String(official.namn).slice(0, 160),
    street: String(address.utdelningsadress || "").slice(0, 160),
    city: String(address.postort || "").slice(0, 80),
    postalCode: String(address.postnummer || "").replace(/\s/g, "").slice(0, 10),
    source: "bolagsverket",
  };
}

export async function lookupOrganisation(raw) {
  const digits = orgDigits(raw);
  if (!validOrg(digits)) return null;
  const token = await accessToken();
  if (!token) return null;
  const response = await fetch(`${API_BASE}/organisationer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identitetsbeteckning: digits }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.title || data.detail || "Bolagsverket svarade inte");
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }
  const org = (data.organisationer || [])[0];
  if (!org) return null;
  return companyFrom(org);
}
