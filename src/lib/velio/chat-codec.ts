import type { ChatCard, ChatMsg } from "@/lib/velio/store";

const CARD_PREFIX = "VELIO_CARD:";

export function encodeCardMessage(card: ChatCard, fallback = "Bokningsförfrågan"): string {
  return `${CARD_PREFIX}${JSON.stringify({ text: fallback, card })}`;
}

export function decodeStoredMessage(raw: string): { text?: string; card?: ChatCard } {
  if (!raw.startsWith(CARD_PREFIX)) return { text: raw };
  try {
    const parsed = JSON.parse(raw.slice(CARD_PREFIX.length)) as { text?: string; card?: ChatCard };
    if (!parsed?.card || typeof parsed.card !== "object") return { text: raw };
    return {
      text: parsed.text || "Bokningsförfrågan",
      card: parsed.card,
    };
  } catch {
    return { text: raw };
  }
}

export function previewMessageText(raw: string): string {
  const decoded = decodeStoredMessage(raw);
  if (decoded.card?.kind === "request") return "Bokningsförfrågan";
  if (decoded.card?.kind === "rebook") return "Ny förfrågan";
  if (decoded.card?.kind === "confirmed") return "Tid bekräftad";
  if (decoded.card?.kind === "quote") return "Slutpris skickat";
  if (decoded.card?.kind === "paid") return "Betalning mottagen";
  return decoded.text || raw;
}

export function chatDtoToMsg(message: {
  id: string;
  from: "me" | "them";
  text: string;
  time?: string;
}): ChatMsg {
  const decoded = decodeStoredMessage(message.text);
  return {
    id: message.id,
    from: message.from,
    text: decoded.card ? decoded.text : message.text,
    time: message.time,
    card: decoded.card,
  };
}

/** Resolve take-job request cards from later accept/decline replies in the same thread. */
export function resolveTakeRequestStatuses(messages: ChatMsg[]): ChatMsg[] {
  return messages.map((message, index) => {
    if (message.card?.kind !== "request" || message.card.intent !== "take") return message;
    if (message.card.status && message.card.status !== "pending") return message;
    for (let later = index + 1; later < messages.length; later += 1) {
      const next = messages[later];
      const text = next.text ?? "";
      if (text.includes("Jag godkänner")) {
        return { ...message, card: { ...message.card, status: "accepted" } };
      }
      if (text.includes("annan utförare")) {
        return { ...message, card: { ...message.card, status: "declined" } };
      }
      if (next.card?.kind === "request" && next.card.intent === "take" && next.card.status === "accepted") {
        return { ...message, card: { ...message.card, status: "accepted" } };
      }
      if (next.card?.kind === "request" && next.card.intent === "take" && next.card.status === "declined") {
        return { ...message, card: { ...message.card, status: "declined" } };
      }
    }
    return message;
  });
}
