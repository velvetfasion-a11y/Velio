import { getAccountBySession } from "@/lib/velio/session";
import { createJob, listJobs } from "@/lib/velio/sync-db";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function GET() {
  const jobs = await listJobs();
  return Response.json({ jobs }, { headers: noStore });
}

export async function POST(request: Request) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  let body: {
    serviceId?: string;
    text?: string;
    when?: string;
    address?: string;
    rate?: "hour" | "fixed";
    price?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }

  const text = body.text?.trim() ?? "";
  const when = body.when?.trim() ?? "";
  const address = body.address?.trim() ?? "";
  const serviceId = body.serviceId?.trim() ?? "";
  if (text.length < 8 || when.length < 2 || address.length < 3 || !serviceId) {
    return Response.json({ error: "invalid_job" }, { status: 400, headers: noStore });
  }

  const id = await createJob({
    ownerId: account.id,
    serviceId,
    text,
    when,
    address,
    rate: body.rate === "fixed" ? "fixed" : "hour",
    price: typeof body.price === "number" ? body.price : 0,
  });

  const jobs = await listJobs();
  return Response.json({ id, jobs }, { headers: noStore });
}
