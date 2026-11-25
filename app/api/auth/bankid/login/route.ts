export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

/**
 * BankID login is completed by the Idura callback (or the verified BankID
 * collect route). This endpoint used to accept a name and personnummer from
 * the client and create a session. That is closed so a personnummer never
 * becomes an identity without a verified id_token.
 */
export async function POST() {
  return Response.json(
    {
      error: "unverified_bankid",
      message: "BankID-inloggning verifieras hos Idura. Personnummer tas inte emot från appen.",
    },
    { status: 410, headers: noStore },
  );
}
