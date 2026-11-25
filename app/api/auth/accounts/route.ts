import { accountPublic, listAccounts, type AuthProvider } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };
const providers = new Set<AuthProvider>(["bankid", "google", "apple", "phone", "email"]);

export async function GET(request: Request) {
  const provider = new URL(request.url).searchParams.get("provider") as AuthProvider | null;
  if (provider && !providers.has(provider)) {
    return Response.json({ error: "invalid_provider" }, { status: 400, headers: noStore });
  }

  try {
    const accounts = await listAccounts(provider ?? undefined);
    return Response.json(
      {
        accounts: accounts.map(accountPublic),
      },
      { headers: noStore },
    );
  } catch {
    return Response.json({ error: "list_failed" }, { status: 500, headers: noStore });
  }
}
