import {
  createAccount,
  loginWithAccountId,
  sessionCookie,
  type AuthProvider,
} from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };
const providers = new Set<AuthProvider>(["bankid", "google", "apple", "phone"]);

function accountJson(account: {
  id: string;
  provider: string;
  name: string;
  email: string;
  phone: string;
  providerId: string | null;
  accountMode: "customer" | "business";
}) {
  return {
    id: account.id,
    provider: account.provider,
    name: account.name,
    email: account.email,
    phone: account.phone,
    providerId: account.providerId,
    accountMode: account.accountMode,
  };
}

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
    const result = body.create
      ? await createAccount({
          provider,
          name: body.name ?? "",
          email: body.email ?? "",
          phone: body.phone ?? "",
          accountMode: body.accountMode,
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
        account: accountJson(result.account),
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
      message.startsWith("invalid_") || message === "unknown_account" || message === "unknown_provider"
        ? 400
        : 500;
    return Response.json({ error: message }, { status, headers: noStore });
  }
}
