import {
  accountPublic,
  createAccount,
  loginWithAccountId,
  sessionCookie,
  type AuthProvider,
} from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };
const providers = new Set<AuthProvider>(["bankid", "google", "apple", "phone", "email"]);

export async function POST(request: Request) {
  let body: {
    provider?: string;
    accountId?: string;
    create?: boolean;
    name?: string;
    email?: string;
    phone?: string;
    accountMode?: "customer" | "business";
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }

  const provider = body.provider as AuthProvider | undefined;
  if (!provider || !providers.has(provider)) {
    return Response.json({ error: "invalid_provider" }, { status: 400, headers: noStore });
  }

  try {
    // Creating business accounts requires prior ID verification via dedicated endpoints.
    if (body.create && body.accountMode === "business") {
      return Response.json(
        {
          error: "id_verification_required",
          message: "VELIO Business kräver BankID eller passverifiering innan kontot aktiveras.",
        },
        { status: 403, headers: noStore },
      );
    }

    const result = body.create
      ? await createAccount({
          provider,
          name: body.name ?? "",
          email: body.email ?? "",
          phone: body.phone ?? "",
          accountMode: "customer",
        })
      : body.accountId
        ? await loginWithAccountId(body.accountId)
        : null;

    if (!result) {
      return Response.json({ error: "account_required" }, { status: 400, headers: noStore });
    }

    return Response.json(
      {
        authenticated: true,
        account: accountPublic(result.account),
      },
      {
        headers: {
          ...noStore,
          "set-cookie": sessionCookie(result.token),
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "login_failed";
    const status =
      message.startsWith("invalid_") ||
      message === "unknown_account" ||
      message === "unknown_provider" ||
      message === "id_verification_required"
        ? 400
        : 500;
    return Response.json({ error: message }, { status, headers: noStore });
  }
}
