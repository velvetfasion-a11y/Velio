import { accountPublic, getAccountBySession, markIdVerified, updateAccount } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  let body: {
    passportNumber?: string;
    country?: string;
    fullName?: string;
    expiry?: string;
    activateBusiness?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }

  const passportNumber = (body.passportNumber ?? "").trim().toUpperCase();
  const country = (body.country ?? "").trim().toUpperCase();
  const fullName = (body.fullName ?? "").trim();
  const expiry = (body.expiry ?? "").trim();

  if (passportNumber.length < 5) {
    return Response.json({ error: "invalid_passport", message: "Ange passnummer." }, { status: 400, headers: noStore });
  }
  if (country.length < 2) {
    return Response.json({ error: "invalid_country", message: "Ange landskod (t.ex. SE)." }, { status: 400, headers: noStore });
  }
  if (fullName.length < 2) {
    return Response.json({ error: "invalid_name", message: "Ange namnet som står i passet." }, { status: 400, headers: noStore });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    return Response.json({ error: "invalid_expiry", message: "Ange giltighetsdatum som ÅÅÅÅ-MM-DD." }, { status: 400, headers: noStore });
  }
  if (new Date(expiry).getTime() < Date.now()) {
    return Response.json({ error: "expired_passport", message: "Passet har gått ut." }, { status: 400, headers: noStore });
  }

  let updated = await markIdVerified(account.id, "passport", {
    passportNumber,
    passportCountry: country,
  });

  if (fullName && fullName !== account.name) {
    updated = await updateAccount(account.id, {
      name: fullName,
      idVerified: true,
      idMethod: "passport",
      passportNumber,
      passportCountry: country,
    });
  }

  if (body.activateBusiness) {
    updated = await updateAccount(account.id, {
      accountMode: "business",
      idVerified: true,
      idMethod: "passport",
      passportNumber,
      passportCountry: country,
    });
  }

  return Response.json({ account: accountPublic(updated), verified: true }, { headers: noStore });
}
