import { authCapabilities } from "@/lib/velio/auth-config";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(authCapabilities(), {
    headers: { "cache-control": "private, no-store" },
  });
}
