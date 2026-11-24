import { clearSessionCookie, destroySession } from "@/lib/velio/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await destroySession(request);
  return Response.json(
    { ok: true },
    {
      headers: {
        "cache-control": "private, no-store",
        "set-cookie": clearSessionCookie(),
      },
    },
  );
}
