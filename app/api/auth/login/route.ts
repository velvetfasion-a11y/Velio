import { loginWithProvider, sessionCookie, type AuthProvider } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };
const providers = new Set<AuthProvider>(["bankid", "google", "apple", "phone"]);

export async function POST(request: Request) {
  let body: { provider?: string };
  try {
    body = (await request.json()) as { provider?: string };
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }

  const provider = body.provider as AuthProvider | undefined;
  if (!provider || !providers.has(provider)) {
    return Response.json({ error: "invalid_provider" }, { status: 400, headers: noStore });
  }

  try {
    const { account, token } = await loginWithProvider(provider);
    return Response.json(
      {
        authenticated: true,
        account: {
          id: account.id,
          provider: account.provider,
          name: account.name,
          email: account.email,
          phone: account.phone,
          providerId: account.providerId,
          accountMode: account.accountMode,
        },
      },
      {
        headers: {
          ...noStore,
          "set-cookie": sessionCookie(token),
        },
      },
    );
  } catch {
    return Response.json({ error: "login_failed" }, { status: 500, headers: noStore });
  }
}
