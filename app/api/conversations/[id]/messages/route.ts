import { getAccountBySession } from "@/lib/velio/session";
import { conversationIncludes, listMessages, sendMessage } from "@/lib/velio/sync-db";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const { id } = await context.params;
  if (!(await conversationIncludes(id, account.id))) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: noStore });
  }
  const messages = await listMessages(id);
  return Response.json(
    {
      messages: messages.map((message) => ({
        id: message.id,
        from: message.sender_id === account.id ? "me" : "them",
        text: message.text,
        time: new Date(message.created_at).toLocaleTimeString("sv-SE", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        senderId: message.sender_id,
        createdAt: message.created_at,
      })),
    },
    { headers: noStore },
  );
}

export async function POST(request: Request, context: Ctx) {
  const account = await getAccountBySession(request);
  if (!account) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const { id } = await context.params;
  if (!(await conversationIncludes(id, account.id))) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: noStore });
  }

  let body: { text?: string };
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }
  const text = body.text?.trim() ?? "";
  if (!text) {
    return Response.json({ error: "empty" }, { status: 400, headers: noStore });
  }

  const message = await sendMessage({ conversationId: id, senderId: account.id, text });
  return Response.json(
    {
      message: {
        id: message.id,
        from: "me" as const,
        text: message.text,
        time: new Date(message.created_at).toLocaleTimeString("sv-SE", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        createdAt: message.created_at,
      },
    },
    { headers: noStore },
  );
}
